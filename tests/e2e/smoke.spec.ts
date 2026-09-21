import { test, expect } from '@playwright/test';

test('homepage renders identity and featured work', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Rick Groot');
	await expect(page.locator('#nlziet .panel__title a')).toBeVisible();
	await expect(page.locator('#vamp .panel__title a')).toBeVisible();
});

test('the one-pager is the complete record, including non-featured entries', async ({ page }) => {
	await page.goto('/');
	// KIJK earns no section on the one-pager, so the contact section must at
	// least name it and link to its case study -- otherwise the copy is
	// orphaned, which is exactly what happened when /work was removed.
	await expect(page.getByRole('link', { name: 'KIJK' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'KIJK' })).toHaveAttribute('href', '/work/kijk');
});

test('drafts never escape the collection', async ({ page }) => {
	await page.goto('/');
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
	for (const path of ['/', '/work/vamp']) {
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
