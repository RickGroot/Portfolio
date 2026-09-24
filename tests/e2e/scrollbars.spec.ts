import { test, expect } from '@playwright/test';

/**
 * With a classic scrollbar, as in Chrome on Windows. Playwright hides
 * scrollbars by default, and with them hidden 100vw is exactly the page's
 * width -- so every other test passed while every band on the one-pager was
 * 15px wider than the page on Windows, and the page scrolled sideways. The old
 * check compared scrollWidth with innerWidth, which counts the scrollbar too,
 * and could not have caught it.
 *
 * Top level, not in a describe: launch options need a worker of their own.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const ROUTES = ['/', '/work/nlziet'];
const SIZES = [
	{ w: 1920, h: 1080 },
	{ w: 1366, h: 657 },
];

for (const { w, h } of SIZES) {
	for (const route of ROUTES) {
		test(`${w}x${h} ${route}: no sideways scroll, and every band is the page's width`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: w, height: h });
			await page.goto(route);
			const m = await page.evaluate(() => {
				const root = document.documentElement;
				const bands = [...document.querySelectorAll<HTMLElement>('[data-section], .info')].map(
					(el) => {
						const r = el.getBoundingClientRect();
						return { id: el.id || el.className, left: r.left, width: r.width };
					},
				);
				return {
					scrollbar: window.innerWidth - root.clientWidth,
					scrollWidth: root.scrollWidth,
					clientWidth: root.clientWidth,
					bands,
				};
			});
			test.skip(m.scrollbar === 0, 'overlay scrollbars on this platform: nothing to measure');

			expect(m.scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(m.clientWidth);
			expect(m.bands.length).toBeGreaterThan(0);
			for (const band of m.bands) {
				expect(Math.abs(band.left), `${band.id} starts off the page`).toBeLessThan(0.5);
				expect(
					Math.abs(band.width - m.clientWidth),
					`${band.id} is ${band.width}px on a ${m.clientWidth}px page`,
				).toBeLessThan(0.5);
			}
		});
	}
}
