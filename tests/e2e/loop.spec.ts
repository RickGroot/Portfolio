import { test, expect, type Page } from '@playwright/test';

/**
 * The one animation loop (src/lib/field/loop.ts), held to its budget in
 * CLAUDE.md: exactly one, never more than 60 frames a second, stopped when
 * nothing that moves is on screen.
 *
 * These lived in field.spec.ts and counted the character field's renders,
 * until the field was retired with the test card (2026-10-14). What moves now
 * is the 1-bit print -- the masthead's screen, the guide, the photographs --
 * and the masthead's tracker, so they count the print's frames: draws of a
 * WebGL2 context, on headless Chromium's software GPU, which the print is
 * told to accept.
 */

async function setUp(page: Page, opts: { rafAt?: number } = {}): Promise<void> {
	await page.addInitScript((rafAt) => {
		const w = window as unknown as {
			__ditherSoftware: boolean;
			__raf: number;
			__pending: number;
			__maxPending: number;
			__draws: number;
		};
		w.__ditherSoftware = true;
		w.__raf = 0;
		w.__pending = 0;
		w.__maxPending = 0;
		w.__draws = 0;

		const draw = WebGL2RenderingContext.prototype.drawArrays;
		WebGL2RenderingContext.prototype.drawArrays = function (
			this: WebGL2RenderingContext,
			...args: Parameters<typeof draw>
		) {
			w.__draws += 1;
			return draw.apply(this, args);
		};

		// A display at `rafAt` Hz, where asked; else the browser's own.
		const native = window.requestAnimationFrame.bind(window);
		const timers = new Map<number, number>();
		let next = 0;
		const schedule = (cb: FrameRequestCallback): number => {
			if (!rafAt) return native(cb);
			next += 1;
			const handle = next;
			timers.set(
				handle,
				window.setTimeout(() => {
					timers.delete(handle);
					cb(performance.now());
				}, 1000 / rafAt),
			);
			return handle;
		};
		window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
			w.__raf += 1;
			w.__pending += 1;
			if (w.__pending > w.__maxPending) w.__maxPending = w.__pending;
			return schedule((t) => {
				w.__pending -= 1;
				cb(t);
			});
		};
		if (rafAt) {
			window.cancelAnimationFrame = (handle: number): void => {
				window.clearTimeout(timers.get(handle));
				timers.delete(handle);
			};
		}
	}, opts.rafAt ?? 0);
}

const read = (page: Page, key: '__raf' | '__draws' | '__maxPending'): Promise<number> =>
	page.evaluate((k) => (window as unknown as Record<string, number>)[k] ?? 0, key);

async function countOver(page: Page, key: '__raf' | '__draws', ms: number): Promise<number> {
	const a = await read(page, key);
	await page.waitForTimeout(ms);
	return (await read(page, key)) - a;
}

test.describe('the one loop', () => {
	// Small: the software GPU draws every frame on the CPU.
	test.use({ viewport: { width: 800, height: 600 } });

	test('exactly one loop: never two frames scheduled at once, and it is alive', async ({
		page,
	}) => {
		await setUp(page);
		await page.goto('/');
		await expect(page.locator('#top .hero__screen')).toHaveAttribute('data-dither', 'on');
		const draws = await countOver(page, '__draws', 2000);
		expect(draws, `${draws} draws in 2s: the masthead's print is not alive`).toBeGreaterThan(8);
		expect(await read(page, '__maxPending'), 'more than one frame scheduled').toBeLessThanOrEqual(
			1,
		);
	});

	// The ambient work caps itself at 30 frames a second, on a loop capped at
	// 60: neither may follow a 120Hz display up to 120.
	test('a 120Hz display does not double the work', async ({ page }) => {
		await setUp(page, { rafAt: 120 });
		await page.goto('/');
		await expect(page.locator('#top .hero__screen')).toHaveAttribute('data-dither', 'on');
		await page.waitForTimeout(500);
		const draws = await countOver(page, '__draws', 2000);
		// The masthead's print at its 30fps cap draws ~60 in 2s; following
		// the display it would be ~240.
		expect(draws, `${draws} draws in 2s at 120Hz`).toBeLessThan(90);
		expect(draws, `${draws} draws in 2s at 120Hz: the loop is dead`).toBeGreaterThan(8);
	});

	test('it stops when nothing that moves is on screen', async ({ page }) => {
		await setUp(page);
		// A case study: the stage moves; the strip of guide at its foot does not.
		await page.goto('/work/vamp');
		await expect(page.locator('.info__screen')).toHaveAttribute('data-dither-stage', 'on');
		await page.evaluate(() => {
			document.documentElement.style.scrollBehavior = 'auto';
			window.scrollTo(0, document.documentElement.scrollHeight);
		});
		await page.waitForTimeout(900);
		const frames = await countOver(page, '__raf', 1500);
		expect(frames, `${frames} frames scheduled with nothing moving on screen`).toBeLessThan(5);
	});

	test.describe('under reduced motion', () => {
		test.use({ reducedMotion: 'reduce' });

		test('the homepage at rest schedules no frames', async ({ page }) => {
			await setUp(page);
			await page.goto('/');
			await expect(page.locator('#top .hero__screen')).toHaveAttribute('data-dither', 'on');
			await page.waitForTimeout(1500);
			const frames = await countOver(page, '__raf', 1500);
			expect(frames, `${frames} frames scheduled at rest under reduced motion`).toBeLessThan(5);
		});
	});
});
