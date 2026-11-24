import { test, expect } from '@playwright/test';

/**
 * A back has a fixed height and must not scroll; only the liner does. Body
 * text has a 10.5px floor, so on a narrow phone a full back (VAMP's sleeve,
 * a listing) runs out of height first. The back is laid out while it faces
 * away, so it can be measured without turning the card.
 */
const WIDTHS = [320, 375, 1366];

for (const w of WIDTHS) {
	test(`${w}px: no card back scrolls, except the liner`, async ({ page }) => {
		await page.setViewportSize({ width: w, height: 900 });
		await page.goto('/');
		await page.waitForTimeout(900); // the deal
		const over = await page.evaluate(() =>
			[...document.querySelectorAll<HTMLElement>('[data-card]:not(.liner)')].flatMap((slot) => {
				const bb = slot.querySelector<HTMLElement>('.card.back .bb');
				if (!bb) return [];
				const by = bb.scrollHeight - bb.clientHeight;
				return by > 1 ? [`${slot.dataset.card} by ${by}px`] : [];
			}),
		);
		expect(over, 'these backs scroll').toEqual([]);
	});
}
