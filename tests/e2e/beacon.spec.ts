import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * The beacon (src/scripts/beacon.ts): one same-origin GET to `/e` per event,
 * which the host's request log records. Nothing else counts visitors.
 */

/** Every `/e` request the page makes, as its query string. */
const beacons = (page: Page): string[] => {
	const seen: string[] = [];
	page.on('request', (r) => {
		const url = new URL(r.url());
		if (url.pathname === '/e') seen.push(url.search);
	});
	return seen;
};

test('a visit is counted once, and says nothing about where it came from', async ({ page }) => {
	const seen = beacons(page);
	await page.goto('/', { waitUntil: 'networkidle' });
	expect(seen).toEqual(['?c=view']);
});

test('a referrer is cut down to its host', async ({ page }) => {
	const seen = beacons(page);
	await page.goto('/', {
		waitUntil: 'networkidle',
		referer: 'https://example.com/a/private/path?q=1',
	});
	expect(seen).toEqual(['?c=view&r=example.com']);
});

test('turning a card is counted once per visit', async ({ page }) => {
	const seen = beacons(page);
	await page.goto('/', { waitUntil: 'networkidle' });
	const slot = page.locator('[data-card="rick"]');
	await slot.locator('.turn').focus();
	await page.keyboard.press('Enter');
	await expect(slot.locator('.turn-back')).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(slot.locator('.turn')).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(slot.locator('.turn-back')).toBeFocused();
	await expect.poll(() => seen).toEqual(['?c=view', '?c=flip.rick']);
});

test('a link that leaves the site is counted with the card it is on', async ({ page }) => {
	const seen = beacons(page);
	await page.goto('/', { waitUntil: 'networkidle' });
	// Press the first link out, without following it.
	const expected = await page.evaluate(() => {
		const link = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="https://"]')].find(
			(a) => new URL(a.href).hostname !== location.hostname,
		);
		if (!link) return null;
		link.addEventListener('click', (e) => e.preventDefault());
		link.click();
		const where = link.closest<HTMLElement>('.slot')?.dataset.card ?? 'bar';
		return `?c=out.${where}.${new URL(link.href).hostname.replace(/^www\./, '')}`;
	});
	expect(expected).not.toBeNull();
	await expect.poll(() => seen).toEqual(['?c=view', expected]);
});

test('a visitor who sends Global Privacy Control is not counted', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true });
	});
	const seen = beacons(page);
	await page.goto('/', { waitUntil: 'networkidle' });
	const slot = page.locator('[data-card="rick"]');
	await slot.locator('.turn').focus();
	await page.keyboard.press('Enter');
	await expect(slot.locator('.turn-back')).toBeFocused();
	expect(seen).toEqual([]);
});

test('the beacon file is served, and is never cached', async ({ request }) => {
	const res = await request.get('/e?c=test');
	expect(res.status()).toBe(200);
	// A cached reply would never reach the host, so it would never be logged.
	const config = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
		hosting: { headers: { source: string; headers: { key: string; value: string }[] }[] };
	};
	const cache = config.hosting.headers
		.find((b) => b.source === '/e')
		?.headers.find((h) => h.key === 'Cache-Control')?.value;
	expect(cache).toBe('no-store');
});
