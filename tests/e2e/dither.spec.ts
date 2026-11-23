import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { onGuide, restOn } from '../support/guide';

/**
 * The 1-bit print (src/lib/dither/): each photograph on the one-pager drawn as
 * an ordered dither in its channel's two colours and nothing else, at whole
 * device pixels, in the <img>'s own box -- and the CSS print (.duo) kept
 * wherever WebGL2 does not run on a real GPU. Key art -- the guide's screen, a
 * case study's stage -- keeps its own colours under the field's dots. All of
 * it alive on the loop while on screen, and still under reduced motion.
 *
 * Headless Chromium has only SwiftShader, which the print refuses, so every
 * test that needs it running sets the seam `__ditherSoftware` first. The one
 * that does not is the test of the refusal.
 */

const FRAMES = [
	'#interlude-signal .art__media',
	'.practice__backdrop',
	'#interlude-field .art__media',
	'.contact__photo',
] as const;

type RGB = [number, number, number];

async function allowSoftware(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(window as unknown as { __ditherSoftware: boolean }).__ditherSoftware = true;
	});
}

/** Jump -- not scroll -- to the section holding `frame`: a jump is no channel change, so no tune-in. */
async function land(page: Page, frame: string): Promise<void> {
	await page.evaluate((sel) => {
		const section = document.querySelector(sel)?.closest('[data-section]');
		if (!section) throw new Error(`no section holds ${sel}`);
		const root = document.documentElement;
		root.style.scrollBehavior = 'auto';
		section.scrollIntoView({ block: 'start' });
		root.style.scrollBehavior = '';
	}, frame);
}

/** A custom property's colour at `sel`, as 0-255 sRGB. */
const colourAt = (page: Page, sel: string, prop: string): Promise<RGB> =>
	page.evaluate(
		([sel, prop]) => {
			const probe = document.createElement('span');
			probe.style.color = `var(${prop})`;
			document.querySelector(sel)!.append(probe);
			const n = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? []).map(Number);
			probe.remove();
			return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0] as RGB;
		},
		[sel, prop] as const,
	);

/** The pixels of a clip of the screen, counted by colour. */
async function census(
	page: Page,
	clip: { x: number; y: number; width: number; height: number },
): Promise<Map<string, number>> {
	const { data, info } = await sharp(await page.screenshot({ clip }))
		.raw()
		.toBuffer({ resolveWithObject: true });
	const counts = new Map<string, number>();
	for (let i = 0; i < data.length; i += info.channels) {
		const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

const near = (key: string, c: RGB): boolean =>
	key.split(',').every((v, i) => Math.abs(Number(v) - (c[i] ?? 0)) <= 1);

/** The part of an element that is on screen, `inset` px in from its edges. */
async function onScreen(
	page: Page,
	sel: string,
	inset = 0,
): Promise<{ x: number; y: number; width: number; height: number }> {
	const box = await page.locator(sel).boundingBox();
	const view = page.viewportSize();
	if (!box || !view) throw new Error(`${sel} has no box`);
	const x = Math.max(0, Math.ceil(box.x) + inset);
	const y = Math.max(0, Math.ceil(box.y) + inset);
	return {
		x,
		y,
		width: Math.min(view.width, Math.floor(box.x + box.width) - inset) - x,
		height: Math.min(view.height, Math.floor(box.y + box.height) - inset) - y,
	};
}

test.describe('the 1-bit print', () => {
	test('prints every photograph in exactly its two colours, in the <img>’s box', async ({
		page,
	}) => {
		test.slow();
		await allowSoftware(page);
		await page.goto('/', { waitUntil: 'networkidle' });

		for (const frame of FRAMES) {
			await land(page, frame);
			await expect(page.locator(frame)).toHaveAttribute('data-dither', 'on');

			const boxes = await page.evaluate((sel) => {
				const f = document.querySelector(sel)!;
				const r = (e: Element | null): number[] => {
					const b = e!.getBoundingClientRect();
					return [b.x, b.y, b.width, b.height].map(Math.round);
				};
				return { img: r(f.querySelector('img')), canvas: r(f.querySelector('canvas')) };
			}, frame);
			expect(boxes.canvas, `${frame}: the canvas lies where the <img> does`).toEqual(boxes.img);

			const hi = await colourAt(page, frame, '--duo-hi');
			const lo = await colourAt(page, frame, '--duo-lo');
			// Only the print: everything else on the page is hidden for the shot.
			const hide = await page.addStyleTag({
				content:
					'body * { visibility: hidden !important; } ' +
					'[data-dither] > canvas { visibility: visible !important; }',
			});
			// In from the frame's edge: the contact photo's border is not the print.
			const counts = await census(page, await onScreen(page, frame, 2));
			await hide.evaluate((el: Element) => {
				el.remove();
			});

			const total = [...counts.values()].reduce((a, b) => a + b, 0);
			const stray = [...counts.entries()].filter(([k]) => !near(k, hi) && !near(k, lo));
			expect(stray, `${frame}: every pixel is --duo-hi or --duo-lo`).toEqual([]);
			for (const [name, c] of [
				['--duo-hi', hi],
				['--duo-lo', lo],
			] as const) {
				const n = [...counts.entries()].filter(([k]) => near(k, c)).reduce((a, [, v]) => a + v, 0);
				expect(n / total, `${frame}: a picture, not a flat ${name}`).toBeGreaterThan(0.02);
			}
		}
	});

	test('the interludes’ captions stand on clean field', async ({ page }) => {
		await allowSoftware(page);
		await page.goto('/', { waitUntil: 'networkidle' });

		for (const id of ['interlude-signal', 'interlude-field']) {
			const frame = `#${id} .art__media`;
			await land(page, frame);
			await expect(page.locator(frame)).toHaveAttribute('data-dither', 'on');
			const field = await colourAt(page, `#${id}`, '--field');
			const hide = await page.addStyleTag({
				content:
					'.art__caption { color: transparent !important; } ' +
					'.cursor__dot, .cursor__ring { display: none !important; }',
			});
			const counts = await census(page, await onScreen(page, `#${id} .art__caption`));
			await hide.evaluate((el: Element) => {
				el.remove();
			});
			// The dithered fade lands at 80%, not the gradient's 92%: a stray dot
			// behind small type is noise. Not one, anywhere behind the caption.
			const stray = [...counts.entries()].filter(([k]) => !near(k, field));
			expect(stray, `${id}: only the field behind the caption`).toEqual([]);
		}
	});

	test('without a GPU, the CSS print stays and no canvas is left behind', async ({ page }) => {
		await page.addInitScript(() => {
			const w = window as unknown as { __asked: number };
			w.__asked = 0;
			const getContext = HTMLCanvasElement.prototype.getContext;
			HTMLCanvasElement.prototype.getContext = function (
				this: HTMLCanvasElement,
				...args: never[]
			) {
				w.__asked += 1;
				return getContext.apply(this, args as never);
			} as typeof getContext;
		});
		await page.goto('/', { waitUntil: 'networkidle' });
		for (const frame of FRAMES) await land(page, frame);
		// It did try: SwiftShader is what it turned down.
		await expect
			.poll(() => page.evaluate(() => (window as unknown as { __asked: number }).__asked), {
				message: 'a context was asked for each photograph',
			})
			.toBeGreaterThanOrEqual(FRAMES.length);

		const state = await page.evaluate((frames) => {
			return {
				asked: (window as unknown as { __asked: number }).__asked,
				canvases: document.querySelectorAll('canvas').length,
				frames: frames.map((sel) => {
					const f = document.querySelector<HTMLElement>(sel)!;
					return {
						state: f.dataset.dither,
						print: getComputedStyle(f, '::before').display,
						img: getComputedStyle(f.querySelector('img')!).opacity,
					};
				}),
			};
		}, FRAMES);
		expect(state.canvases).toBe(0);
		for (const f of state.frames) expect(f).toEqual({ state: '', print: 'block', img: '1' });
	});

	test('reduced motion still prints, and forced colours shows the photograph', async ({ page }) => {
		await allowSoftware(page);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/', { waitUntil: 'networkidle' });
		const frame = '#interlude-signal .art__media';
		await land(page, frame);
		await expect(page.locator(frame)).toHaveAttribute('data-dither', 'on');

		// Polled: under reduced motion the reset gives every property a 10µs
		// transition, and a read in the same frame as the switch can see its start.
		await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
		await expect
			.poll(() =>
				page.evaluate((sel) => {
					const f = document.querySelector(sel)!;
					return {
						canvas: getComputedStyle(f.querySelector('canvas')!).display,
						img: getComputedStyle(f.querySelector('img')!).opacity,
					};
				}, frame),
			)
			.toEqual({ canvas: 'none', img: '1' });
	});
});

/**
 * Counts every frame the print draws, from before the page runs: all of them,
 * or only those of the canvas in `frame`.
 */
async function countDraws(page: Page): Promise<(frame?: string) => Promise<number>> {
	await page.addInitScript(() => {
		const w = window as unknown as { __draws: number; __drawsBy: Map<unknown, number> };
		w.__draws = 0;
		w.__drawsBy = new Map();
		const draw = WebGL2RenderingContext.prototype.drawArrays;
		WebGL2RenderingContext.prototype.drawArrays = function (
			this: WebGL2RenderingContext,
			...args: Parameters<typeof draw>
		) {
			w.__draws += 1;
			w.__drawsBy.set(this.canvas, (w.__drawsBy.get(this.canvas) ?? 0) + 1);
			return draw.apply(this, args);
		};
	});
	return (frame) =>
		page.evaluate((sel) => {
			const w = window as unknown as { __draws: number; __drawsBy: Map<unknown, number> };
			if (!sel) return w.__draws;
			return w.__drawsBy.get(document.querySelector(`${sel} canvas`)) ?? 0;
		}, frame);
}

test.describe('the 1-bit print, alive', () => {
	// Small: a software GPU draws every frame on the CPU, and a full screen of
	// them starved the throttled rate tests running beside it.
	test.use({ viewport: { width: 640, height: 480 } });

	test('lives on the loop while on screen, and stops once it is not', async ({ page }) => {
		await allowSoftware(page);
		const draws = await countDraws(page);
		await page.goto('/', { waitUntil: 'networkidle' });
		await land(page, '#interlude-signal .art__media');
		await expect(page.locator('#interlude-signal .art__media')).toHaveAttribute(
			'data-dither',
			'on',
		);
		const frame = '#interlude-signal .art__media';
		const before = await draws(frame);
		await page.waitForTimeout(1000);
		// Ambient: 30 a second at most, stepped down under load; alive is enough.
		expect((await draws(frame)) - before, 'the hum bar and the edges, on the loop').toBeGreaterThan(
			3,
		);

		// Back to the masthead: the interlude's print is off screen, and stops.
		await land(page, '#top');
		await page.waitForTimeout(500);
		const away = await draws(frame);
		await page.waitForTimeout(1000);
		expect(await draws(frame), 'nothing drawn off screen').toBe(away);
	});

	test('a channel the remote jumps to tunes in, even mounted late', async ({ page }) => {
		await allowSoftware(page);
		await page.goto('/', { waitUntil: 'networkidle' });
		await land(page, '#interlude-signal .art__media');
		// The remote: 5 is Interlude / Field, two channels on. The advance
		// announces it before the scroll brings Field near enough to mount.
		// A number is only the remote from inside the page, not from the body.
		await page.evaluate(() => document.getElementById('main')?.focus({ preventScroll: true }));
		await page.keyboard.press('5');
		await expect(page.locator('#interlude-field .art__media')).toHaveAttribute('data-dither', 'on');
	});

	test.describe('under reduced motion', () => {
		test.use({ reducedMotion: 'reduce' });

		test('the print is still: nothing drawn at rest', async ({ page }) => {
			await allowSoftware(page);
			const draws = await countDraws(page);
			await page.goto('/', { waitUntil: 'networkidle' });
			await land(page, '#interlude-signal .art__media');
			await expect(page.locator('#interlude-signal .art__media')).toHaveAttribute(
				'data-dither',
				'on',
			);
			await page.waitForTimeout(500);
			const settled = await draws();
			await page.waitForTimeout(1000);
			expect(await draws(), 'no frames at rest').toBe(settled);
		});
	});
});

test.describe('the 1-bit print on key art', () => {
	// Key art is the largest picture the print draws, on a software GPU that
	// draws on the CPU: with eight browsers sharing it, the guide's rows took
	// the whole default 30s to draw in. Two workers, as CI runs, never did.
	test.slow();

	test('the guide’s screen keeps the key art’s colours, and its canvas follows the programme', async ({
		page,
	}) => {
		await allowSoftware(page);
		await page.goto('/', { waitUntil: 'networkidle' });
		await onGuide(page);
		await expect(page.locator('#work')).toHaveAttribute('data-dither-guide', 'on');

		const where = (): Promise<(string | undefined)[]> =>
			page.evaluate(() =>
				[...document.querySelectorAll('#work canvas')].map(
					(c) => c.closest<HTMLElement>('.guide__preview')?.dataset.preview,
				),
			);
		const first = await page
			.locator('#work .guide__preview[data-active]')
			.getAttribute('data-preview');
		expect(await where(), 'one canvas, on the programme that is on').toEqual([first]);

		// Key art in its own colours: a print would be two.
		const screen = '#work .guide__preview[data-active] .guide__screen';
		const counts = await census(page, await onScreen(page, screen, 3));
		expect(counts.size, 'colours on the screen').toBeGreaterThan(200);

		await restOn(page, 'chromecast');
		await expect
			.poll(where, { message: 'the canvas moved with the programme' })
			.toEqual(['chromecast']);
	});

	test('a case study keeps its key art’s colours, and its title stands on clean field', async ({
		page,
	}) => {
		await allowSoftware(page);
		await page.goto('/work/nlziet', { waitUntil: 'networkidle' });
		const stage = page.locator('.info__screen');
		await expect(stage).toHaveAttribute('data-dither-stage', 'on');
		await page.waitForTimeout(300);

		const top = await stage.boundingBox();
		if (!top) throw new Error('no stage');
		const picture = await census(page, {
			x: Math.round(top.x),
			y: Math.round(top.y),
			width: Math.round(top.width),
			height: Math.round(top.height * 0.4),
		});
		expect(picture.size, 'colours in the picture').toBeGreaterThan(200);

		// The fade is dithered, and lands clear of the title: not one of the
		// picture's dots behind it.
		const field = await colourAt(page, '.info', '--field');
		const hide = await page.addStyleTag({
			content:
				'.info__title, .info__status, .info__lede { color: transparent !important; } ' +
				'.onair, .info__actions, .cursor__dot, .cursor__ring { visibility: hidden !important; }',
		});
		const behind = await census(page, await onScreen(page, '.info__title'));
		await hide.evaluate((el: Element) => {
			el.remove();
		});
		const stray = [...behind.entries()].filter(([k]) => !near(k, field));
		expect(stray, 'only the field behind the title').toEqual([]);
	});
});

test.describe('the 1-bit print on a 2x screen', () => {
	// Small: a software GPU draws every device pixel on the CPU, and a big 2x
	// screen of it starved the loop-rate test running beside it.
	test.use({ deviceScaleFactor: 2, viewport: { width: 640, height: 480 } });

	test('draws at device resolution, so a dot is whole device pixels', async ({ page }) => {
		await allowSoftware(page);
		await page.goto('/', { waitUntil: 'networkidle' });
		for (const frame of FRAMES) {
			await land(page, frame);
			// A software GPU at 2x under a parallel run can take a while to draw.
			await expect(page.locator(frame)).toHaveAttribute('data-dither', 'on', { timeout: 15_000 });
			const size = await page.evaluate((sel) => {
				const c = document.querySelector<HTMLCanvasElement>(`${sel} > canvas`)!;
				const r = c.getBoundingClientRect();
				return {
					backing: [c.width, c.height],
					device: [Math.round(r.width * 2), Math.round(r.height * 2)],
				};
			}, frame);
			expect(size.backing, `${frame}: one canvas pixel per device pixel`).toEqual(size.device);
		}
	});
});
