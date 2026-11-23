/**
 * The masthead's soundtrack: a tracker pattern stepping in tempo.
 *
 * The pattern is server-rendered at row 0 (src/components/Hero.astro), so
 * without JavaScript, and under reduced motion, it stands as written. This
 * only steps it: a row at a time, the way a tracker scrolls, the row that
 * plays held in the middle on a plate of the accent; and each channel's level
 * meter jumps when its note plays and falls back. All four channels are
 * always written; a phone's panel is narrow enough to show the first two.
 *
 * Ambient work on the one loop (src/lib/field/loop.ts): it steps down on a
 * slow machine, holds while the page changes channel, and stops while the
 * masthead is off screen. A row changes about four times a second; the
 * frames between move only the meters.
 */

import { subscribe } from '../field/loop';
import { BPM, CHANNELS, ROWS, ROWS_PER_BEAT, pattern } from './tune';

/** Rows shown either side of the one that plays, near and far. */
export const NEAR = 5;
export const FAR = 8;

const ROW_S = 60 / BPM / ROWS_PER_BEAT;
const ALL = CHANNELS.map((_, i) => i);

/** The five blocks of rows around `cur`, as text: far above .. far below. */
export function rowsAround(cur: number): [string, string, string, string, string] {
	const lines = LINES;
	const at = (r: number): string => lines[((r % ROWS) + ROWS) % ROWS] ?? '';
	const span = (from: number, to: number): string => {
		const out: string[] = [];
		for (let r = from; r <= to; r++) out.push(at(r));
		return out.join('\n');
	};
	return [
		span(cur - NEAR - FAR, cur - NEAR - 1),
		span(cur - NEAR, cur - 1),
		at(cur),
		span(cur + 1, cur + NEAR),
		span(cur + NEAR + 1, cur + NEAR + FAR),
	];
}

const PATTERN = pattern();
const LINES = PATTERN.lines(ALL);

export function boot(): void {
	const host = document.querySelector<HTMLElement>('[data-tracker]');
	if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const blocks = [...host.querySelectorAll<HTMLElement>('[data-rows]')];
	const meters = [...host.querySelectorAll<HTMLElement>('[data-meter]')];
	if (blocks.length !== 5) return;

	const levels = ALL.map(() => 0);
	let start = -1;
	let row = -1;
	let last = 0;
	let stop: (() => void) | null = null;

	const tick = (now: number): void => {
		if (start < 0) start = last = now;
		const cur = Math.floor((now - start) / 1000 / ROW_S);
		if (cur !== row) {
			row = cur;
			rowsAround(cur).forEach((text, i) => {
				const el = blocks[i];
				if (el) el.textContent = text;
			});
			const vols = PATTERN.volumes[((cur % ROWS) + ROWS) % ROWS] ?? [];
			ALL.forEach((ch) => {
				const v = vols[ch] ?? 0;
				if (v) levels[ch] = v / 0x40;
			});
		}
		const dt = Math.min(0.1, (now - last) / 1000);
		last = now;
		ALL.forEach((ch) => {
			levels[ch] = Math.max(0, (levels[ch] ?? 0) - dt * 1.6);
			// Sixteen segments: the meter moves a whole segment or not at all.
			meters[ch]?.style.setProperty('--level', String(Math.round((levels[ch] ?? 0) * 16) / 16));
		});
	};

	new IntersectionObserver(([entry]) => {
		if (entry?.isIntersecting && !stop) stop = subscribe(tick, { ambient: true });
		else if (!entry?.isIntersecting && stop) {
			stop();
			stop = null;
		}
	}).observe(host);
}
