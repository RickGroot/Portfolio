import { test, expect } from '@playwright/test';

test('homepage renders identity and featured work', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Rick Groot');
	await expect(page.getByRole('link', { name: /NLZIET/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /VAMP/ })).toBeVisible();
});

test('/work is the complete record, including non-featured entries', async ({ page }) => {
	await page.goto('/work');
	// KIJK gets no dedicated route, so its full body must render inline here
	// or the copy would be orphaned.
	await expect(page.getByText('KIJK', { exact: false }).first()).toBeVisible();
	await expect(page.getByText(/THEOplayer/).first()).toBeVisible();
});

test('drafts never escape the collection', async ({ page }) => {
	await page.goto('/work');
	const body = (await page.locator('body').innerText()).toLowerCase();
	// NOS is held back over image rights; Ajax and NH Nieuws are unwritten.
	expect(body).not.toContain('nh nieuws');
	expect(body).not.toContain('ajax webshop');
});

test('a work page renders its case study body and links', async ({ page }) => {
	await page.goto('/work/vamp');
	await expect(page.locator('h1')).toHaveText('VAMP');
	await expect(page.getByRole('link', { name: /Live app/ })).toBeVisible();
});

test('no dead read.cv link survives anywhere', async ({ page }) => {
	for (const path of ['/', '/work', '/work/vamp']) {
		await page.goto(path);
		await expect(page.locator('a[href*="read.cv"]'), `${path}`).toHaveCount(0);
	}
});

test('no third-party font or script origins are requested', async ({ page }) => {
	const external: string[] = [];
	page.on('request', (r) => {
		const url = new URL(r.url());
		if (!['127.0.0.1', 'localhost', 'rickgroot.nl'].includes(url.hostname)) external.push(r.url());
	});
	await page.goto('/', { waitUntil: 'networkidle' });
	// The old site @import'ed Google Fonts -- render-blocking, and it sent EU
	// visitor IPs to Google without consent.
	expect(external, `unexpected third-party requests: ${external.join(', ')}`).toHaveLength(0);
});
