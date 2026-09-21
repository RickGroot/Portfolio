import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The hero bleeds the full viewport width so the character field can fill it.
 * That made its copy re-centre in the viewport rather than align to the page
 * column, leaving the h1 221px right of every heading below it -- obvious on
 * screen, invisible to every other test we had.
 */
test('the hero copy aligns to the same column as the rest of the page', async ({ page }) => {
	await page.goto('/');

	const left = async (selector: string): Promise<number> =>
		(await page.locator(selector).first().boundingBox())?.x ?? -1;

	const main = await left('main#main');
	const h1 = await left('.hero__copy h1');
	const lede = await left('.hero .lede');
	const featured = await left('#featured-heading');
	const contact = await left('#contact-heading');

	for (const [name, x] of [
		['hero h1', h1],
		['hero lede', lede],
		['Selected work', featured],
		['Contact', contact],
	] as const) {
		expect(
			Math.abs(x - main),
			`${name} is ${Math.round(x - main)}px off the page column`,
		).toBeLessThan(2);
	}
});

test('the full-bleed hero causes no horizontal overflow', async ({ page }) => {
	await page.goto('/');
	const overflow = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		inner: window.innerWidth,
	}));
	// margin-inline: calc(50% - 50vw) is easy to get wrong by a scrollbar width.
	expect(overflow.scrollWidth, 'the page scrolls sideways').toBeLessThanOrEqual(overflow.inner);
});

/**
 * <main> takes focus from the skip link. Ringing it drew a 2px box around the
 * whole page. The ring is suppressed for that one element only -- focus must
 * still move, and real controls must still be ringed.
 */
test.describe('skip link', () => {
	test('moves focus to main without ringing the entire page', async ({ page }) => {
		await page.goto('/');

		await page.keyboard.press('Tab');
		const skipFocused = await page.evaluate(
			() => document.activeElement?.className === 'skip-link',
		);
		expect(skipFocused, 'the skip link is not the first tab stop').toBe(true);

		// It must actually be visible once focused, not merely present.
		const box = await page.locator('.skip-link').boundingBox();
		expect(box, 'the focused skip link has no box').not.toBeNull();
		expect(box!.y, 'the focused skip link is still offscreen').toBeGreaterThanOrEqual(0);

		await page.keyboard.press('Enter');

		const after = await page.evaluate(() => {
			const main = document.querySelector('main#main');
			return {
				focusMoved: document.activeElement === main,
				mainOutline: main ? getComputedStyle(main).outlineStyle : 'missing',
			};
		});

		expect(after.focusMoved, 'the skip link did not move focus to main').toBe(true);
		expect(after.mainOutline, 'main should not draw a page-sized focus ring').toBe('none');
	});

	test('real controls still show a focus ring', async ({ page }) => {
		await page.goto('/');
		// Suppressing the ring on the skip destination must not leak to anything
		// a user can actually operate.
		for (const selector of ['nav a', 'footer a']) {
			const style = await page
				.locator(selector)
				.first()
				.evaluate((el) => {
					(el as HTMLElement).focus();
					const cs = getComputedStyle(el);
					return { style: cs.outlineStyle, width: cs.outlineWidth };
				});
			expect(style.style, `${selector} lost its focus ring`).not.toBe('none');
			expect(parseFloat(style.width), `${selector} focus ring has no width`).toBeGreaterThan(0);
		}
	});
});
