import { test, expect } from '@playwright/test';

/**
 * Zero canvases, zero graphics contexts -- permanently.
 *
 * Phase 1 also asserted zero animation loops, specifically so that introducing
 * one would have to be a deliberate edit to this file rather than something
 * that slipped in. Phase 2 makes that edit: the character field runs exactly one
 * loop. The RAF assertion moves to `tests/e2e/field.spec.ts`, which measures the
 * thing that actually matters -- one loop, throttled to 30fps, stopped when
 * offscreen -- rather than a raw call count.
 *
 * The canvas assertions get STRONGER here, not weaker. The signature treatment
 * is rendered as text, so a canvas appearing means somebody reintroduced a
 * WebGL path that was deliberately cut. See docs/performance.md.
 */
test('ships no canvas and no graphics context, on any route', async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { __ctx: number };
		w.__ctx = 0;
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: never[]) {
			w.__ctx += 1;
			return getContext.apply(this, args as never);
		} as typeof getContext;
	});

	for (const path of ['/', '/work', '/work/nlziet', '/404-not-a-page']) {
		await page.goto(path, { waitUntil: 'networkidle' });
		await page.waitForTimeout(600);

		const { ctx, canvases } = await page.evaluate(() => ({
			ctx: (window as unknown as { __ctx: number }).__ctx,
			canvases: document.querySelectorAll('canvas').length,
		}));

		expect(canvases, `${path}: canvas elements`).toBe(0);
		expect(ctx, `${path}: graphics contexts created`).toBe(0);
	}
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
