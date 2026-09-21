import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/work', '/work/nlziet', '/work/chromecast', '/work/vamp'];

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
		await expect(page.getByRole('link', { name: 'Work', exact: true }).first()).toBeVisible();
	});

	test('every page has exactly one h1', async ({ page }) => {
		for (const path of ROUTES) {
			await page.goto(path);
			await expect(page.locator('h1'), `${path} h1 count`).toHaveCount(1);
		}
	});
});
