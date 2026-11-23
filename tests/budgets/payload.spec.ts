import { test, expect } from '@playwright/test';
import { gzipSync } from 'node:zlib';

/**
 * No canvas, no WebGL, no animation loop. The card table is CSS and WAAPI; a
 * canvas or a requestAnimationFrame appearing means a cut path is returning.
 */
test('no canvas, no WebGL context, no rAF loop', async ({ page }) => {
	await page.addInitScript(() => {
		const w = window as unknown as { __raf: number; __ctx: number };
		w.__raf = 0;
		w.__ctx = 0;
		const raf = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = (cb) => {
			w.__raf++;
			return raf(cb);
		};
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: never[]) {
			w.__ctx++;
			return getContext.apply(this, args as never);
		} as typeof getContext;
	});
	for (const path of ['/', '/definitely-not-a-page']) {
		await page.goto(path, { waitUntil: 'networkidle' });
		await page.mouse.move(400, 300);
		await page.mouse.move(500, 360);
		await page.waitForTimeout(500);
		const seen = await page.evaluate(() => ({
			canvases: document.querySelectorAll('canvas').length,
			raf: (window as unknown as { __raf: number }).__raf,
			ctx: (window as unknown as { __ctx: number }).__ctx,
		}));
		expect(seen, path).toEqual({ canvases: 0, raf: 0, ctx: 0 });
	}
});

/**
 * The homepage's JavaScript against the budgets in CLAUDE.md: initial <= 20 KB
 * gzip and total <= 45 KB. Measured as the browser receives it: every script
 * loaded by network idle plus the document's inline scripts, each gzipped on
 * its own because astro preview serves them raw.
 */
test('the homepage JavaScript stays inside its budgets', async ({ page }) => {
	const bodies = new Map<string, Buffer>();
	page.on('response', async (res) => {
		const url = res.url();
		if (!url.endsWith('.js') || url.includes('service-worker')) return;
		try {
			bodies.set(url, await res.body());
		} catch {
			/* redirects and aborted requests have no body */
		}
	});

	await page.goto('/', { waitUntil: 'networkidle' });
	const inline = await page.evaluate(() =>
		[...document.scripts]
			.filter((s) => !s.src && s.type !== 'application/ld+json')
			.map((s) => s.textContent ?? ''),
	);

	const gz = (body: Buffer | string): number => gzipSync(body).length;
	let total = inline.reduce((sum, s) => sum + gz(s), 0);
	for (const body of bodies.values()) total += gz(body);

	const kb = `${(total / 1024).toFixed(1)} KB gzip`;
	console.log(`  homepage JS: ${kb}`);
	expect(total, `total JS was ${kb}`).toBeGreaterThan(0);
	expect(total, `initial JS was ${kb}`).toBeLessThanOrEqual(20 * 1024);
});

test('the legacy service worker kill switch is served', async ({ page }) => {
	const res = await page.goto('/service-worker.js');
	expect(res!.status()).toBe(200);
	const body = await res!.text();
	// If this file ever stops unregistering, returning visitors keep the v1 site.
	expect(body).toContain('registration.unregister()');
});
