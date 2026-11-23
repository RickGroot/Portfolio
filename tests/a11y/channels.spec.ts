import { test, expect, type Page } from '@playwright/test';
import { restOn } from '../support/guide';
import { readFileSync } from 'node:fs';
import { AA, CHANNELS, PALETTE, channel, contrast } from '../../src/lib/channels';

/**
 * Every channel's text colours clear WCAG AA against its field.
 *
 * The solver in src/lib/channels.ts already throws at build time when a mark
 * or an accent falls short. That guards the numbers; it cannot guard the
 * wiring. A section that lost its inline channel, or a stylesheet that paints
 * one channel's field under another's mark, still builds -- and axe reports
 * text over a photograph as "incomplete" rather than as a failure, which is
 * exactly where the colours now live. So this checks both ends: the solved
 * values, and what the browser actually painted.
 */

test.describe('the solved palette', () => {
	for (const name of CHANNELS) {
		test(`${name}: mark, dimmed mark and accent all clear ${AA}:1`, () => {
			const c = channel(name);
			for (const [role, colour] of [
				['mark', c.mark],
				['dimmed mark', c.markDim],
				['accent', c.accent],
			] as const) {
				const ratio = contrast(colour, c.field);
				expect(
					ratio,
					`${name} ${role} ${colour} on ${c.field}: ${ratio.toFixed(2)}:1`,
				).toBeGreaterThanOrEqual(AA);
			}
		});
	}

	// The two files that cannot read a custom property carry copies of the
	// palette. This is what keeps those copies from drifting.
	test('the manifest and the favicon use the palette, not stale colours', () => {
		const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
			theme_color: string;
			background_color: string;
		};
		expect(manifest.theme_color.toLowerCase()).toBe(PALETTE.ink);
		expect(manifest.background_color.toLowerCase()).toBe(PALETTE.ink);

		const palette = new Set<string>(Object.values(PALETTE));
		const svg = readFileSync('public/favicon.svg', 'utf8');
		const used = [...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
		expect(used.length, 'the favicon has no colours at all').toBeGreaterThan(0);
		for (const hex of used) expect(palette.has(hex), `favicon uses ${hex}`).toBe(true);
	});
});

type Painted = { where: string; channel: string; color: string; background: string };

/** The painted text and field colour of every channel region on the page. */
const paintedRegions = (page: Page): Promise<Painted[]> =>
	page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('[data-channel]')].map((el) => {
			const cs = getComputedStyle(el);
			return {
				where: el.id || el.className || el.tagName.toLowerCase(),
				channel: el.dataset.channel ?? '',
				color: cs.color,
				background: cs.backgroundColor,
			};
		}),
	);

const toHex = (rgb: string): string => {
	const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
	if (!m) throw new Error(`not an rgb() colour: ${rgb}`);
	return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
};

for (const path of ['/', '/work/nlziet', '/work/chromecast', '/work/vamp', '/work/kijk', '/nope']) {
	test(`${path}: every channel region is painted in its own solved colours`, async ({ page }) => {
		await page.goto(path);
		const regions = await paintedRegions(page);
		expect(regions.length, `${path} has no channel regions`).toBeGreaterThan(0);

		for (const r of regions) {
			const solved = channel(r.channel as (typeof CHANNELS)[number]);
			expect(solved, `${r.where}: unknown channel "${r.channel}"`).toBeTruthy();
			expect(toHex(r.background), `${r.where}: field`).toBe(solved.field);
			expect(toHex(r.color), `${r.where}: mark`).toBe(solved.mark);
		}
	});
}

test('the page chrome changes channel with the section in view, even with reduced motion', async ({
	page,
}) => {
	// Reduced motion switches the section advance off. Channel publishing must
	// not go with it: on the yellow channel, chrome left in the ink channel's
	// paper marks would be about 1.2:1.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');

	const chrome = () =>
		page.evaluate(() => ({
			field: document.documentElement.style.getPropertyValue('--field').trim(),
			theme: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content,
		}));

	expect((await chrome()).theme).toBe(PALETTE.ink);

	await page.evaluate(() => document.getElementById('interlude-signal')?.scrollIntoView());
	await expect.poll(async () => (await chrome()).field).toBe(PALETTE.yellow);
	expect((await chrome()).theme).toBe(PALETTE.yellow);
});

test('moving through the programme guide retunes the page chrome', async ({ page }) => {
	// The guide changes channel while you look at it: the whole screen takes
	// the colours of the programme in focus, and the fixed chrome has to follow
	// or it is drawn in a channel that is no longer on screen.
	await page.goto('/#work');
	const field = () =>
		page.evaluate(() => document.documentElement.style.getPropertyValue('--field').trim());

	await expect.poll(field).toBe(PALETTE.crimson);
	await restOn(page, 'chromecast');
	await expect.poll(field).toBe(PALETTE.ultramarine);
	await restOn(page, 'vamp');
	await expect.poll(field).toBe(PALETTE.navy);
});
