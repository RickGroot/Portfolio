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
 *   - It only ever changes text, never layout. The display face is monospaced,
 *     so a noise glyph is exactly as wide as the letter it stands in for, and
 *     whitespace is never scrambled, so words keep their line breaks.
 *   - Assistive technology hears the real heading throughout: the element
 *     carries its own text as an aria-label for as long as the decode runs.
 *   - It has no loop of its own. It subscribes to the one animation loop on the
 *     site (src/lib/field/loop.ts) for half a second and leaves, so the budget
 *     of exactly one loop still holds.
 *
 * Reduced motion: the text is simply there.
 */
import { subscribe } from './field/loop';

/** ASCII only: the Martian Mono subset has these, and nothing is left to fall back. */
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

export function decode(el: HTMLElement | null, options: DecodeOptions = {}): void {
	if (!el) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	running.get(el)?.();

	const duration = options.duration ?? DURATION_MS;
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
	const originals = nodes.map((n) => n.data);
	const total = originals.reduce((sum, t) => sum + t.length, 0);
	if (total === 0) return;

	const hadLabel = el.hasAttribute('aria-label');
	if (options.label !== false && !hadLabel) {
		el.setAttribute('aria-label', (el.textContent ?? '').replace(/\s+/g, ' ').trim());
	}

	let elapsed = 0;
	let unsubscribe: (() => void) | null = null;

	const finish = (): void => {
		nodes.forEach((n, i) => {
			n.data = originals[i] ?? n.data;
		});
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
		let k = 0;
		nodes.forEach((node, i) => {
			const source = originals[i] ?? '';
			let out = '';
			for (const ch of source) {
				const at = (k / total) * 0.75 + jitter(k) * 0.25;
				k++;
				out += KEEP.test(ch) || progress >= at ? ch : NOISE[(Math.random() * NOISE.length) | 0];
			}
			node.data = out;
		});
	});
	running.set(el, finish);
}
