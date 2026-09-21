/**
 * How I work — the AI-driven development chapter.
 *
 * PLACEHOLDER COPY. This is the one section Rick has not written himself, and
 * it is the section most likely to read as hype if it is written badly. The
 * brief is explicit: "Practical workflow, verification, and limits; no hype."
 *
 * Replace before launch. See docs/content-guide.md.
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
		title: 'Plan before code',
		body: 'Work starts as a written plan with explicit phases, acceptance criteria and non-goals. Most of the value is in deciding what not to build.',
		proof: 'Every phase of this site has a gate you can run, not an opinion.',
	},
	{
		index: '02',
		title: 'Verify, do not trust',
		body: 'Generated code is a draft. Claims about it are measured — bundle sizes, frame times, contrast ratios — and written down next to the decision they justified.',
		proof:
			'The hero renders as text because two <pre> elements measured 2.22ms against a span-per-cell approach at 40.71ms.',
	},
	{
		index: '03',
		title: 'Make the rule enforceable',
		body: 'A convention nobody can break is worth more than one everybody agrees with. If something matters, it becomes a test or a lint rule.',
		proof:
			'One animation loop site-wide is a no-restricted-globals rule, not a comment asking nicely.',
	},
];
