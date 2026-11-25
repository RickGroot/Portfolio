import { test, expect, type Page } from '@playwright/test';

/**
 * Drag: on a wide screen a mouse can move a card about the table. The click
 * that ends a drag must not turn the card, a press that does not travel past
 * the threshold is still a click, and a narrow screen does not drag at all
 * (a finger scrolls the page there). See src/scripts/table.ts.
 */
async function firstCard(page: Page, width: number) {
	await page.setViewportSize({ width, height: 900 });
	await page.goto('/');
	await page.waitForTimeout(900); // the deal
	const slot = page.locator('[data-card]').first();
	await slot.scrollIntoViewIfNeeded();
	const turn = slot.locator('.turn');
	const box = await turn.boundingBox();
	if (!box) throw new Error('the first card has no .turn on screen');
	return { slot, turn, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 12 });
	await page.mouse.up();
}

test('1366px: a mouse drags a card, and letting go does not turn it', async ({ page }) => {
	const { slot, x, y } = await firstCard(page, 1366);
	const before = await slot.boundingBox();
	await drag(page, { x, y }, { x: 120, y: 60 });

	await expect(slot).not.toHaveClass(/is-flipped/);
	await expect(slot).not.toHaveClass(/is-dragging/);
	expect(await slot.evaluate((el) => el.style.getPropertyValue('--dx'))).toBe('120px');
	expect(await slot.evaluate((el) => el.style.getPropertyValue('--dy'))).toBe('60px');
	await page.mouse.move(5, 5); // off the card, so its tilt settles
	const after = await slot.boundingBox();
	expect(after!.x - before!.x).toBeCloseTo(120, -1);
	expect(after!.y - before!.y).toBeCloseTo(60, -1);
});

test('1366px: a second drag carries on from where the card was left', async ({ page }) => {
	const { slot, x, y } = await firstCard(page, 1366);
	await drag(page, { x, y }, { x: 80, y: 0 });
	await page.waitForTimeout(100); // past the swallowed click
	await drag(page, { x: x + 80, y }, { x: 40, y: 30 });
	expect(await slot.evaluate((el) => el.style.getPropertyValue('--dx'))).toBe('120px');
	expect(await slot.evaluate((el) => el.style.getPropertyValue('--dy'))).toBe('30px');
});

test('1366px: a press that hardly moves is a click, and turns the card', async ({ page }) => {
	const { slot, x, y } = await firstCard(page, 1366);
	await drag(page, { x, y }, { x: 3, y: 0 });
	await expect(slot).toHaveClass(/is-flipped/);
	expect(await slot.evaluate((el) => el.style.getPropertyValue('--dx'))).toBe('');
});

test('375px: a narrow screen does not drag', async ({ page }) => {
	const { slot, x, y } = await firstCard(page, 375);
	await drag(page, { x, y }, { x: 60, y: 0 });
	expect(await slot.evaluate((el) => el.style.getPropertyValue('--dx'))).toBe('');
});
