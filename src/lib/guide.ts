/**
 * Programme-guide geometry: where each piece of work sits on the time axis.
 *
 * The guide draws the work the way a television guide draws programmes -- one
 * row per channel, one block per programme, spanning its time on air, with a
 * line for NOW. This file only does the arithmetic; the copy lives in the work
 * collection, and the drawing in src/components/Guide.astro.
 */
import type { PublishedWorkEntry } from './work';

/** A calendar date as a fractional year: 2026-09-24 is 2026.73. */
export function yearFraction(d: Date): number {
	const year = d.getUTCFullYear();
	const start = Date.UTC(year, 0, 1);
	const end = Date.UTC(year + 1, 0, 1);
	return year + (d.getTime() - start) / (end - start);
}

export interface Programme {
	entry: PublishedWorkEntry;
	/** Position on the axis, 0..1. */
	from: number;
	/** Where the block ends, 0..1. An ongoing programme ends at NOW. */
	to: number;
	ongoing: boolean;
}

export interface Guide {
	/** First and last year on the axis, as fractional years. */
	start: number;
	end: number;
	/** NOW on the axis, 0..1, at build time. The page moves it to today. */
	now: number;
	/** The whole years that get a tick, with their position. */
	ticks: { year: number; at: number }[];
	programmes: Programme[];
}

/**
 * The axis runs from the first programme's first year to a little past NOW, so
 * the NOW line never sits on the edge and an ongoing programme visibly carries
 * on past it. `period` is "2022" or "2022–2025" (content.config.ts enforces
 * it); a completed programme runs to the end of its last year.
 */
export function buildGuide(entries: readonly PublishedWorkEntry[], today = new Date()): Guide {
	const nowYear = yearFraction(today);
	const spans = entries.map((entry) => {
		const [first, last] = entry.data.period.split('–').map(Number);
		const from = first ?? nowYear;
		const ongoing = entry.data.status === 'ongoing';
		return { entry, from, to: ongoing ? nowYear : (last ?? from) + 1, ongoing };
	});

	const start = Math.min(...spans.map((s) => s.from));
	const end = Math.max(nowYear + 0.4, ...spans.map((s) => s.to));
	const at = (y: number): number => (y - start) / (end - start);

	// A tick right at the end of the axis would hang its label off the edge.
	const ticks: { year: number; at: number }[] = [];
	for (let y = Math.ceil(start); y < end; y++) if (at(y) < 0.94) ticks.push({ year: y, at: at(y) });

	return {
		start,
		end,
		now: at(nowYear),
		ticks,
		programmes: spans.map((s) => ({ ...s, from: at(s.from), to: at(s.to) })),
	};
}
