import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * What a link to the site looks like where it is pasted, and what it tells a
 * search engine. No page passed a picture, so a shared case study was a bare
 * line of text, and there was no structured data at all (2026-09-29).
 */

const ROUTES = [
	'/',
	'/work/nlziet',
	'/work/chromecast',
	'/work/vamp',
	'/work/kijk',
	'/work/nos',
	'/work/streamz-vtm-go',
];

const meta = (page: Page, key: string): Promise<string | null> =>
	page.locator(`meta[property="${key}"], meta[name="${key}"]`).getAttribute('content');

const jsonLd = async (page: Page): Promise<Record<string, unknown>> => {
	const blocks = page.locator('script[type="application/ld+json"]');
	await expect(blocks).toHaveCount(1);
	return JSON.parse((await blocks.textContent()) ?? '') as Record<string, unknown>;
};

for (const path of ROUTES) {
	test(`${path}: a large card, with a 1200x630 picture that exists and is described`, async ({
		page,
		request,
	}) => {
		await page.goto(path);
		expect(await meta(page, 'twitter:card')).toBe('summary_large_image');

		const src = await meta(page, 'og:image');
		expect(src, 'the picture is not on the site, or not absolute').toMatch(
			/^https:\/\/rickgroot\.nl\/_astro\//,
		);
		expect(await meta(page, 'twitter:image')).toBe(src);
		expect((await meta(page, 'og:image:alt')) ?? '', 'the picture is not described').not.toBe('');
		expect(await meta(page, 'og:image:width')).toBe('1200');
		expect(await meta(page, 'og:image:height')).toBe('630');

		// The URL is the production one: fetch the same path from this build.
		const res = await request.get(new URL(src!).pathname);
		expect(res.ok(), `${src} is not in the build`).toBe(true);
		const { width, height } = await sharp(await res.body()).metadata();
		expect([width, height], 'the picture is not the size it says').toEqual([1200, 630]);
	});
}

test('the home page says who the site is about', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('Rick Groot | Connected TV developer');
	const data = await jsonLd(page);
	expect(data['@type']).toBe('Person');
	expect(data.name).toBe('Rick Groot');
	expect(data.jobTitle).toBe('Connected TV developer');
	expect(data.sameAs).toEqual(expect.arrayContaining([expect.stringMatching(/github\.com\//)]));
});

test('a case study says what it is and who wrote it up', async ({ page }) => {
	await page.goto('/work/vamp');
	await expect(page).toHaveTitle('VAMP | Rick Groot');
	const data = await jsonLd(page);
	expect(data['@type']).toBe('CreativeWork');
	expect(data.name).toBe('VAMP');
	expect(data.url).toBe('https://rickgroot.nl/work/vamp');
	expect(data.image).toBe(await meta(page, 'og:image'));
	expect((data.author as { name?: string } | undefined)?.name).toBe('Rick Groot');
});
