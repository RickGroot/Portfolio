import { test, expect, type CDPSession, type Page } from '@playwright/test';

/**
 * Changing channel with a finger (src/scripts/sections.ts), on a phone.
 *
 * Nothing tested touch until 2026-09-29, when a measured run found the phone
 * paging broken three ways: a slow drag off the foot of the guide landed on How
 * I work, skipping the Signal interlude, five in five; a swipe back up from the
 * Field interlude skipped How I work the other way; and a short drag left the
 * page between two channels. The gestures here are real ones, synthesised by
 * the browser's own input pipeline, so the page scrolls natively under the
 * finger exactly as it does on a device. What they cannot give is a device's
 * fling after the finger lifts: that is for a real phone.
 */

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const H = 844;

type Geo = Record<string, { top: number; h: number }>;
const geometry = (page: Page): Promise<Geo> =>
	page.evaluate(() =>
		Object.fromEntries(
			[...document.querySelectorAll<HTMLElement>('[data-section]')].map((s) => [
				s.id,
				{ top: s.offsetTop, h: s.offsetHeight },
			]),
		),
	);

async function jump(page: Page, y: number): Promise<void> {
	await page.evaluate((top) => {
		const root = document.documentElement;
		root.style.scrollBehavior = 'auto';
		window.scrollTo(0, top);
		root.style.scrollBehavior = '';
	}, y);
	// Let the observer catch up with where the page now is.
	await page.waitForTimeout(400);
}

/**
 * A finger drag made of real touch events: down, a move every frame, up.
 * Negative dy moves the page down, as a finger travelling up the screen does.
 *
 * Not Input.synthesizeScrollGesture: its touch gesture did not scroll the page
 * under the finger at all, and a repeatCount of 1 performs it twice -- which
 * read as a skipped channel before the finger's own drag was ever tested.
 */
async function swipe(
	page: Page,
	cdp: CDPSession,
	dy: number,
	opts: { dx?: number; ms?: number } = {},
): Promise<void> {
	const dx = opts.dx ?? 0;
	const ms = opts.ms ?? 700;
	const x0 = dx < 0 ? 350 : 195;
	const y0 = dy < 0 ? 700 : 150;
	const steps = Math.max(2, Math.round(ms / 16));
	await cdp.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x: x0, y: y0 }],
	});
	for (let i = 1; i <= steps; i++) {
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps }],
		});
		await page.waitForTimeout(ms / steps);
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Where the page comes to rest: scrollY once it has stopped moving. */
async function rest(page: Page): Promise<number> {
	let last = -1;
	let still = 0;
	for (let i = 0; i < 60 && still < 4; i++) {
		await page.waitForTimeout(100);
		const y = await page.evaluate(() => Math.round(window.scrollY));
		still = y === last ? still + 1 : 0;
		last = y;
	}
	return last;
}

async function open(page: Page): Promise<{ cdp: CDPSession; geo: Geo }> {
	await page.goto('/', { waitUntil: 'networkidle' });
	const cdp = await page.context().newCDPSession(page);
	return { cdp, geo: await geometry(page) };
}

test('a slow drag off the foot of the guide lands on the next channel, not the one after', async ({
	page,
}) => {
	const { cdp, geo } = await open(page);
	expect(
		geo.work!.h,
		'the guide fits the phone: this no longer tests the tall case',
	).toBeGreaterThan(H);
	await jump(page, geo.work!.top + geo.work!.h - H);
	await swipe(page, cdp, -520, { ms: 1300 });
	expect(await rest(page)).toBe(geo['interlude-signal']!.top);
});

// On a channel that fits the screen: an interlude. The masthead used to be
// one, until it became a programme (2026-10-14); on a phone its screen, copy
// and soundtrack run taller than the screen, and a channel that tall scrolls
// by hand, as How I work does.
test('a short drag settles back on its channel', async ({ page }) => {
	const { cdp, geo } = await open(page);
	await jump(page, geo['interlude-signal']!.top);
	await swipe(page, cdp, -40, { ms: 300 });
	expect(await rest(page), 'the page was left between two channels').toBe(
		geo['interlude-signal']!.top,
	);
});

test('swiping back up into a channel taller than the screen shows its foot', async ({ page }) => {
	const { cdp, geo } = await open(page);
	expect(geo.practice!.h).toBeGreaterThan(H);
	await jump(page, geo['interlude-field']!.top);
	await swipe(page, cdp, 520);
	expect(await rest(page)).toBe(geo.practice!.top + geo.practice!.h - H);
});

test('swiping on into a tall channel starts at its top', async ({ page }) => {
	const { cdp, geo } = await open(page);
	await jump(page, geo['interlude-signal']!.top);
	await swipe(page, cdp, -520);
	expect(await rest(page)).toBe(geo.practice!.top);
});

test('a sideways swipe does not change channel', async ({ page }) => {
	const { cdp, geo } = await open(page);
	await jump(page, geo['interlude-signal']!.top);
	await swipe(page, cdp, -60, { dx: -300 });
	expect(await rest(page)).toBe(geo['interlude-signal']!.top);
});
