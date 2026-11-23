import { test, expect } from '@playwright/test';

test('the table renders identity and the work as cards', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Rick Groot');
	for (const id of ['nlziet', 'vamp', 'kijk', 'nos', 'chromecast', 'streamz-vtm-go']) {
		await expect(page.locator(`[data-card="${id}"]`), id).toHaveCount(1);
	}
});

test('drafts never escape the collection', async ({ page }) => {
	await page.goto('/');
	const body = (await page.locator('body').textContent())!.toLowerCase();
	expect(body).not.toContain('nh nieuws');
	expect(await page.locator('[data-card="nhnieuws"]').count()).toBe(0);
});

test('a card has its case study on the back, with real links', async ({ page }) => {
	await page.goto('/');
	const back = page.locator('[data-card="vamp"] .back');
	await expect(back).toContainText('VAMP');
	await expect(back.getByRole('link', { name: /Live app/ })).toHaveCount(1);
});

test('no dead read.cv link survives', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('a[href*="read.cv"]')).toHaveCount(0);
});

test('no console output from the site', async ({ page }) => {
	const logs: string[] = [];
	page.on('console', (m) => {
		if (m.type() === 'log' || m.type() === 'error') logs.push(m.text());
	});
	await page.goto('/', { waitUntil: 'networkidle' });
	expect(logs).toEqual([]);
});

test('no third-party font or script origins are requested', async ({ page }) => {
	const external: string[] = [];
	page.on('request', (r) => {
		const url = new URL(r.url());
		if (!['127.0.0.1', 'localhost', 'rickgroot.nl'].includes(url.hostname)) external.push(r.url());
	});
	await page.goto('/', { waitUntil: 'networkidle' });
	expect(external, `unexpected third-party requests: ${external.join(', ')}`).toHaveLength(0);
});
