import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.describe('routing', () => {
	test('/ responds 200 with no redirect', async ({ page }) => {
		const response = await page.goto('/');
		expect(response!.status()).toBe(200);
		expect(response!.request().redirectedFrom(), '/ was redirected').toBeNull();
	});

	test('an unknown path is a real 404, not the table with a 200', async ({ page }) => {
		const response = await page.goto('/definitely-not-a-page');
		expect(response!.status()).toBe(404);
		await expect(page.locator('h1')).toHaveText(/Lost: page 404/i);
		await expect(page.locator('[data-card]')).toHaveCount(1);
	});

	test('the 404 is a ticket that leads back to the table', async ({ page }) => {
		await page.goto('/definitely-not-a-page');
		const hrefs = await page
			.locator('main a')
			.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
		expect(hrefs).toContain('/');
	});

	test('canonical URL is the clean public one', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			'href',
			'https://rickgroot.nl/',
		);
		await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
			'content',
			'https://rickgroot.nl/',
		);
	});

	test('every page has exactly one h1', async ({ page }) => {
		for (const path of ['/', '/definitely-not-a-page']) {
			await page.goto(path);
			await expect(page.locator('h1'), `${path} h1 count`).toHaveCount(1);
		}
	});

	// The case-study pages are gone: each is the back of a card now. Emulated
	// here because astro preview does not read firebase.json.
	test('firebase.json sends /work and /work/** to the table with a 301', () => {
		const config = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
			hosting: { redirects?: { source: string; destination: string; type: number }[] };
		};
		const redirects = config.hosting.redirects ?? [];
		for (const source of ['/work', '/work/**']) {
			const r = redirects.find((x) => x.source === source);
			expect(r, `no redirect for ${source}`).toBeDefined();
			expect(r!.destination).toBe('/');
			expect(r!.type).toBe(301);
		}
	});

	test('no page is built for /work', async ({ request }) => {
		const res = await request.get('/work/nlziet');
		expect(res.status()).toBe(404);
	});
});
