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
 * Card 01 previously described cutting the WebGL layer. That was true when it
 * was written and is no longer, because the renderer was reinstated as a
 * deliberate trade of performance for visual ambition. A page that says its
 * claims are checkable cannot carry one that the site itself disproves.
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
		title: 'Fixed what the tools missed',
		body: 'Selecting text on one case study made it harder to read, not easier: the project’s own brand colour was being used raw as the selection background. Automated accessibility checks do not look at ::selection, so twenty-five green tests had nothing to say about it.',
		proof:
			'It measured 1.34:1 against the page. Every text colour on the site is now solved at build time against the field it sits on, and the build fails below 4.5:1.',
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
