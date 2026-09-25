import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = [
	'/',
	'/work/nlziet',
	'/work/chromecast',
	'/work/vamp',
	'/work/kijk',
	'/work/nos',
	'/work/streamz-vtm-go',
	'/definitely-not-a-page',
];

for (const path of ROUTES) {
	test(`${path} has no detectable accessibility violations`, async ({ page }) => {
		await page.goto(path);
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();

		const summary = results.violations.map(
			(v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`,
		);
		expect(summary, summary.join('\n')).toEqual([]);
	});
}

test('the skip link is the first thing keyboard focus reaches', async ({ page }) => {
	await page.goto('/');
	await page.keyboard.press('Tab');
	const focused = page.locator(':focus');
	await expect(focused).toHaveText(/Skip to content/i);
});

test('every link has an accessible name', async ({ page }) => {
	// The old footer rendered four icon-only links with no label at all.
	for (const path of ['/', '/work/nlziet']) {
		await page.goto(path);
		const unnamed = await page.locator('a').evaluateAll((links) =>
			links
				// Links removed from the accessibility tree on purpose -- a
				// decorative duplicate of a real link right next to it -- have no
				// accessible name by design.
				.filter((a) => a.getAttribute('aria-hidden') !== 'true')
				.filter((a) => !(a.textContent ?? '').trim() && !a.getAttribute('aria-label'))
				.map((a) => a.getAttribute('href') ?? '(no href)'),
		);
		expect(unnamed, `${path}: links without an accessible name`).toEqual([]);
	}
});
