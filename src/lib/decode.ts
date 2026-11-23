/**
 * Decode, for text: a headline resolving out of signal, left to right.
 *
 * The site's signature treatment is a picture resolving out of noise; this is
 * the same idea at the scale of a word. Every character that has not resolved
 * yet shows a glyph from the noise set, and the resolved front runs left to
 * right with a little jitter, so it reads as a signal locking on rather than
 * as a wipe.
 *
 * Three properties make it safe to run on real headings:
 *
 *   - It never changes layout. The display face is proportional, so a noise
 *     glyph is not as wide as the letter it stands in for. So before anything
 *     changes, every letter's rendered width is measured -- with the kerning
 *     and tracking its line really has -- and while the decode runs each letter
 *     stands in a box of exactly that width, and each word is held together.
 *     The line comes out the same length, breaks in the same places, and the
 *     original text nodes go back exactly as they were. Whitespace is never
 *     scrambled, so words keep their breaks.
 *   - Assistive technology hears the real heading throughout: the element
 *     carries its own text as an aria-label for as long as the decode runs.
 *   - It has no loop of its own. It subscribes to the one animation loop on the
 *     site (src/lib/field/loop.ts) for half a second and leaves, so the budget
 *     of exactly one loop still holds. A timer finishes it where no frames
 *     come.
 *
 * Reduced motion: the text is simply there.
 */
import { subscribe } from './field/loop';

/** ASCII only: every subset on the site has these, so nothing falls back. */
const NOISE = '#%*+=-:/<>[]01';
const DURATION_MS = 560;

/** Cancels an unfinished decode, putting its text back. */
const running = new WeakMap<HTMLElement, () => void>();

/** A fixed, even-looking scatter in 0..1 per character position. */
const jitter = (i: number): number => ((i * 2654435761) >>> 0) / 4294967296;

/**
 * Characters that never scramble: whitespace, so words keep their breaks, and
 * zero-width ones such as the word joiner holding "re-run" together -- a noise
 * glyph in its place would be a whole character wider and reflow the line.
 */
const KEEP = /[\s\u200b-\u200f\u2060\ufeff]/;

export interface DecodeOptions {
	duration?: number;
	/** Carry the real text as an aria-label while decoding. Off for decoration that is aria-hidden anyway. */
	label?: boolean;
}

/** One letter being scrambled: its box, the text inside it, and its place in the line. */
interface Cell {
	text: Text;
	ch: string;
	at: number;
}

const noise = (): string => NOISE[(Math.random() * NOISE.length) | 0] ?? '#';

export function decode(el: HTMLElement | null, options: DecodeOptions = {}): void {
	if (!el) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	running.get(el)?.();
	// Nothing on screen to scramble, and nothing to measure it by.
	if (el.getClientRects().length === 0) return;

	const duration = options.duration ?? DURATION_MS;
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
	const total = nodes.reduce((sum, n) => sum + [...n.data].length, 0);
	if (total === 0) return;

	// A scaling transform on the way up scales what a Range reports; the boxes
	// are laid out in the element's own pixels. offsetWidth is rounded to a
	// whole pixel, so only a real scale counts: dividing by a rounding error
	// would lengthen the line by a pixel or two, and that is enough to rewrap it.
	const measured = el.offsetWidth > 0 ? el.getBoundingClientRect().width / el.offsetWidth : 1;
	const scale = Math.abs(measured - 1) < 0.02 ? 1 : measured;

	// ---- measure everything first: one layout, no reads between writes.
	const range = document.createRange();
	const widths = nodes.map((node) => {
		const out: number[] = [];
		let i = 0;
		for (const ch of node.data) {
			range.setStart(node, i);
			range.setEnd(node, i + ch.length);
			out.push(KEEP.test(ch) ? 0 : range.getBoundingClientRect().width / scale);
			i += ch.length;
		}
		return out;
	});

	// ---- then build: a box per letter, a nowrap run per word.
	const cells: Cell[] = [];
	const swaps: { node: Text; placed: Node[] }[] = [];
	let k = 0;
	nodes.forEach((node, n) => {
		const placed: Node[] = [];
		let word: HTMLSpanElement | null = null;
		let j = 0;
		for (const ch of node.data) {
			if (KEEP.test(ch)) {
				word = null;
				placed.push(document.createTextNode(ch));
			} else {
				if (!word) {
					word = document.createElement('span');
					word.className = 'decode-word';
					placed.push(word);
				}
				const box = document.createElement('span');
				box.className = 'decode-ch';
				box.style.inlineSize = `${widths[n]?.[j] ?? 0}px`;
				const at = (k / total) * 0.75 + jitter(k) * 0.25;
				const text = document.createTextNode(at <= 0 ? ch : noise());
				box.append(text);
				word.append(box);
				cells.push({ text, ch, at });
			}
			k++;
			j++;
		}
		swaps.push({ node, placed });
	});

	const hadLabel = el.hasAttribute('aria-label');
	if (options.label !== false && !hadLabel) {
		el.setAttribute('aria-label', (el.textContent ?? '').replace(/\s+/g, ' ').trim());
	}
	for (const { node, placed } of swaps) node.replaceWith(...placed);

	let elapsed = 0;
	let unsubscribe: (() => void) | null = null;
	let fallback = 0;

	const finish = (): void => {
		window.clearTimeout(fallback);
		for (const { node, placed } of swaps) {
			const first = placed[0];
			// Someone replaced the text while it ran (the readout sets a new
			// name, then decodes it): the new text stands, and nothing of this
			// run is put back over it.
			if (!first?.isConnected) continue;
			first.parentNode?.insertBefore(node, first);
			for (const p of placed) p.parentNode?.removeChild(p);
		}
		if (options.label !== false && !hadLabel) el.removeAttribute('aria-label');
		unsubscribe?.();
		unsubscribe = null;
		running.delete(el);
	};

	unsubscribe = subscribe((_now, dt) => {
		elapsed += dt;
		const progress = elapsed / duration;
		if (progress >= 1) {
			finish();
			return;
		}
		for (const c of cells) {
			const next = progress >= c.at ? c.ch : noise();
			if (c.text.data !== next) c.text.data = next;
		}
	});
	// A tab that draws no frames -- hidden, or in a window the system has
	// covered -- never ticks, and kept a title in noise until it was shown
	// again. Timers still run there, throttled or not, so one puts the text
	// back. On a tab that draws, the loop gets there first.
	fallback = window.setTimeout(finish, duration + 500);
	running.set(el, finish);
}
