import { test, expect } from '@playwright/test';
import { gzipSync } from 'node:zlib';

/**
 * Canvases only where a photograph is printed in one bit -- one each, WebGL2.
 *
 * Phase 1 also asserted zero animation loops, specifically so that introducing
 * one would have to be a deliberate edit to this file rather than something
 * that slipped in. Phase 2 made that edit: the character field ran exactly one
 * loop. The RAF assertion lives in `tests/e2e/loop.spec.ts`, which measures the
 * thing that actually matters -- one loop, throttled to 60fps, stopped when
 * offscreen -- rather than a raw call count.
 *
 * This was "zero canvases, zero contexts" until 2026-10-13, when the same kind
 * of deliberate edit brought back one narrow GPU path: the 1-bit print
 * (src/lib/dither/), one WebGL2 context per printed photograph, one for the
 * guide's screen and one for a case study's stage, each made only as it nears
 * the screen. So a canvas anywhere else, a second one in a frame, or any
 * context but WebGL2 -- a 2D canvas, a WebGL1 fallback -- is still somebody
 * reintroducing a path that was cut. See docs/performance.md.
 *
 * The seam lets the print run on headless Chromium's software GPU, which it
 * otherwise refuses, and every frame is visited, so this counts the most a
 * page can ever make rather than what the top of it makes.
 */
test('canvases only print pictures, one WebGL2 context each, on any route', async ({ page }) => {
	// Every frame of every route, mounted on a software GPU: slow, on purpose.
	test.slow();
	await page.addInitScript(() => {
		const w = window as unknown as { __ctx: string[]; __ditherSoftware: boolean };
		w.__ctx = [];
		w.__ditherSoftware = true;
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: never[]) {
			w.__ctx.push(String(args[0]));
			return getContext.apply(this, args as never);
		} as typeof getContext;
	});

	for (const path of ['/', '/work/nlziet', '/404-not-a-page']) {
		await page.goto(path, { waitUntil: 'networkidle' });
		for (const frame of await page.locator('[data-dither]').all()) {
			await frame.scrollIntoViewIfNeeded();
			await expect(frame).toHaveAttribute('data-dither', 'on');
		}
		for (const [sel, attr] of [
			['[data-dither-guide]', 'data-dither-guide'],
			['[data-dither-stage]', 'data-dither-stage'],
		] as const) {
			for (const frame of await page.locator(sel).all()) {
				await frame.scrollIntoViewIfNeeded();
				await expect(frame).toHaveAttribute(attr, 'on');
			}
		}
		await page.waitForTimeout(600);

		const seen = await page.evaluate(() => {
			const frames = [
				...document.querySelectorAll('[data-dither], [data-dither-guide], [data-dither-stage]'),
			];
			const canvases = [...document.querySelectorAll('canvas')];
			// A photograph's frame or a stage holds its canvas; the guide carries
			// one canvas to whichever programme's screen is on.
			const home = '[data-dither], [data-dither-stage], [data-dither-guide] .guide__screen';
			return {
				frames: frames.length,
				canvases: canvases.length,
				outside: canvases.filter((c) => !c.parentElement?.matches(home)).length,
				doubled: frames.filter((f) => f.querySelectorAll('canvas').length > 1).length,
				ctx: (window as unknown as { __ctx: string[] }).__ctx,
			};
		});

		expect(seen.outside, `${path}: canvases outside a printed picture`).toBe(0);
		expect(seen.doubled, `${path}: frames with more than one canvas`).toBe(0);
		expect(seen.canvases, `${path}: one canvas per printed picture`).toBe(seen.frames);
		expect(seen.ctx, `${path}: contexts asked for`).toEqual(
			Array.from({ length: seen.frames }, () => 'webgl2'),
		);
	}
});

/**
 * The homepage's JavaScript against the budgets CLAUDE.md sets: initial <= 20 KB
 * gzip, the deferred renderer under its 8 KB trip-wire (docs/performance.md),
 * and the total <= 45 KB. Measured as the browser receives it -- every script
 * the page loads by network idle, and the document's inline scripts -- each
 * gzipped on its own here, because astro preview serves them raw.
 *
 * It was one uncompressed count of everything, the lazy renderer included,
 * against 30 KB: a proxy for a 10 KB gzip gate from Phase 1. The renderer grew
 * with the test card, and on 2026-09-29 the proxy had 440 bytes left while the
 * real total was 12.7 KB gzip, so any fix would have failed a budget nobody set.
 *
 * Since 2026-10-14 the deferred chunk is the 1-bit print (src/lib/dither/): the
 * masthead's screen is a printed photograph, so the homepage loads it at once.
 * The character field it replaced is gone.
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
	// Inline scripts that run. A JSON-LD block is data: nothing executes it.
	const inline = await page.evaluate(() =>
		[...document.scripts]
			.filter((s) => !s.src && s.type !== 'application/ld+json')
			.map((s) => s.textContent ?? ''),
	);

	const gz = (body: Buffer | string): number => gzipSync(body).length;
	// The one chunk loaded on demand: src/lib/dither/dither.ts, behind boot.ts.
	const isRenderer = (url: string): boolean => /\/_astro\/dither\.[\w-]+\.js$/.test(url);
	let initial = inline.reduce((sum, s) => sum + gz(s), 0);
	let renderer = 0;
	for (const [url, body] of bodies) {
		if (isRenderer(url)) renderer += gz(body);
		else initial += gz(body);
	}

	const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB gzip`;
	expect(renderer, 'no renderer chunk was loaded, so this no longer measures it').toBeGreaterThan(
		0,
	);
	expect(initial, `initial JS was ${kb(initial)}`).toBeLessThanOrEqual(20 * 1024);
	expect(renderer, `the renderer was ${kb(renderer)}`).toBeLessThanOrEqual(8 * 1024);
	expect(initial + renderer, `total JS was ${kb(initial + renderer)}`).toBeLessThanOrEqual(
		45 * 1024,
	);
});

test('the legacy service worker kill switch is served', async ({ page }) => {
	const res = await page.goto('/service-worker.js');
	expect(res!.status()).toBe(200);
	const body = await res!.text();
	// If this file ever stops unregistering, returning visitors keep the v1 site.
	expect(body).toContain('registration.unregister()');
});
