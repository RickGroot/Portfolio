import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

const SECTIONS = ['top', 'nlziet', 'chromecast', 'vamp', 'contact'];

test.describe('one-page sections', () => {
	test('every section fills the viewport', async ({ page }) => {
		await page.goto('/');
		const heights = await page.evaluate(() =>
			[...document.querySelectorAll('[data-section]')].map((s) =>
				Math.round(s.getBoundingClientRect().height),
			),
		);
		expect(heights).toHaveLength(SECTIONS.length);
		for (const h of heights) {
			expect(h, `a section is ${h}px against an 800px viewport`).toBeGreaterThanOrEqual(798);
		}
	});

	test('sections are in narrative order with stable ids', async ({ page }) => {
		await page.goto('/');
		const ids = await page.evaluate(() =>
			[...document.querySelectorAll('[data-section]')].map((s) => s.id),
		);
		// The ids are the deep-link targets and the rail hrefs. Renaming one
		// silently breaks both.
		expect(ids).toEqual(SECTIONS);
	});

	/**
	 * The advance is scroll-jacking, which the brief rules out. It was chosen
	 * anyway, so these tests exist to prove it cannot trap anyone.
	 */
	test.describe('cannot trap the user', () => {
		test('reduced motion disables it entirely', async ({ browser }) => {
			const context = await browser.newContext({
				reducedMotion: 'reduce',
				viewport: { width: 1280, height: 800 },
			});
			const page = await context.newPage();
			await page.goto('/');

			const state = await page.evaluate(() => ({
				booted: document.documentElement.dataset.sections ?? 'off',
				behavior: getComputedStyle(document.documentElement).scrollBehavior,
			}));

			expect(state.booted, 'section jacking must not run under reduced motion').toBe('off');
			expect(state.behavior, 'smooth scrolling must not be forced').toBe('auto');

			// And the page must still be a normal, fully scrollable document.
			await page.evaluate(() => window.scrollTo(0, 99999));
			const atBottom = await page.evaluate(
				() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4,
			);
			expect(atBottom, 'the page could not be scrolled to the bottom').toBe(true);
			await context.close();
		});

		test('the whole page is still reachable by keyboard', async ({ page }) => {
			await page.goto('/');
			// End must reach the last section, whatever the advance is doing.
			await page.keyboard.press('End');
			await page.waitForTimeout(900);
			const last = await page.evaluate(() => {
				const el = document.getElementById('contact');
				return el ? Math.round(el.getBoundingClientRect().top) : 99999;
			});
			expect(Math.abs(last), 'End did not land on the last section').toBeLessThan(120);

			await page.keyboard.press('Home');
			await page.waitForTimeout(900);
			expect(await page.evaluate(() => window.scrollY)).toBeLessThan(120);
		});

		test('every section is reachable one advance at a time', async ({ page }) => {
			await page.goto('/');
			for (let i = 1; i < SECTIONS.length; i++) {
				await page.keyboard.press('PageDown');
				await page.waitForTimeout(800);
			}
			const reachedEnd = await page.evaluate(() => {
				const el = document.getElementById('contact');
				return el ? el.getBoundingClientRect().top < 120 : false;
			});
			expect(reachedEnd, 'repeated advances did not reach the last section').toBe(true);
		});

		test('typing in a field is never hijacked', async ({ page }) => {
			await page.goto('/');
			// There is no form on the page yet, so synthesise one: the guard must
			// hold for any future input, not just the ones that exist today.
			await page.evaluate(() => {
				const input = document.createElement('input');
				input.id = 'probe';
				document.body.append(input);
				input.focus();
			});
			// focus() scrolls the new input into view, and scroll-behavior is
			// smooth, so let that finish before sampling -- otherwise the tail of
			// the focus scroll is misread as the key press moving the page.
			await page.waitForTimeout(900);
			const before = await page.evaluate(() => window.scrollY);
			await page.keyboard.press('ArrowDown');
			await page.waitForTimeout(600);
			const after = await page.evaluate(() => window.scrollY);
			// A small native scroll is the browser's own behaviour and fine. What
			// must never happen is the script advancing a whole section while
			// someone is typing.
			expect(
				Math.abs(after - before),
				'an arrow key inside an input advanced a section',
			).toBeLessThan(200);
		});
	});

	test('the rail is real navigation, not decoration', async ({ page }) => {
		await page.goto('/');
		const hrefs = await page.evaluate(() =>
			[...document.querySelectorAll('[data-rail] a')].map((a) => a.getAttribute('href')),
		);
		expect(hrefs).toEqual(SECTIONS.map((id) => `#${id}`));

		// Each target must exist, or the rail is a set of dead links.
		for (const id of SECTIONS) {
			await expect(page.locator(`#${id}`)).toHaveCount(1);
		}

		// Every dot needs an accessible name.
		const unnamed = await page.evaluate(
			() =>
				[...document.querySelectorAll('[data-rail] a')].filter(
					(a) => !(a.textContent ?? '').trim() && !a.getAttribute('aria-label'),
				).length,
		);
		expect(unnamed, 'rail dots without an accessible name').toBe(0);
	});

	test('deep links still land on the right section', async ({ page }) => {
		await page.goto('/#vamp');
		await page.waitForTimeout(700);
		const top = await page.evaluate(() => {
			const el = document.getElementById('vamp');
			return el ? Math.round(el.getBoundingClientRect().top) : 99999;
		});
		expect(Math.abs(top), '/#vamp did not land on the VAMP section').toBeLessThan(140);
	});
});

test.describe('work panels', () => {
	test('the dither clears on hover and on keyboard focus', async ({ page }) => {
		await page.goto('/#nlziet');
		await page.waitForTimeout(600);

		const dither = page.locator('#nlziet .panel__dither').first();
		const opacity = async (): Promise<number> =>
			Number(await dither.evaluate((el) => getComputedStyle(el).opacity));

		expect(await opacity(), 'the dither should be visible at rest').toBeGreaterThan(0.5);

		await page.locator('#nlziet .panel__title a').first().hover();
		await page.waitForTimeout(700);
		expect(await opacity(), 'the dither did not clear on hover').toBeLessThan(0.1);

		// Keyboard parity: focusing the title must do the same thing.
		await page.mouse.move(0, 0);
		await page.waitForTimeout(700);
		await page.locator('#nlziet .panel__title a').first().focus();
		await page.waitForTimeout(700);
		expect(await opacity(), 'the dither did not clear on focus').toBeLessThan(0.1);
	});

	test('the decorative media link is hidden from assistive technology', async ({ page }) => {
		await page.goto('/#nlziet');
		const media = page.locator('#nlziet .panel__media').first();
		// Two links to one destination is noise for a screen reader; the title
		// is the real one.
		await expect(media).toHaveAttribute('aria-hidden', 'true');
		await expect(media).toHaveAttribute('tabindex', '-1');
	});

	test('each panel still links to its own deep-linkable case study', async ({ page }) => {
		await page.goto('/');
		for (const id of ['nlziet', 'chromecast', 'vamp']) {
			const href = await page.locator(`#${id} .panel__title a`).first().getAttribute('href');
			expect(href, `${id} panel does not link to its case study`).toBe(`/work/${id}`);
		}
	});
});
