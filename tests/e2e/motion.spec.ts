import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

test.use({ viewport: { width: 1280, height: 800 } });

/** Vertical offset a layer's transform adds, in px. 0 when it has none. */
const offsetOf = (page: Page, selector: string): Promise<number> =>
	page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) throw new Error(`no element for ${sel}`);
		const t = getComputedStyle(el).transform;
		return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42;
	}, selector);

/**
 * Jump without the section advance's smooth scrolling in the way, then let a
 * frame pass: scroll-driven animations update in the frame after the scroll,
 * so a read in the same task still sees the old position.
 */
const jumpTo = async (page: Page, y: number): Promise<void> => {
	await page.evaluate((top) => {
		document.documentElement.style.scrollBehavior = 'auto';
		window.scrollTo(0, top);
	}, y);
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
	);
};

test.describe('parallax', () => {
	test('at rest every layer is exactly where the layout put it', async ({ page }) => {
		// A section at rest is halfway through its own view timeline, which is
		// where every depth is zero. If this drifts, the composition at rest is
		// no longer the one that was designed.
		await page.goto('/#work');
		for (const layer of [
			'.guide--screen .guide__bar',
			'.guide--screen [data-preview][data-active] .guide__info',
			'.guide--screen [data-preview][data-active] .guide__screen',
			'.guide--screen .guide__grid',
		]) {
			expect(
				Math.abs(await offsetOf(page, layer)),
				`${layer} is off its rest position`,
			).toBeLessThan(1.5);
		}
	});

	test('the layers of a section move at different depths as it scrolls', async ({ page }) => {
		await page.goto('/');
		expect(Math.abs(await offsetOf(page, '.hero__copy h1 > span:last-child'))).toBeLessThan(1.5);

		await jumpTo(page, 320);
		const rick = await offsetOf(page, '.hero__copy h1 > span:first-child');
		const groot = await offsetOf(page, '.hero__copy h1 > span:last-child');
		const field = await offsetOf(page, '.hero .field');

		// Scrolling down, a forward layer moves up faster than the page (a
		// negative offset) and a back layer lags behind it (positive). The
		// name's two words are two planes: GROOT is nearer than RICK.
		expect(rick, 'RICK should come forward').toBeLessThan(-4);
		expect(groot, 'GROOT should come further forward than RICK').toBeLessThan(rick);
		expect(field, 'the portrait should sit back').toBeGreaterThan(4);
	});

	// The key art is the stage the case study stands on (Rick: "the image can
	// be full size with more parallax effect"). The stage scrolls with the
	// page; the picture on it falls behind to half speed, and the title lifts.
	test('a case study leaves in layers: the picture falls behind, the title lifts', async ({
		page,
	}) => {
		await page.goto('/work/vamp');
		const picture = '.info__screen img';
		expect(Math.abs(await offsetOf(page, picture)), 'the picture is off rest').toBeLessThan(1.5);
		expect(Math.abs(await offsetOf(page, '.info__titles'))).toBeLessThan(1.5);

		await jumpTo(page, 300);
		const moved = await offsetOf(page, picture);
		// Half speed: over 300px of page, the picture moves down about 150px
		// against the stage. Loose bounds -- the point is "a lot", not "exactly".
		expect(moved, 'the picture should fall well behind the page').toBeGreaterThan(90);
		expect(moved, 'the picture should still move with the page').toBeLessThan(260);
		expect(await offsetOf(page, '.info__titles'), 'the title should lift').toBeLessThan(-10);
	});

	test('a case study stage fills the width, and its picture never shows an edge', async ({
		page,
	}) => {
		await page.goto('/work/nlziet');
		for (const y of [0, 200, 400, 600]) {
			await jumpTo(page, y);
			const m = await page.evaluate(() => {
				const stage = document.querySelector('.info__screen')?.getBoundingClientRect();
				const img = document.querySelector('.info__screen img')?.getBoundingClientRect();
				if (!stage || !img) return null;
				// Only the part of the stage that is on screen has to be covered.
				return {
					stageW: stage.width,
					pageW: document.documentElement.clientWidth,
					gapTop: img.top - Math.max(stage.top, 0),
					gapBottom: Math.min(stage.bottom, window.innerHeight) - img.bottom,
				};
			});
			expect(m, 'no stage').not.toBeNull();
			expect(Math.abs(m!.stageW - m!.pageW), 'the stage is not the width of the page').toBeLessThan(
				1,
			);
			expect(m!.gapTop, `at ${y}px the picture's top edge shows`).toBeLessThanOrEqual(0.5);
			expect(m!.gapBottom, `at ${y}px the picture's bottom edge shows`).toBeLessThanOrEqual(0.5);
		}
	});

	// The gradient lifts with the title while the stage moves with the page, so
	// a strip of bare picture used to open under its solid base -- 57px of white
	// photograph by 300px of scroll (Rick: "broken on the gradient"), and then a
	// one-pixel seam once a band filled it edge to edge. Read from the pixels:
	// everything between the foot's lower edge and the stage's is the field.
	// Chromecast's white photograph is the worst case there is.
	test('a case study picture never shows bare under the lifting gradient', async ({ page }) => {
		for (const size of [
			{ width: 1280, height: 800 },
			{ width: 390, height: 844 },
		]) {
			await page.setViewportSize(size);
			await page.goto('/work/chromecast');
			await page.mouse.move(size.width - 2, size.height - 2);
			for (const y of [120, 260, 400, 540]) {
				await jumpTo(page, y);
				const box = await page.evaluate(() => {
					const foot = document.querySelector('.info__foot')?.getBoundingClientRect();
					const head = document.querySelector('.info__head')?.getBoundingClientRect();
					const back = document.querySelector('.info__back')?.getBoundingClientRect();
					return foot && head && back
						? { top: foot.bottom - 3, bottom: head.bottom, left: back.right + 8 }
						: null;
				});
				expect(box, 'no stage').not.toBeNull();
				const top = Math.max(0, Math.floor(box!.top));
				const bottom = Math.min(size.height, Math.floor(box!.bottom));
				if (bottom - top < 2) continue; // the stage has gone
				// Right of the pinned Guide button, which sits over this strip.
				const clip = { x: Math.ceil(box!.left), y: top, width: 0, height: bottom - top };
				clip.width = size.width - 20 - clip.x;
				const { data, info } = await sharp(await page.screenshot({ clip }))
					.raw()
					.toBuffer({ resolveWithObject: true });
				// Ultramarine, Chromecast's channel: #05005e.
				let worst = 0;
				for (let i = 0; i < data.length; i += info.channels) {
					const d =
						Math.abs(data[i]! - 5) + Math.abs(data[i + 1]! - 0) + Math.abs(data[i + 2]! - 94);
					if (d > worst) worst = d;
				}
				expect(
					worst,
					`${size.width}px, ${y}px down: picture shows under the gradient`,
				).toBeLessThan(8);
			}
		}
	});

	test('reduced motion: nothing moves', async ({ browser }) => {
		const context = await browser.newContext({ reducedMotion: 'reduce' });
		const page = await context.newPage();
		await page.goto('/');
		await jumpTo(page, 320);
		for (const layer of [
			'.hero__copy h1 > span:last-child',
			'.hero .field',
			'.guide--screen .guide__grid',
		]) {
			expect(await offsetOf(page, layer), `${layer} moved under reduced motion`).toBe(0);
		}
		await context.close();
	});
});

test.describe('changing channel', () => {
	test('shows the channel readout, then clears it', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(400);
		await page.keyboard.press('PageDown');

		const osd = page.locator('.osd');
		await expect(osd).toHaveCSS('opacity', '1');
		await expect(osd.locator('.osd__num')).toHaveText('02');
		// The name decodes in, so wait for it to resolve rather than sampling it.
		await expect(osd.locator('.osd__name')).toHaveText('Guide');
		await expect(osd).toHaveCSS('opacity', '0', { timeout: 5000 });
	});

	test('the new channel decodes its headline, and never leaves noise behind', async ({ page }) => {
		await page.goto('/#interlude-signal');
		// Record every text the heading shows, from before the change.
		await page.evaluate(() => {
			const h = document.getElementById('practice-heading') as HTMLElement;
			const seen: string[] = [];
			(window as unknown as { __seen: string[] }).__seen = seen;
			new MutationObserver(() => seen.push(h.textContent ?? '')).observe(h, {
				subtree: true,
				characterData: true,
				childList: true,
			});
		});
		await page.keyboard.press('PageDown');
		await page.waitForTimeout(1500);

		const { seen, text, label } = await page.evaluate(() => {
			const h = document.getElementById('practice-heading') as HTMLElement;
			return {
				seen: (window as unknown as { __seen: string[] }).__seen,
				text: (h.textContent ?? '').trim(),
				label: h.getAttribute('aria-label'),
			};
		});
		expect(
			seen.some((s) => s.trim() !== 'How I work'),
			'the headline never decoded',
		).toBe(true);
		expect(text, 'noise was left in the headline').toBe('How I work');
		expect(label, 'the decode left its aria-label behind').toBeNull();
	});

	// The display face is proportional, so a noise glyph is not the width of
	// its letter. src/lib/decode.ts holds every letter's measured width while
	// it runs; this watches every frame of a decode for anything moving.
	test('a decode never moves layout, though the display face is proportional', async ({ page }) => {
		type Frame = { text: string; spaces: number[]; h: number; lines: number; gap: number };
		await page.goto('/#interlude-signal');
		await page.waitForTimeout(600);
		await page.evaluate(() => {
			const h = document.getElementById('practice-heading') as HTMLElement;
			const frames: Frame[] = [];
			(window as unknown as { __frames: Frame[] }).__frames = frames;
			const tick = (): void => {
				const r = h.getBoundingClientRect();
				const range = document.createRange();
				range.selectNodeContents(h);
				const rects = [...range.getClientRects()].filter((q) => q.width > 0);
				// Where each word starts: the spaces between words are never
				// scrambled, and they move only if a word before them changed
				// width. A noise glyph may overhang its letter's box; that is
				// paint, not layout, and moves nothing.
				const spaces: number[] = [];
				const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
				for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
					for (let i = 0; i < n.data.length; i++) {
						if (n.data[i] !== ' ') continue;
						const at = document.createRange();
						at.setStart(n, i);
						at.setEnd(n, i + 1);
						spaces.push(at.getBoundingClientRect().left - r.left);
					}
				}
				frames.push({
					text: h.textContent ?? '',
					spaces,
					h: r.height,
					lines: new Set(rects.map((q) => Math.round(q.top))).size,
					// What follows the heading, measured from it: moves only if it does.
					gap: (h.nextElementSibling?.getBoundingClientRect().top ?? r.bottom) - r.bottom,
				});
				if (frames.length < 90) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
		await page.keyboard.press('PageDown');
		await page.waitForTimeout(1600);

		const frames = await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
		const end = frames[frames.length - 1]!;
		expect(end.text.trim(), 'noise was left in the headline').toBe('How I work');
		const noisy = frames.filter((f) => f.text !== end.text);
		expect(noisy.length, 'the heading never decoded').toBeGreaterThan(2);
		// Against where the heading lands. The page is still moving in the first
		// frames, so what follows is measured from the heading, and sizes directly.
		for (const f of noisy) {
			expect(f.spaces.length, 'a space was scrambled').toBe(end.spaces.length);
			f.spaces.forEach((x, i) => {
				expect(Math.abs(x - end.spaces[i]!), `a word moved in "${f.text}"`).toBeLessThan(0.5);
			});
			expect(Math.abs(f.h - end.h), 'the heading changed height').toBeLessThan(0.5);
			expect(f.lines, 'the heading rewrapped').toBe(end.lines);
			expect(Math.abs(f.gap - end.gap), 'what follows the heading moved').toBeLessThan(0.5);
		}
	});

	test('in the guide, a change of programme brings static, never more than one burst at a time', async ({
		page,
	}) => {
		await page.goto('/#work');
		// Let the arrival's own burst run out first.
		await page.waitForTimeout(800);
		// Every burst starts with one opacity animation on the static layer, and
		// every change of programme asks for one with channel:zap.
		type Log = { asked: number; starts: number[] };
		await page.evaluate(() => {
			const log: Log = { asked: 0, starts: [] };
			(window as unknown as { __zap: Log }).__zap = log;
			document.addEventListener('channel:zap', () => log.asked++);
			const zap = document.querySelector('.zap') as HTMLElement;
			const animate = zap.animate.bind(zap);
			zap.animate = (keyframes, options) => {
				log.starts.push(performance.now());
				return animate(keyframes, options);
			};
		});

		// A sweep through the guide, as fast as a pointer goes.
		for (const id of ['chromecast', 'vamp', 'chromecast', 'nlziet', 'vamp', 'nlziet']) {
			await page.locator(`#work [data-block="${id}"]`).hover();
		}
		await page.waitForTimeout(700);

		const { asked, starts } = await page.evaluate(
			() => (window as unknown as { __zap: Log }).__zap,
		);
		expect(starts.length, 'a change of programme brought no static').toBeGreaterThan(0);
		// Otherwise the sweep was too slow to test the rationing at all.
		expect(asked, 'the sweep never asked faster than the static can play').toBeGreaterThan(
			starts.length,
		);
		for (let i = 1; i < starts.length; i++) {
			expect(starts[i]! - starts[i - 1]!, 'the static strobed').toBeGreaterThanOrEqual(500);
		}
	});

	test('in the guide, the new ground wipes in and the chrome follows it', async ({ page }) => {
		await page.goto('/#work');
		await page.locator('#work [data-block="chromecast"]').hover();
		expect(
			await page.evaluate(
				() => document.querySelector('[data-guide-wipe]')?.getAnimations().length ?? 0,
			),
			'the ground did not wipe',
		).toBeGreaterThan(0);
		await expect
			.poll(() =>
				page.evaluate(
					() => getComputedStyle(document.getElementById('work') as HTMLElement).backgroundColor,
				),
			)
			.toBe('rgb(5, 0, 94)');
	});
});
