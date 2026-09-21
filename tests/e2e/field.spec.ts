import { test, expect, type Page } from '@playwright/test';

/** Instrument requestAnimationFrame before any page script runs. */
async function instrument(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as unknown as { __raf: number; __pending: number; __maxPending: number };
		w.__raf = 0;
		w.__pending = 0;
		w.__maxPending = 0;
		const raf = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
			w.__raf += 1;
			w.__pending += 1;
			if (w.__pending > w.__maxPending) w.__maxPending = w.__pending;
			return raf((t) => {
				w.__pending -= 1;
				cb(t);
			});
		};
	});
}

const layers = (page: Page) =>
	page.evaluate(() => {
		const a = document.querySelector('[data-layer="a"]')?.textContent ?? '';
		const b = document.querySelector('[data-layer="b"]')?.textContent ?? '';
		return { a, b };
	});

test.describe('character field', () => {
	test('the grid never shears', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1200);
		const { a, b } = await layers(page);

		for (const [name, text] of [
			['a', a],
			['b', b],
		] as const) {
			const lines = text.split('\n');
			const widths = [...new Set(lines.map((l) => l.length))];
			// A ligature fusing '==' into one glyph, or a character missing from
			// the font and falling back with a different advance, shows up here
			// as a line of a different length.
			expect(widths, `layer ${name} has ragged line lengths: ${widths.join(',')}`).toHaveLength(1);
			expect(lines.length).toBeGreaterThan(8);
		}
	});

	test('the two layers never occupy the same cell', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1200);
		const { a, b } = await layers(page);
		expect(a.length).toBe(b.length);

		let overlaps = 0;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== '\n' && a[i] !== ' ' && b[i] !== ' ') overlaps += 1;
		}
		// The colour split IS the resolve state, so a cell belongs to exactly
		// one layer. Any overlap means the mask and the render disagree.
		expect(overlaps, 'cells rendered into both colour layers').toBe(0);
	});

	test('the ramp stays ASCII', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1200);
		const { a, b } = await layers(page);
		// Anything outside printable ASCII risks a per-glyph font fallback with
		// an unconstrained advance width, which shears the grid.
		expect(/^[\x20-\x7E\n]*$/.test(a + b), 'non-ASCII characters in the field').toBe(true);
	});

	test('it decodes from noise into the portrait', async ({ page }) => {
		await page.goto('/');

		const progress = async (): Promise<number> =>
			Number((await page.locator('[data-character-field]').getAttribute('data-resolve')) ?? '-1');

		// Character counts cannot measure this: a resolved cell whose portrait
		// luminance is black renders a space, so it looks unresolved. The
		// renderer publishes its actual progress instead.
		await page.waitForTimeout(1000);
		const early = await progress();
		await page.waitForTimeout(3800);
		const late = await progress();

		expect(early, `expected noise early, got p=${early}`).toBeLessThan(0.35);
		expect(late, `expected a resolved portrait, got p=${late}`).toBeGreaterThan(0.9);
	});

	test('exactly one animation loop, throttled to 30fps', async ({ page }) => {
		await instrument(page);
		await page.goto('/');
		await page.waitForTimeout(700);

		// Count RENDERS, not rAF calls. The loop must schedule a frame every
		// display refresh in order to sample time; it throttles the work, not
		// the scheduling. Counting rAF would measure the monitor, not us.
		const renders = await page.evaluate(
			() =>
				new Promise<number>((resolve) => {
					let n = 0;
					const target = document.querySelector('[data-layer="a"]');
					if (!target) return resolve(-1);
					const mo = new MutationObserver((records) => {
						n += records.length;
					});
					mo.observe(target, { characterData: true, childList: true, subtree: true });
					setTimeout(() => {
						mo.disconnect();
						resolve(n);
					}, 2000);
				}),
		);

		const maxPending = await page.evaluate(
			() => (window as unknown as { __maxPending: number }).__maxPending,
		);

		// ~60 renders in 2s at 30fps. Two loops would roughly double it; a lost
		// throttle would push it to ~120; a dead loop would leave it near zero.
		expect(renders, `${renders} renders in 2s — expected ~60 (30fps)`).toBeGreaterThan(35);
		expect(renders, `${renders} renders in 2s — expected ~60 (30fps)`).toBeLessThan(95);
		expect(maxPending, 'more than one frame scheduled at a time').toBeLessThanOrEqual(1);
	});

	test('it stops when scrolled offscreen', async ({ page }) => {
		await instrument(page);
		await page.goto('/');
		await page.waitForTimeout(800);

		await page.evaluate(() => window.scrollTo(0, 4000));
		await page.waitForTimeout(700); // let the observer fire and unsubscribe

		const a = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
		await page.waitForTimeout(1500);
		const b = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);

		expect(b - a, 'the loop kept running with the hero offscreen').toBeLessThan(5);
	});

	test('reduced motion shows the resolved portrait and never animates', async ({ browser }) => {
		const context = await browser.newContext({ reducedMotion: 'reduce' });
		const page = await context.newPage();
		await instrument(page);
		await page.goto('/');
		await page.waitForTimeout(1500);

		const state = await page.evaluate(() => ({
			raf: (window as unknown as { __raf: number }).__raf,
			mode: document.querySelector<HTMLElement>('[data-character-field]')?.dataset.fieldState,
			chars: document.querySelector('[data-layer="a"]')?.textContent?.length ?? 0,
		}));

		expect(state.raf, 'reduced motion should schedule no frames at all').toBe(0);
		expect(state.mode).toBe('static');
		// Not a blank box: it is the real, fully-resolved portrait.
		expect(state.chars).toBeGreaterThan(1000);

		await context.close();
	});

	test('without JavaScript the hero still shows the portrait', async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto('/');

		const chars = await page.locator('[data-layer="a"]').innerText();
		expect(chars.length, 'no-JS hero is empty').toBeGreaterThan(1000);
		expect(chars.split('\n').length).toBeGreaterThan(8);

		await context.close();
	});

	test('the field is hidden from assistive technology and is not selectable', async ({ page }) => {
		await page.goto('/');
		const host = page.locator('[data-character-field]');
		await expect(host).toHaveAttribute('aria-hidden', 'true');

		const style = await host.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { select: cs.userSelect || cs.webkitUserSelect, events: cs.pointerEvents };
		});
		// A triple-click must not paint ::selection across the whole hero, and
		// the field must never intercept a click meant for the page.
		expect(style.select).toBe('none');
		expect(style.events).toBe('none');
	});

	test('exactly one field on the site, and no canvas anywhere', async ({ page }) => {
		for (const [path, expected] of [
			['/', 1],
			['/work/vamp', 0],
		] as const) {
			await page.goto(path);
			const counts = await page.evaluate(() => ({
				fields: document.querySelectorAll('[data-character-field]').length,
				canvases: document.querySelectorAll('canvas').length,
			}));
			expect(counts.fields, `${path} field count`).toBe(expected);
			expect(counts.canvases, `${path} should ship no canvas`).toBe(0);
		}
	});
});
