import { test, expect, type Page } from '@playwright/test';

/**
 * The remote: arrow keys move focus to the nearest control that way, like a
 * TV app's focus engine. The tests assert geometry, not card ids, so they hold
 * when the deck changes order.
 */

const ready = async (page: Page, width: number): Promise<void> => {
	await page.setViewportSize({ width, height: 900 });
	await page.goto('/');
	await page.waitForFunction(() => !document.documentElement.classList.contains('will-deal'));
	await page.waitForTimeout(900); // the deal
};

/** The focused element's card, and that card's box. */
const focused = (page: Page) =>
	page.evaluate(() => {
		const a = document.activeElement;
		const slot = a?.closest<HTMLElement>('[data-card]');
		// The largest piece, as table.ts measures: WebKit splits a tilted card at
		// the top of a column across the column break.
		const r = slot
			? [...slot.getClientRects()].reduce((a, b) =>
					b.width * b.height > a.width * a.height ? b : a,
				)
			: undefined;
		return {
			card: slot?.dataset.card ?? null,
			cls: a?.className ?? '',
			x: r ? r.left + r.width / 2 : 0,
			y: r ? r.top + r.height / 2 + scrollY : 0,
			right: r?.right ?? 0,
			bottom: r ? r.bottom + scrollY : 0,
		};
	});

test('with nothing focused, the first arrow lands on the top-left card in view', async ({
	page,
}) => {
	await ready(page, 1366);
	await expect(page.locator('body')).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('[data-card="rick"] .turn')).toBeFocused();

	// Scrolled down the table, it lands on a card in view, not back at the top.
	await page.evaluate(() => {
		(document.activeElement as HTMLElement | null)?.blur();
		scrollTo(0, document.documentElement.scrollHeight / 2);
	});
	const scrolled = await page.evaluate(() => scrollY);
	await page.keyboard.press('ArrowRight');
	const landed = page.locator(':focus');
	await expect(landed).toBeInViewport();
	expect(await landed.evaluate((el) => !!el.closest('.table'))).toBe(true);
	expect(await page.evaluate(() => scrollY)).toBe(scrolled);

	// A click on the paper focuses `main` (the skip link's target); the arrow still lands on a card.
	await page.locator('main').focus();
	await page.keyboard.press('ArrowDown');
	expect(await page.locator(':focus').evaluate((el) => !!el.closest('.table .slot'))).toBe(true);

	// A modifier keeps the arrow's usual job.
	await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
	await page.keyboard.press('Shift+ArrowDown');
	await expect(page.locator('body')).toBeFocused();
});

test('1366px: Right and Down move focus to the next card that way', async ({ page }) => {
	await ready(page, 1366);
	await page.locator('[data-card="rick"] .turn').focus();
	const start = await focused(page);

	await page.keyboard.press('ArrowRight');
	const right = await focused(page);
	expect(right.card).not.toBe(start.card);
	expect(right.cls).toBe('turn');
	expect(right.x).toBeGreaterThan(start.right);

	await page.keyboard.press('ArrowDown');
	const down = await focused(page);
	expect(down.card).not.toBe(right.card);
	expect(down.y).toBeGreaterThan(right.bottom - 1);

	await page.keyboard.press('ArrowUp');
	expect((await focused(page)).card).toBe(right.card);
});

test('375px: one column, Left and Right stay, Down steps to the next card', async ({ page }) => {
	await ready(page, 375);
	const turns = page.locator('.table .slot .turn');
	await turns.first().focus();
	const first = await focused(page);

	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowLeft');
	expect((await focused(page)).card).toBe(first.card);

	for (let i = 1; i <= 3; i++) {
		await page.keyboard.press('ArrowDown');
		await expect(turns.nth(i)).toBeFocused();
	}
	await expect(turns.nth(3)).toBeInViewport();
});

test('an open card keeps focus until nothing on it lies that way', async ({ page }) => {
	await ready(page, 1366);
	const slot = page.locator('[data-card="sleeve"]');
	await slot.locator('.turn').focus();
	await page.keyboard.press('Enter');
	await expect(slot.locator('.turn-back')).toBeFocused();

	await page.keyboard.press('ArrowDown');
	await expect(slot.locator('.back a.go').first()).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await expect(slot.locator('.turn-back')).toBeFocused();

	await page.keyboard.press('Escape');
	await expect(slot.locator('.turn')).toBeFocused();
});

test('the liner scrolls under Down before the arrow moves on', async ({ page }) => {
	await ready(page, 1366);
	const slot = page.locator('[data-card="how-i-work"]');
	await slot.locator('.turn').focus();
	await page.keyboard.press('Enter');
	const region = slot.locator('.scroll');
	await region.focus();
	await page.keyboard.press('ArrowDown');
	await expect(region).toBeFocused();
	await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

	// At its end, Down leaves the card.
	await region.evaluate((el) => (el.scrollTop = el.scrollHeight));
	await page.keyboard.press('ArrowDown');
	await expect(region).not.toBeFocused();
	expect((await focused(page)).card).not.toBe('how-i-work');
});
