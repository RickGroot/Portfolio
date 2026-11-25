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

/**
 * Larger text must not lose anything (WCAG 1.4.4, 1.4.12): with text at 200%
 * and the 1.4.12 spacing, a back that no longer fits scrolls, and a keyboard
 * can reach it (2.1.1): a tab stop with a name. Nothing is cut off outside a
 * scroller.
 */
const SPACING = `html { font-size: 200% !important }
	* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important }
	p { margin-bottom: 2em !important }`;

for (const w of [375, 1366]) {
	test(`${w}px: with large, spaced text every back can still be read`, async ({ page }) => {
		await page.setViewportSize({ width: w, height: 900 });
		await page.goto('/');
		await page.waitForTimeout(900);
		await page.addStyleTag({ content: SPACING });
		// A reader's style sheet resizes no box, so focus entering a card checks it again.
		await page.evaluate(() => {
			for (const s of document.querySelectorAll('.slot')) {
				s.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
			}
		});
		const report = await page.evaluate(() => {
			const problems: string[] = [];
			let scrollers = 0;
			for (const back of document.querySelectorAll<HTMLElement>('.card.back')) {
				const card = back.closest<HTMLElement>('[data-card]')?.dataset.card ?? '?';
				for (const el of back.querySelectorAll<HTMLElement>('.bb, .np')) {
					if (el.scrollHeight - el.clientHeight <= 1) continue;
					scrollers++;
					const by = el.getAttribute('aria-labelledby');
					const named = by
						? (document.getElementById(by)?.textContent?.trim() ?? '')
						: (el.getAttribute('aria-label') ?? '');
					// Nothing may run sideways: Left and Right belong to the remote.
					if (el.scrollWidth - el.clientWidth > 1) problems.push(`${card}: scrolls sideways`);
					if (el.tabIndex !== 0 || el.getAttribute('role') !== 'region' || !named) {
						problems.push(`${card}: overflows but is not a named tab stop`);
					}
				}
				const box = back.getBoundingClientRect();
				for (const el of back.querySelectorAll<HTMLElement>('h2, h3, p, li, dt, dd, a, button')) {
					if (el.closest('.scroll, .is-long')) continue;
					const r = el.getBoundingClientRect();
					if (r.height && (r.bottom > box.bottom + 1 || r.right > box.right + 1)) {
						problems.push(`${card}: ${el.tagName.toLowerCase()} cut off`);
					}
				}
			}
			return { problems, scrollers };
		});
		expect(report.problems).toEqual([]);
		expect(report.scrollers, 'the larger text should make some backs scroll').toBeGreaterThan(1);
	});
}

test('under large text the torn stub scrolls each control it focuses into view', async ({
	page,
}) => {
	await page.setViewportSize({ width: 375, height: 900 });
	await page.goto('/');
	await page.waitForTimeout(900);
	// Sealed, the stub's back is a narrow strip turned away: never a tab stop.
	const bk = page.locator('[data-card="contact"] .stub.bk');
	await page.addStyleTag({ content: 'html { font-size: 200% !important }' });
	await page.locator('[data-card="contact"]').dispatchEvent('focusin');
	await expect(bk).not.toHaveAttribute('tabindex');
	await page.locator('.stub.fr.tear').click();
	for (let i = 0; i < 4; i++) {
		const clipped = await page.evaluate(() => {
			const a = document.activeElement;
			const box = a?.closest('.stub.bk');
			if (!a || !box) return 'focus left the stub';
			const r = a.getBoundingClientRect();
			const b = box.getBoundingClientRect();
			return r.top < b.top - 1 || r.bottom > b.bottom + 1 ? a.textContent?.trim() : '';
		});
		expect(clipped, 'a focused control is cut off by the stub').toBe('');
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(60);
	}
});

test('the remote scrolls a long back, then reaches its links', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 900 });
	await page.goto('/');
	await page.waitForTimeout(900);
	await page.addStyleTag({ content: 'html { font-size: 200% !important }' });
	const vamp = page.locator('[data-card="vamp"]');
	await vamp.locator('.turn').click();
	await expect(vamp.locator('.turn-back')).toBeFocused();
	const body = vamp.locator('.bb.is-long');
	await page.keyboard.press('ArrowDown');
	await expect(body).toBeFocused();
	// Down scrolls the body to its end, then moves to its first link.
	for (let i = 0; i < 40; i++) {
		const link = await vamp
			.locator('.go')
			.first()
			.evaluate((el) => el === document.activeElement);
		if (link) break;
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(60);
	}
	await expect(vamp.locator('.go').first()).toBeFocused();
	expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});
