import { test, expect } from '@playwright/test';

/**
 * Phase 1 asserts ZERO WebGL contexts and ZERO animation loops -- not one.
 *
 * A test that already passes at `1` teaches nothing. Phase 3 introduces the art
 * renderer and must change these numbers deliberately, in the same commit, so
 * the budget change is visible in review. See docs/performance.md.
 */
test('ships no WebGL context and no animation loop', async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { __raf: number; __ctx: number };
		w.__raf = 0;
		w.__ctx = 0;
		const raf = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = (cb) => {
			w.__raf += 1;
			return raf(cb);
		};
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: never[]) {
			w.__ctx += 1;
			return getContext.apply(this, args as never);
		} as typeof getContext;
	});

	await page.goto('/', { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);

	const { raf, ctx, canvases } = await page.evaluate(() => ({
		raf: (window as unknown as { __raf: number }).__raf,
		ctx: (window as unknown as { __ctx: number }).__ctx,
		canvases: document.querySelectorAll('canvas').length,
	}));

	expect(canvases, 'canvas elements').toBe(0);
	expect(ctx, 'canvas contexts created').toBe(0);
	expect(raf, 'requestAnimationFrame calls').toBe(0);
});

test('initial JavaScript stays inside the Phase 1 budget', async ({ page }) => {
	let bytes = 0;
	page.on('response', async (res) => {
		if (!res.url().endsWith('.js')) return;
		if (res.url().includes('service-worker')) return; // not on the critical path
		try {
			bytes += (await res.body()).length;
		} catch {
			/* redirects and aborted requests have no body */
		}
	});

	await page.goto('/', { waitUntil: 'networkidle' });

	// Uncompressed, so this is a deliberately generous proxy for the 10 KB gzip
	// gate. Astro with no UI framework should land near zero; this catches the
	// day somebody adds a script tag by accident.
	expect(bytes, `initial JS was ${(bytes / 1024).toFixed(1)} KB uncompressed`).toBeLessThan(
		30 * 1024,
	);
});

test('the legacy service worker kill switch is served', async ({ page }) => {
	const res = await page.goto('/service-worker.js');
	expect(res!.status()).toBe(200);
	const body = await res!.text();
	// If this file ever stops unregistering, returning visitors keep the v1 site.
	expect(body).toContain('registration.unregister()');
});
