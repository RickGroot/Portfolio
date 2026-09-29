import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

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

/**
 * Record every `data-resolve` the field publishes, from before any page script
 * runs. Sampling the attribute at a fixed instant cannot express "decodes from
 * noise" -- it asks "was it noisy at t=1000ms", which is a question about the
 * test runner's scheduling, and it failed roughly one run in five under load.
 * The trajectory answers the real question and does not care when we look.
 */
async function recordResolve(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as unknown as { __resolve: number[] };
		w.__resolve = [];
		// A poll, not a MutationObserver: an init script runs before the document
		// has a documentElement, so there is nothing to observe yet and setting
		// the observer up throws. The field publishes in 0.05 steps, and its
		// fastest stretch, the scatter, takes ~55ms a step, so 25ms cannot miss one.
		let last = '';
		setInterval(() => {
			const v = document.querySelector('[data-character-field]')?.getAttribute('data-resolve');
			if (typeof v === 'string' && v !== last) {
				last = v;
				w.__resolve.push(Number(v));
			}
		}, 25);
	});
}

/** A and B are the field and the face, rewritten every frame; C is the test card's circle, written once per layout. */
const layers = (page: Page) =>
	page.evaluate(() => {
		const a = document.querySelector('[data-layer="a"]')?.textContent ?? '';
		const b = document.querySelector('[data-layer="b"]')?.textContent ?? '';
		const c = document.querySelector('[data-layer="c"]')?.textContent ?? '';
		return { a, b, c };
	});

test.describe('character field', () => {
	test('the grid never shears', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1200);
		const { a, b, c } = await layers(page);

		for (const [name, text] of [
			['a', a],
			['b', b],
			['c', c],
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

	test('no two layers ever occupy the same cell', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1200);
		const { a, b, c } = await layers(page);
		expect(a.length).toBe(b.length);
		expect(c.length, 'the circle is laid on a different grid').toBe(a.length);

		let overlaps = 0;
		for (let i = 0; i < a.length; i++) {
			const drawn = [a[i], b[i], c[i]].filter((ch) => ch !== ' ' && ch !== '\n').length;
			if (drawn > 1) overlaps += 1;
		}
		// The colour split IS the resolve state, so a cell belongs to exactly
		// one layer, and the circle's cells to it alone. Any overlap means the
		// mask and the render disagree.
		expect(overlaps, 'cells rendered into more than one colour layer').toBe(0);
	});

	test('the ramp stays ASCII', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(1200);
		const { a, b, c } = await layers(page);
		// Anything outside printable ASCII risks a per-glyph font fallback with
		// an unconstrained advance width, which shears the grid.
		expect(/^[\x20-\x7E\n]*$/.test(a + b + c), 'non-ASCII characters in the field').toBe(true);
	});

	// The test card: a circle, drawn as a line round the face, and a grid
	// outside it that reaches every edge of the hero. Both are the renderer's,
	// from the geometry the stylesheet sets, so both can go missing on their own.
	test('the test card draws its circle and its grid', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('[data-character-field]')).toHaveAttribute(
			'data-field-state',
			'live',
		);
		const { a, c } = await layers(page);
		const ring = c.replace(/[\s]/g, '').length;
		expect(ring, 'the circle has too few cells to be a circle').toBeGreaterThan(80);
		expect(/^[ '\-._/\\|\n]*$/.test(c), 'the circle is drawn in something other than a line').toBe(
			true,
		);

		const rowsA = a.split('\n');
		const top = rowsA[0] ?? '';
		const bottom = rowsA[rowsA.length - 1] ?? '';
		// The grid's vertical lines cross the top and bottom rows; its
		// horizontal ones run along some row from edge to edge.
		expect((top.match(/[|+]/g) ?? []).length, 'no grid lines reach the top').toBeGreaterThan(3);
		expect((bottom.match(/[|+]/g) ?? []).length, 'no grid lines reach the bottom').toBeGreaterThan(
			3,
		);
		expect(
			rowsA.some((row) => /^[-+]{2}/.test(row) && /[-+]{2}$/.test(row)),
			'no horizontal grid line runs edge to edge',
		).toBe(true);
	});

	// The field is pointer-events: none, so a pointermove listener on it never
	// ran: the disturbance docs/art-system.md described had never happened
	// (found 2026-09-28: 30 moves over the hero, 0 calls). Outside the circle
	// the grid's squares are empty unless the pointer ripples them, so a glyph
	// in one that is not a grid line is the ripple, and nothing else.
	test('a fast pointer disturbs the card around it', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/');
		await expect(page.locator('[data-character-field]')).toHaveAttribute(
			'data-field-state',
			'live',
		);
		const stray = (): Promise<number> =>
			page.evaluate(() => {
				const rows = (document.querySelector('[data-layer="a"]')?.textContent ?? '').split('\n');
				const ring = (document.querySelector('[data-layer="c"]')?.textContent ?? '').split('\n');
				let n = 0;
				rows.forEach((row, y) => {
					// Left of the circle: the whole row where the circle does not reach.
					const start = ring[y]?.search(/\S/) ?? -1;
					const end = start < 0 ? row.length : start;
					for (let x = 0; x < end; x++) if (!' |+-'.includes(row[x] ?? ' ')) n++;
				});
				return n;
			});
		expect(await stray(), 'the grid has glyphs in its squares before the pointer moved').toBe(0);

		await page.mouse.move(60, 180);
		for (let k = 0; k < 10; k++) await page.mouse.move(60 + (k % 2) * 220, 180 + k * 50);
		await expect
			.poll(stray, { message: 'a fast pointer left the card undisturbed', timeout: 3000 })
			.toBeGreaterThan(0);
	});

	test('it decodes from noise into the portrait', async ({ page }) => {
		await recordResolve(page);
		await page.goto('/');

		// Character counts cannot measure this: a resolved cell whose portrait
		// luminance is black renders a space, so it looks unresolved. The
		// renderer publishes its actual progress instead.
		//
		// Asserted in order, because the field's FIRST published value is 1.00 --
		// it starts matching the server-rendered static frame so there is no
		// flash, then scatters and decodes back. Checking "is it resolved" on its
		// own is satisfied by that opening frame and proves nothing.
		const trail = (): Promise<number[]> =>
			page.evaluate(() => (window as unknown as { __resolve: number[] }).__resolve);

		await expect
			.poll(async () => Math.min(...(await trail()), Infinity), {
				message: 'the field never scattered into noise',
				timeout: 12000,
			})
			.toBeLessThan(0.35);

		await expect
			.poll(async () => (await trail()).at(-1) ?? -1, {
				message: 'the field never resolved back into the portrait',
				timeout: 12000,
			})
			.toBeGreaterThan(0.9);
	});

	// Rick: "does there have to be like this empty square before I show up?"
	// The portrait sits in a box in the middle of the field, and the box's dark
	// background used to count as portrait: resolved, it printed as spaces, and
	// the face sat in an empty rectangle cut out of the field. The corners of
	// the face's bounding box are that background, so they must be live field.
	test('the face comes out of the field, not out of an empty box', async ({ page }) => {
		await recordResolve(page);
		await page.goto('/');
		// The whole entry sequence first: scattered, then resolved. The field's
		// first published value is already 1.00, and waiting on that alone read
		// the layers mid-decode under load, where the corners are half-built.
		const trail = (): Promise<number[]> =>
			page.evaluate(() => (window as unknown as { __resolve: number[] }).__resolve);
		await expect
			.poll(async () => Math.min(...(await trail()), Infinity), { timeout: 12000 })
			.toBeLessThan(0.35);
		await expect
			.poll(async () => (await trail()).at(-1) ?? -1, {
				message: 'the field never resolved into the portrait',
				timeout: 12000,
			})
			.toBeGreaterThan(0.95);

		const { a, b, c } = await layers(page);
		const rowsA = a.split('\n');
		const rowsB = b.split('\n');
		const rowsC = c.split('\n');

		// On the test card the field lives inside the circle, and outside it the
		// grid's empty squares are meant to be empty. The face sits high in the
		// circle, so its box's top corners cross the line: only the cells inside
		// the circle, between its two strokes on that row, count.
		const insideCircle = (x: number, y: number): boolean => {
			const row = rowsC[y] ?? '';
			const first = row.search(/\S/);
			if (first < 0) return false;
			const last = row.length - 1 - [...row].reverse().join('').search(/\S/);
			return x > first && x < last && row[x] === ' ';
		};

		// The face's bounding box: every cell the portrait layer draws.
		let top = Infinity;
		let bottom = -1;
		let left = Infinity;
		let right = -1;
		rowsB.forEach((row, y) => {
			for (let x = 0; x < row.length; x++) {
				if (row[x] === ' ') continue;
				top = Math.min(top, y);
				bottom = Math.max(bottom, y);
				left = Math.min(left, x);
				right = Math.max(right, x);
			}
		});
		expect(bottom, 'the portrait layer drew nothing').toBeGreaterThan(top);

		// Its four corners, a fifth of the box each way: outside the oval of the
		// head, so background.
		const cw = Math.max(2, Math.floor((right - left + 1) / 5));
		const ch = Math.max(2, Math.floor((bottom - top + 1) / 5));
		let cells = 0;
		let blank = 0;
		for (const [y0, x0] of [
			[top, left],
			[top, right - cw + 1],
			[bottom - ch + 1, left],
			[bottom - ch + 1, right - cw + 1],
		] as const) {
			for (let y = y0; y < y0 + ch; y++) {
				for (let x = x0; x < x0 + cw; x++) {
					if (!insideCircle(x, y)) continue;
					cells += 1;
					if (rowsA[y]?.[x] === ' ' && rowsB[y]?.[x] === ' ') blank += 1;
				}
			}
		}
		expect(cells, 'too few corner cells inside the circle to judge').toBeGreaterThan(40);
		// The field has troughs of its own, a cell in four or five inside the
		// circle, where it runs faint; the empty box was every cell.
		expect(
			blank / cells,
			`${blank} of ${cells} corner cells are empty: the face sits in a box`,
		).toBeLessThan(0.5);
	});

	// At 60fps the cap cannot be seen on a 60Hz display -- every frame is a
	// render either way. It is there for a 120Hz one, which would otherwise
	// double the work, so drive requestAnimationFrame at 120Hz and count.
	test('the loop stays at 60fps on a 120Hz display', async ({ page }) => {
		await page.addInitScript(() => {
			let next = 0;
			const timers = new Map<number, number>();
			window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
				next += 1;
				const handle = next;
				timers.set(
					handle,
					window.setTimeout(() => {
						timers.delete(handle);
						cb(performance.now());
					}, 1000 / 120),
				);
				return handle;
			};
			window.cancelAnimationFrame = (handle: number): void => {
				window.clearTimeout(timers.get(handle));
				timers.delete(handle);
			};
		});
		await page.goto('/');
		await page.waitForTimeout(700);
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
		// Capped, ~120 renders in 2s; uncapped at 120Hz, ~240.
		expect(renders, `${renders} renders in 2s at 120Hz — expected ~120 (60fps)`).toBeLessThan(170);
		expect(renders, `${renders} renders in 2s at 120Hz — the loop is dead`).toBeGreaterThan(30);
	});

	test('exactly one animation loop, throttled to 60fps', async ({ page }) => {
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

		// ~120 renders in 2s at 60fps; a dead loop would leave it near zero. A
		// lost throttle cannot show here, because 60fps is every frame at 60Hz:
		// the 120Hz test above covers it.
		//
		// The floor catches the DEAD loop, so it sits well above zero and well
		// below a starved one. At 30fps it was 35 of an expected 60, and eight
		// parallel browsers sharing the CPU measured 32, 34 and 35 -- a live loop
		// running at half speed because it was starved, failing a check meant
		// for one that had stopped. Contention only ever lowers this count, so
		// the ceiling is unaffected, and two loops are caught by maxPending
		// below, which counts concurrently scheduled frames and does not move
		// with load.
		expect(renders, `${renders} renders in 2s — expected ~120 (60fps)`).toBeGreaterThan(30);
		expect(renders, `${renders} renders in 2s — expected ~120 (60fps)`).toBeLessThan(190);
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

	// Where the section advance actually leaves the page: the next channel
	// exactly at the top, the hero's bottom edge touching the viewport's top
	// one. A box that only touches counts as intersecting, so the loop used to
	// keep drawing the field behind the guide. Scrolling far past, as the test
	// above does, never finds that.
	test('it stops when the next channel sits exactly on screen', async ({ page }) => {
		await instrument(page);
		await page.goto('/');
		await page.waitForTimeout(800);

		await page.evaluate(() => {
			document.documentElement.style.scrollBehavior = 'auto';
			document.getElementById('work')?.scrollIntoView({ block: 'start' });
		});
		await page.waitForTimeout(900); // the observer, and any decode on arrival
		const top = await page.evaluate(() =>
			Math.round(document.getElementById('work')?.getBoundingClientRect().top ?? 9999),
		);
		expect(top, 'the guide is not flush with the top of the screen').toBe(0);

		const a = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
		await page.waitForTimeout(1500);
		const b = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);

		expect(b - a, 'the loop kept running behind the guide').toBeLessThan(5);
	});

	// The cell cap bounds how many characters the field draws, not how much of
	// the screen it covers: capped, the glyphs grow. At the stylesheet's size a
	// 2560x1440 screen got the cap's grid across 52% of the hero, in its middle
	// (Rick: "the header isn't full-screen on large device").
	test('it covers the hero edge to edge, on a large screen too', async ({ page }) => {
		for (const size of [
			{ width: 2560, height: 1440 },
			{ width: 1440, height: 900 },
			{ width: 390, height: 844 },
		]) {
			await page.setViewportSize(size);
			await page.goto('/');
			await expect(page.locator('[data-character-field]')).toHaveAttribute(
				'data-field-state',
				'live',
			);
			// The edges the grid falls short of, within a pixel: it may overhang,
			// and the hero clips it. Polled, because "live" is set when the grid is
			// laid out, a frame before the first live render fills it.
			const short = (): Promise<string[]> =>
				page.evaluate(() => {
					const hero = (document.querySelector('.hero') as HTMLElement).getBoundingClientRect();
					const range = document.createRange();
					range.selectNodeContents(document.querySelector('.field__layer--b') as HTMLElement);
					const grid = range.getBoundingClientRect();
					const out: string[] = [];
					if (grid.left > hero.left + 1) out.push('left');
					if (grid.top > hero.top + 1) out.push('top');
					if (grid.right < hero.right - 1) out.push('right');
					if (grid.bottom < hero.bottom - 1) out.push('bottom');
					return out;
				});
			await expect
				.poll(short, { message: `${size.width}x${size.height}: the field stops short of an edge` })
				.toEqual([]);
		}
	});

	// The photograph glows through the characters (Rick, 2026-09-25: "it's not
	// really clear that it's my face on there"), so the two have to be the same
	// face, in the same place. Both boxes came out right while the face was
	// drawn half a cell right of and below the photo: the map was sampled at
	// each cell's corner, not its centre. So this compares the pictures, not the
	// boxes. Each is shot on its own, blurred to the scale of a cell, and the
	// shift at which they correlate best has to be none.
	for (const mode of [
		{ width: 2560, height: 1440, motion: 'no-preference' },
		{ width: 1440, height: 900, motion: 'no-preference' },
		{ width: 390, height: 844, motion: 'no-preference' },
		{ width: 1440, height: 900, motion: 'reduce' },
	] as const) {
		const state = mode.motion === 'reduce' ? 'static' : 'live';
		test(`${mode.width}x${mode.height}, ${state}: the photograph sits on the characters' face`, async ({
			browser,
		}) => {
			test.slow();
			const context = await browser.newContext({
				viewport: { width: mode.width, height: mode.height },
				reducedMotion: mode.motion,
			});
			const page = await context.newPage();
			await recordResolve(page);
			await page.goto('/', { waitUntil: 'networkidle' });
			await page.mouse.move(mode.width - 2, 2);
			await expect(page.locator('[data-character-field]')).toHaveAttribute(
				'data-field-state',
				state,
			);
			if (state === 'live') {
				// Scattered, then resolved: the field opens on the static frame.
				const trail = (): Promise<number[]> =>
					page.evaluate(() => (window as unknown as { __resolve: number[] }).__resolve);
				await expect
					.poll(async () => Math.min(...(await trail()), Infinity), { timeout: 12000 })
					.toBeLessThan(0.35);
				await expect
					.poll(async () => (await trail()).at(-1) ?? -1, { timeout: 12000 })
					.toBeGreaterThan(0.95);
			}
			await expect(page.locator('.field__photo img')).toHaveJSProperty('complete', true);

			const r = await page.locator('.field__photo').evaluate((el) => {
				const b = el.getBoundingClientRect();
				return { x: b.left, y: b.top, w: b.width, h: b.height };
			});
			const x = Math.max(0, Math.ceil(r.x));
			const y = Math.max(0, Math.ceil(r.y));
			const clip = {
				x,
				y,
				width: Math.min(mode.width, Math.floor(r.x + r.w)) - x,
				height: Math.min(mode.height, Math.floor(r.y + r.h)) - y,
			};
			expect(clip.width * clip.height, 'the photograph has no box on screen').toBeGreaterThan(1e4);

			const hideCopy =
				'.hero__card, .hero__clock, .cursor__dot, .cursor__ring { visibility: hidden !important; } ';
			const shoot = async (css: string): Promise<Buffer> => {
				const tag = await page.addStyleTag({ content: hideCopy + css });
				await page.waitForTimeout(200);
				const png = await page.screenshot({ clip });
				await tag.evaluate((n) => {
					n.parentNode?.removeChild(n);
				});
				return png;
			};
			const photo = await shoot(
				'.field__layer, .field::before, .field::after { visibility: hidden !important; } ' +
					'.field__photo { opacity: 1 !important; mix-blend-mode: normal !important; mask-image: none !important; }',
			);
			// Live, layer A is the field everywhere and the face is layer B, and
			// the test card's circle, layer C, crosses the photograph's corners;
			// static, layer A is the face. The reduced-motion card draws its
			// circle as a line of its own, on the field's pseudo-elements.
			const chars = await shoot(
				'.field__photo, .field::before, .field::after { visibility: hidden !important; }' +
					(state === 'live'
						? ' .field__layer--a, .field__layer--c { visibility: hidden !important; }'
						: ''),
			);

			// Half the size, blurred past the glyphs' shapes -- 10px, as it always
			// was -- so what is left is the brightness of each patch of the face,
			// in both. In 2px steps: the characters carry a bias of their own, a
			// pixel or two either way depending on how many cells span the face
			// (measured 2026-09-28: +1px at 69 columns, -1 to -2px at 54, with the
			// photograph following the face's box exactly -- moving the box a whole
			// cell moved nothing). A quarter of the size, in 4px steps, put a 2px
			// bias on the line between two steps, and the field's shimmer chose.
			// The bug this exists for drew the face half a cell off: 5px and more.
			const SCALE = 0.5;
			const w = Math.round(clip.width * SCALE);
			const h = Math.round(clip.height * SCALE);
			const grey = (png: Buffer): Promise<Buffer> =>
				sharp(png).greyscale().resize(w, h, { fit: 'fill' }).blur(5).raw().toBuffer();
			const [pa, pb] = await Promise.all([grey(photo), grey(chars)]);

			const R = 16; // 32px each way
			let best = { r: -2, dx: 0, dy: 0 };
			for (let dy = -R; dy <= R; dy++) {
				for (let dx = -R; dx <= R; dx++) {
					let sa = 0;
					let sb = 0;
					let saa = 0;
					let sbb = 0;
					let sab = 0;
					let n = 0;
					for (let yy = R; yy < h - R; yy++) {
						for (let xx = R; xx < w - R; xx++) {
							const va = pa[yy * w + xx]!;
							const vb = pb[(yy + dy) * w + (xx + dx)]!;
							sa += va;
							sb += vb;
							saa += va * va;
							sbb += vb * vb;
							sab += va * vb;
							n += 1;
						}
					}
					const corr =
						(sab - (sa * sb) / n) / Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n));
					if (corr > best.r) best = { r: corr, dx, dy };
				}
			}
			expect(best.r, 'the photograph and the characters are not the same picture').toBeGreaterThan(
				0.8,
			);
			// Within one step of none, each way.
			const off = `the face is drawn ${best.dx / SCALE}px across and ${best.dy / SCALE}px down from the photograph`;
			expect(Math.abs(best.dx / SCALE), off).toBeLessThanOrEqual(2);
			expect(Math.abs(best.dy / SCALE), off).toBeLessThanOrEqual(2);
			await context.close();
		});
	}

	// The handover from the server's static frame to the live field must move
	// nothing: the layers are pinned to the field for this (see the comment on
	// .field__layer), and the photograph is moved by its translate alone. Moved
	// by its insets it measured 0.109 CLS at 1440x900 -- and 0.087 at the
	// vitals run's own viewport, under the page's 0.1 budget, so the budget
	// alone would have let it through. So this asks for none at all.
	//
	// None from the field, that is. The name, on one line, can move a hair on
	// its own under a loaded run: when its font arrives after the first paint,
	// "Groot" starts where the fallback's "Rick " ended, a few pixels off
	// (measured 0.0008). That is the font's, and the vitals run holds it.
	//
	// A move before the first paint is not a shift: nothing was on screen to
	// move. Unthrottled, the field often goes live before it, and this passed
	// with the insets put back. So the CPU is throttled as the vitals run's is,
	// and the test fails if the handover still came first.
	test('the handover to the live field shifts nothing', async ({ browser }) => {
		test.slow();
		for (const size of [
			{ width: 1440, height: 900 },
			{ width: 390, height: 844 },
		]) {
			const context = await browser.newContext({ viewport: size });
			const page = await context.newPage();
			const cdp = await context.newCDPSession(page);
			await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
			await page.addInitScript(() => {
				const w = window as unknown as { __shifts: string[]; __live: number };
				w.__shifts = [];
				w.__live = 0;
				// A poll, as in recordResolve: there is no document to observe yet.
				const poll = setInterval(() => {
					const f = document.querySelector<HTMLElement>('[data-character-field]');
					if (f?.dataset.fieldState === 'live') {
						w.__live = performance.now();
						clearInterval(poll);
					}
				}, 5);
				new PerformanceObserver((list) => {
					const field = document.querySelector('[data-character-field]');
					for (const e of list.getEntries()) {
						const s = e as PerformanceEntry & {
							value: number;
							sources?: { node?: Node | null }[];
						};
						// Left out only when every source is provably elsewhere: an
						// element on the page that the field does not hold. A pseudo-
						// element, or a node since removed, counts as the field's.
						const elsewhere =
							!!field &&
							(s.sources ?? []).length > 0 &&
							(s.sources ?? []).every((x) => {
								const n = x.node;
								const el = n instanceof Element ? n : n?.parentElement;
								return (
									!!el && el.isConnected && !el.tagName.startsWith('::') && !field.contains(el)
								);
							});
						if (elsewhere) continue;
						const nodes = (s.sources ?? []).map((x) => {
							const n = x.node;
							const el = n instanceof Element ? n : n?.parentElement;
							return el ? `${el.tagName.toLowerCase()}.${el.className}` : '?';
						});
						w.__shifts.push(`${s.value.toFixed(4)} ${nodes.join(', ')}`);
					}
				}).observe({ type: 'layout-shift', buffered: true });
			});
			await page.goto('/');
			await expect(page.locator('[data-character-field]')).toHaveAttribute(
				'data-field-state',
				'live',
			);
			await page.waitForTimeout(1000);
			const seen = await page.evaluate(() => {
				const w = window as unknown as { __shifts: string[]; __live: number };
				const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
				return { shifts: w.__shifts, live: w.__live, fcp };
			});
			expect(
				seen.live,
				`${size.width}x${size.height}: the field went live at ${Math.round(seen.live)}ms, before the first paint at ${Math.round(seen.fcp)}ms, so there was nothing to shift`,
			).toBeGreaterThan(seen.fcp);
			expect(seen.shifts, `${size.width}x${size.height}: the handover shifted layout`).toEqual([]);
			await cdp.detach();
			await context.close();
		}
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
