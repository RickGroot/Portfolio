import { test, expect } from '@playwright/test';

test('homepage renders identity and the work', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Rick Groot');
	await expect(page.locator('#work [data-block="nlziet"]')).toBeVisible();
	await expect(page.locator('#work [data-block="vamp"]')).toBeVisible();
});

test('the one-pager is the complete record, including KIJK', async ({ page }) => {
	await page.goto('/');
	// KIJK never had a section of its own, and it is a programme on the guide with a
	// link to its case study -- otherwise the copy is orphaned, which is
	// exactly what happened when the /work index was removed. It is the fourth
	// programme, so it waits behind Load more: one press away, never gone.
	await page.locator('#work summary', { hasText: 'Load more' }).click();
	const kijk = page.getByRole('link', { name: /KIJK/ });
	await expect(kijk).toBeVisible();
	await expect(kijk).toHaveAttribute('href', '/work/kijk');
});

test('drafts never escape the collection', async ({ page }) => {
	await page.goto('/');
	const body = (await page.locator('body').innerText()).toLowerCase();
	// NH Nieuws is the one draft left: unwritten.
	expect(body).not.toContain('nh nieuws');
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

test('the console says one thing, once, on every page', async ({ page }) => {
	// docs/easter-eggs.md: one line, "Signal acquired." A second log line is
	// either debugging left in or an easter egg that stopped being restrained.
	for (const path of ['/', '/work/vamp', '/404-not-a-page']) {
		const logs: string[] = [];
		const listen = (m: import('@playwright/test').ConsoleMessage): void => {
			if (m.type() === 'log') logs.push(m.text());
		};
		page.on('console', listen);
		await page.goto(path, { waitUntil: 'networkidle' });
		page.off('console', listen);
		expect(logs, `${path}: console.log lines`).toHaveLength(1);
		expect(logs[0], path).toContain('Signal acquired.');
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
