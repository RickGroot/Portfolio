import { test, expect } from '@playwright/test';

/*
 * A link to another site opens in a new tab (and, from the installed app, in
 * the browser), and tells a screen reader so. A link that stays here, mailto:
 * or the skip link, does not. Counted across both faces of every card, so a
 * back's links are checked without turning it.
 */
for (const path of ['/', '/404']) {
	test(`${path}: external links open a new tab and say so`, async ({ page }) => {
		await page.goto(path);
		const links = await page.locator('a[href]').evaluateAll((as) =>
			as.map((a) => ({
				href: a.getAttribute('href') ?? '',
				target: a.getAttribute('target'),
				rel: a.getAttribute('rel') ?? '',
				described: a.getAttribute('aria-describedby'),
			})),
		);
		const note = (await page.locator('#new-tab').textContent())?.trim();
		expect(note).toBe('Opens in a new tab');

		const out = links.filter(
			(l) => /^https?:\/\//.test(l.href) && !l.href.includes('rickgroot.nl'),
		);
		if (path === '/') expect(out.length).toBeGreaterThan(10);
		for (const l of out) {
			expect(l.target, l.href).toBe('_blank');
			expect(l.rel.split(' '), l.href).toContain('noopener');
			expect(l.described, l.href).toBe('new-tab');
		}
		for (const l of links.filter((l) => !out.includes(l))) {
			expect(l.target, l.href).toBeNull();
			expect(l.described, l.href).toBeNull();
		}
	});
}
