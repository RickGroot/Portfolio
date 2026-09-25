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

		const { a, b } = await layers(page);
		const rowsA = a.split('\n');
		const rowsB = b.split('\n');

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
					cells += 1;
					if (rowsA[y]?.[x] === ' ' && rowsB[y]?.[x] === ' ') blank += 1;
				}
			}
		}
		// The field has troughs of its own, about one cell in ten; the empty box
		// was every cell.
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
