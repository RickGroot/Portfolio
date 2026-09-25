/**
 * How I work — the AI-assisted development chapter.
 *
 * REWRITTEN 2026-09-25 around Rick's three themes: an AI-first approach,
 * keeping responsibility, and aligning competences through smart tooling.
 *
 * The brief still holds -- "Show the real workflow: decisions, constraints,
 * iterations, code or terminal fragments, before/after measurements, and
 * shipped results. Do not invent fake technical artifacts." -- so each theme
 * carries a proof that is true of this repository and can be checked in it:
 * the git log, the test suite, the rules file. Parallel imperatives read as
 * generated (the 2026-09-22 note on the first version), so the titles say
 * what happens rather than what to do.
 *
 * Rick: the themes are yours, the sentences are mine. Rewrite them in your own
 * voice -- that is the one thing I cannot do for you.
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
		title: 'An agent writes the first draft',
		body: 'I work AI-first. Every change starts as an agent’s draft: the code, the tests, and often the question I had not thought to ask. My time goes to what needs a person: choosing between options, and deciding what not to build.',
		proof:
			'This site’s rebuild is 37 commits, each co-authored by Claude and saying so. Every new look on it was one of three full-size candidates I chose between.',
	},
	{
		index: '02',
		title: 'I answer for what ships',
		body: 'An agent can write the code; it cannot be responsible for it. So nothing goes in that I have not read, and every claim the site makes has a check behind it that can fail: a test, a budget, a build that refuses.',
		proof:
			'105 tests, a 2.5-second load budget measured on a CPU slowed four times, and a colour check that fails the build below 4.5:1 contrast.',
	},
	{
		index: '03',
		title: 'Expertise, built into the tools',
		body: 'Expertise should not depend on who is in the room. I write it into what colleagues and agents both run, rules, prompts and checks, so accessibility and performance are the default, not a comment in review.',
		proof:
			'One rules file here is read by every change, human or agent. A scrollbar bug no test could see became a rule and a test the same day.',
	},
];
