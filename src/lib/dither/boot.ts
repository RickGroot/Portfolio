/**
 * Entry point for the 1-bit print (./dither.ts).
 *
 * Three kinds of frame ask for it:
 *   [data-dither]        a photograph, printed by CSS first (`.duo`)
 *   [data-dither-guide]  the programme guide, whose screen carries key art
 *   [data-dither-stage]  a case study's stage, its key art behind the title
 * Each is complete without it -- without JavaScript, WebGL2 or a real GPU it
 * stays exactly as its CSS draws it. The renderer is a dynamic import, fetched
 * when the first frame comes within half a screen, and each frame gets its
 * context only then: a page never scrolled to one never creates one.
 */

import type { Print, Screen } from './dither';

const FRAMES = '[data-dither], [data-dither-guide], [data-dither-stage]';

export function boot(): void {
	const frames = [...document.querySelectorAll<HTMLElement>(FRAMES)];
	if (frames.length === 0 || typeof IntersectionObserver === 'undefined') return;

	let renderer: Promise<typeof import('./dither')> | null = null;
	const prints = new Map<HTMLElement, Print>();
	const screens: Screen[] = [];
	/** When each section last came on, for a print that mounts after the fact. */
	const entered = new WeakMap<Element, number>();

	function mount(frame: HTMLElement, r: typeof import('./dither')): void {
		if (frame.hasAttribute('data-dither-guide')) {
			const screen = r.mountGuide(frame);
			if (screen) screens.push(screen);
			return;
		}
		if (frame.hasAttribute('data-dither-stage')) {
			const screen = r.mountStage(frame);
			if (screen) screens.push(screen);
			return;
		}
		const print = r.mountPrint(frame);
		if (!print) return;
		prints.set(frame, print);
		// The remote jumps channels: 5 from 3 announces Field before the
		// advance has scrolled it near enough to mount. Catch up.
		const section = frame.closest('[data-section]');
		const since = performance.now() - (section ? (entered.get(section) ?? -1e9) : -1e9);
		if (since < ENTER_WINDOW_MS) print.tuneIn(Math.max(0, BEAT_MS - since));
	}

	const near = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const frame = entry.target as HTMLElement;
				near.unobserve(frame);
				renderer ??= import('./dither');
				renderer
					.then((r) => mount(frame, r))
					.catch(() => {
						// The import failed: the CSS stands. Nothing to report.
					});
			}
		},
		{ rootMargin: '50% 0px' },
	);
	for (const frame of frames) near.observe(frame);

	// A channel coming on tunes its photographs in, the way its headline
	// decodes: a beat late, so it resolves as the section arrives rather than
	// while it is still off screen (src/scripts/zap.ts). The advance only fires
	// this with motion allowed; a scroll by hand lands on the finished print.
	document.addEventListener('section:enter', (ev) => {
		const section = ev.target;
		if (!(section instanceof HTMLElement)) return;
		entered.set(section, performance.now());
		for (const [frame, print] of prints) if (section.contains(frame)) print.tuneIn(BEAT_MS);
	});
}

/** The headline's beat in src/scripts/zap.ts. */
const BEAT_MS = 160;
/**
 * How late a print may mount and still tune in with its channel: the advance
 * settles in 620 ms (src/scripts/sections.ts), and a margin.
 */
const ENTER_WINDOW_MS = 900;
