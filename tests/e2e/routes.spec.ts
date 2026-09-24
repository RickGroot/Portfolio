import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/work/nlziet', '/work/chromecast', '/work/vamp'];

test.describe('routing', () => {
	for (const path of ROUTES) {
		test(`${path} responds 200 with no redirect`, async ({ page }) => {
			const response = await page.goto(path);
			expect(response, `no response for ${path}`).not.toBeNull();
			expect(response!.status()).toBe(200);

			// A redirect on the happy path is LCP budget handed back for free.
			// astro build.format:'file' + firebase cleanUrls must agree so that
			// /work/nlziet is served directly, not 301'd from /work/nlziet.html.
			expect(response!.request().redirectedFrom(), `${path} was redirected`).toBeNull();
		});
	}

	test('an unknown path does not return the homepage with a 200', async ({ page }) => {
		// The old firebase.json rewrote ** -> /index.html, so every typo returned
		// the homepage with HTTP 200 and no 404 could ever fire.
		const response = await page.goto('/definitely-not-a-page');
		expect(response!.status()).toBe(404);
		await expect(page.locator('h1')).not.toHaveText('Rick Groot');
	});

	test('the 404 page offers real navigation', async ({ page }) => {
		await page.goto('/definitely-not-a-page');
		const links = page.locator('main a');
		await expect(links.first()).toBeVisible();

		// Real destinations only. The hand-typed list this replaced still pointed
		// at a /work index page that the one-pager had removed.
		const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
		expect(hrefs).toContain('/');
		expect(hrefs).toContain('/work/nlziet');
		expect(hrefs, 'links to the removed /work index').not.toContain('/work');
		for (const href of hrefs) {
			const res = await page.request.get(href ?? '');
			expect(res.status(), `404 page links to ${href}, which is not a page`).toBe(200);
		}
	});

	/*
	 * Built pages are files (dist/work/nlziet.html) served at clean URLs, and the
	 * build reports the FILE as the pathname. Every canonical once ended in
	 * .html, and the homepage nav linked to itself. The dev server hides both,
	 * which is why this runs against the build.
	 */
	test('canonical URLs are the clean public ones', async ({ page }) => {
		for (const [path, canonical] of [
			['/', 'https://rickgroot.nl/'],
			['/work/nlziet', 'https://rickgroot.nl/work/nlziet'],
		] as const) {
			await page.goto(path);
			await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
			await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
		}
	});

	test('the homepage nav knows it is on the homepage', async ({ page }) => {
		await page.goto('/');
		const nav = page.getByRole('navigation', { name: 'Primary' });
		await expect(nav.getByRole('link', { name: /Overview/ })).toHaveCount(0);
		await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
	});

	test('every page has exactly one h1', async ({ page }) => {
		for (const path of ROUTES) {
			await page.goto(path);
			await expect(page.locator('h1'), `${path} h1 count`).toHaveCount(1);
		}
	});
});
