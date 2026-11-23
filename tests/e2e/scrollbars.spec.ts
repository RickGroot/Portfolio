import { test, expect } from '@playwright/test';

/**
 * With a classic scrollbar, as in Chrome on Windows. Playwright hides
 * scrollbars by default; a layout that leaned on 100vw would scroll sideways
 * only where a scrollbar takes width. Top level: launch options need a worker
 * of their own.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const SIZES = [
	{ w: 1920, h: 1080 },
	{ w: 1366, h: 657 },
	{ w: 820, h: 900 },
	{ w: 375, h: 812 },
];

for (const { w, h } of SIZES) {
	test(`${w}x${h}: the table does not scroll sideways`, async ({ page }) => {
		await page.setViewportSize({ width: w, height: h });
		await page.goto('/');
		await page.waitForTimeout(900); // the deal
		const m = await page.evaluate(() => {
			const root = document.documentElement;
			return {
				scrollbar: window.innerWidth - root.clientWidth,
				scrollWidth: root.scrollWidth,
				clientWidth: root.clientWidth,
			};
		});
		expect(m.scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(m.clientWidth);
	});
}
