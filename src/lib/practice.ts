/**
 * How I work — the AI-assisted development chapter.
 *
 * REWRITTEN 2026-09-22. The previous version was three aphorisms ("Plan before
 * code", "Verify, do not trust", "Make the rule enforceable") and read as
 * generated, because that shape is what generated copy reaches for: parallel
 * imperatives, antithesis, a tidy rule per card.
 *
 * The brief is explicit about the fix — "Show the real workflow: decisions,
 * constraints, iterations, code or terminal fragments, before/after
 * measurements, and shipped results. Do not invent fake technical artifacts."
 * So these are three things that actually happened while building this site,
 * with the real numbers. Every figure below was measured in this repository and
 * can be re-run from the commands given.
 *
 * Rick: the facts are yours, the sentences are mine. Rewrite them in your own
 * voice — that is the one thing I cannot do for you.
 */
export interface Practice {
	index: string;
	title: string;
	body: string;
	/** A concrete, checkable detail. This is what stops it being a slogan. */
	proof: string;
}

export const practice: readonly Practice[] = [
	{
		index: '01',
		title: 'Cut the WebGL layer',
		body: 'A whole phase was planned around a GPU renderer for the hero. Before building it I measured the reference that inspired it, and it turned out to use no canvas at all — the effect is text in a monospace font. The phase was deleted.',
		proof:
			'Two stacked <pre> elements render a frame in 2.22ms. One <span> per cell measured 40.71ms, which is 2.5x over budget on a desktop.',
	},
	{
		index: '02',
		title: 'Found a 0.23 layout shift',
		body: 'The hero already had CSS containment, so I assumed it could not move the page. The first time I actually measured Cumulative Layout Shift it was more than twice the budget, and the hero was the entire cause.',
		proof:
			'Containment stopped the document reflowing but not the element moving inside it. CLS 0.2331 to 0, checked warm and cold: pnpm test:vitals.',
	},
	{
		index: '03',
		title: 'Let the check find it',
		body: 'Marking a project as a draft hides its page but still publishes its cover image. Three unused images were being deployed, including one I had already decided not to publish. I did not notice; a script I wrote to look for orphaned files did.',
		proof:
			'The same check later failed the build over a 507 KB background image. Removing one wrong step took it to 67 KB: pnpm check:assets.',
	},
];
