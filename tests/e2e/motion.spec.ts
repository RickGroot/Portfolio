import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

/** Vertical offset a layer's transform adds, in px. 0 when it has none. */
const offsetOf = (page: Page, selector: string): Promise<number> =>
	page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) throw new Error(`no element for ${sel}`);
		const t = getComputedStyle(el).transform;
		return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42;
	}, selector);

/**
 * Jump without the section advance's smooth scrolling in the way, then let a
 * frame pass: scroll-driven animations update in the frame after the scroll,
 * so a read in the same task still sees the old position.
 */
const jumpTo = async (page: Page, y: number): Promise<void> => {
	await page.evaluate((top) => {
		document.documentElement.style.scrollBehavior = 'auto';
		window.scrollTo(0, top);
	}, y);
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
	);
};

test.describe('parallax', () => {
	test('at rest every layer is exactly where the layout put it', async ({ page }) => {
		// A section at rest is halfway through its own view timeline, which is
		// where every depth is zero. If this drifts, the composition at rest is
		// no longer the one that was designed.
		await page.goto('/#work');
		for (const layer of [
			'.guide--screen .guide__bar',
			'.guide--screen [data-preview][data-active] .guide__info',
			'.guide--screen [data-preview][data-active] .guide__screen',
			'.guide--screen .guide__grid',
		]) {
			expect(
				Math.abs(await offsetOf(page, layer)),
				`${layer} is off its rest position`,
			).toBeLessThan(1.5);
		}
	});

	test('the layers of a section move at different depths as it scrolls', async ({ page }) => {
		await page.goto('/');
		expect(Math.abs(await offsetOf(page, '.hero__copy h1 > span:last-child'))).toBeLessThan(1.5);

		await jumpTo(page, 320);
		const rick = await offsetOf(page, '.hero__copy h1 > span:first-child');
		const groot = await offsetOf(page, '.hero__copy h1 > span:last-child');
		const field = await offsetOf(page, '.hero .field');

		// Scrolling down, a forward layer moves up faster than the page (a
		// negative offset) and a back layer lags behind it (positive). The
		// name's two words are two planes: GROOT is nearer than RICK.
		expect(rick, 'RICK should come forward').toBeLessThan(-4);
		expect(groot, 'GROOT should come further forward than RICK').toBeLessThan(rick);
		expect(field, 'the portrait should sit back').toBeGreaterThan(4);
	});

	test('a case study leaves in layers: the picture sinks, the title lifts', async ({ page }) => {
		await page.goto('/work/vamp');
		expect(Math.abs(await offsetOf(page, '.info__screen'))).toBeLessThan(1.5);
		expect(Math.abs(await offsetOf(page, '.info__titles'))).toBeLessThan(1.5);

		await jumpTo(page, 400);
		expect(await offsetOf(page, '.info__screen'), 'the picture should sink').toBeGreaterThan(4);
		expect(await offsetOf(page, '.info__titles'), 'the title should lift').toBeLessThan(-2);
	});

	test('reduced motion: nothing moves', async ({ browser }) => {
		const context = await browser.newContext({ reducedMotion: 'reduce' });
		const page = await context.newPage();
		await page.goto('/');
		await jumpTo(page, 320);
		for (const layer of [
			'.hero__copy h1 > span:last-child',
			'.hero .field',
			'.guide--screen .guide__grid',
		]) {
			expect(await offsetOf(page, layer), `${layer} moved under reduced motion`).toBe(0);
		}
		await context.close();
	});
});

test.describe('changing channel', () => {
	test('shows the channel readout, then clears it', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(400);
		await page.keyboard.press('PageDown');

		const osd = page.locator('.osd');
		await expect(osd).toHaveCSS('opacity', '1');
		await expect(osd.locator('.osd__num')).toHaveText('02');
		// The name decodes in, so wait for it to resolve rather than sampling it.
		await expect(osd.locator('.osd__name')).toHaveText('Guide');
		await expect(osd).toHaveCSS('opacity', '0', { timeout: 5000 });
	});

	test('the new channel decodes its headline, and never leaves noise behind', async ({ page }) => {
		await page.goto('/#interlude-signal');
		// Record every text the heading shows, from before the change.
		await page.evaluate(() => {
			const h = document.getElementById('practice-heading') as HTMLElement;
			const seen: string[] = [];
			(window as unknown as { __seen: string[] }).__seen = seen;
			new MutationObserver(() => seen.push(h.textContent ?? '')).observe(h, {
				subtree: true,
				characterData: true,
				childList: true,
			});
		});
		await page.keyboard.press('PageDown');
		await page.waitForTimeout(1500);

		const { seen, text, label } = await page.evaluate(() => {
			const h = document.getElementById('practice-heading') as HTMLElement;
			return {
				seen: (window as unknown as { __seen: string[] }).__seen,
				text: (h.textContent ?? '').trim(),
				label: h.getAttribute('aria-label'),
			};
		});
		expect(
			seen.some((s) => s.trim() !== 'How I work'),
			'the headline never decoded',
		).toBe(true);
		expect(text, 'noise was left in the headline').toBe('How I work');
		expect(label, 'the decode left its aria-label behind').toBeNull();
	});

	test('in the guide, the new ground wipes in and the chrome follows it', async ({ page }) => {
		await page.goto('/#work');
		await page.locator('#work [data-block="chromecast"]').hover();
		expect(
			await page.evaluate(
				() => document.querySelector('[data-guide-wipe]')?.getAnimations().length ?? 0,
			),
			'the ground did not wipe',
		).toBeGreaterThan(0);
		await expect
			.poll(() =>
				page.evaluate(
					() => getComputedStyle(document.getElementById('work') as HTMLElement).backgroundColor,
				),
			)
			.toBe('rgb(5, 0, 94)');
	});
});
