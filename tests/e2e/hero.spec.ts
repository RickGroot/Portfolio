import { test, expect } from '@playwright/test';

/**
 * The masthead (src/components/Hero.astro): channel 01 as the first programme
 * in the guide. It says who and what at once, offers the two ways on, prints
 * Rick's photograph in one bit, and plays its soundtrack as a tracker pattern
 * -- server-rendered, so it is all there without JavaScript.
 */

test.describe('the masthead', () => {
	test('says who and what, and offers the work and a way in touch', async ({ page }) => {
		await page.goto('/');
		const hero = page.locator('#top');
		await expect(hero.getByRole('heading', { level: 1 })).toHaveText(/Rick Groot/i);
		await expect(hero.getByText('Connected TV developer · Trumpet')).toBeVisible();
		await expect(hero.getByRole('link', { name: /See the work/i })).toHaveAttribute(
			'href',
			'#work',
		);
		await expect(hero.getByRole('link', { name: /Get in touch/i })).toHaveAttribute(
			'href',
			'#contact',
		);
		await expect(hero.getByRole('img', { name: /Rick Groot/ })).toBeVisible();
	});

	test('the work button takes you to the guide', async ({ page }) => {
		await page.goto('/');
		await page
			.locator('#top')
			.getByRole('link', { name: /See the work/i })
			.click();
		await expect
			.poll(() =>
				page.evaluate(() =>
					Math.round(document.getElementById('work')!.getBoundingClientRect().top),
				),
			)
			.toBeLessThanOrEqual(1);
	});

	test('the soundtrack is there without JavaScript', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto('/');
		const now = page.locator('#top .hero__now');
		await expect(now).toHaveText(/^00 \|/);
		await expect(page.locator('#top [data-rows]')).toHaveCount(5);
		await context.close();
	});

	test('the soundtrack steps in tempo', async ({ page }) => {
		await page.goto('/');
		const now = page.locator('#top .hero__now');
		const first = await now.textContent();
		// 112 bpm, two rows a beat: a row every 268 ms.
		await expect.poll(() => now.textContent(), { timeout: 3000 }).not.toBe(first);
	});

	test.describe('under reduced motion', () => {
		test.use({ reducedMotion: 'reduce' });

		test('the soundtrack holds its first row', async ({ page }) => {
			await page.goto('/');
			const now = page.locator('#top .hero__now');
			await page.waitForTimeout(1200);
			await expect(now).toHaveText(/^00 \|/);
		});
	});

	test('the screen is Rick’s photograph in the 1-bit print', async ({ page }) => {
		await page.addInitScript(() => {
			(window as unknown as { __ditherSoftware: boolean }).__ditherSoftware = true;
		});
		await page.goto('/');
		const screen = page.locator('#top .hero__screen');
		await expect(screen).toHaveAttribute('data-dither', 'on');
		await expect(screen.locator('canvas')).toHaveCount(1);
	});
});
