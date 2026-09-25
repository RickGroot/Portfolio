import { test, expect } from '@playwright/test';
import sharp from 'sharp';

/**
 * The hero's copy stands on the character field itself, over the portrait, on
 * a ground the field runs out into -- no plates (Rick, 2026-09-25, the title
 * card). axe cannot judge that: the background is a moving field of glyphs. So
 * this reads the pixels, as stage-contrast.spec.ts does for the case studies:
 * hide the copy, take the brightest pixel behind each block's ink across
 * several frames -- the field never stands still -- first with the pointer
 * away and then with it over the name, where the lens changes the glyphs.
 *
 * The ink, not the box: each word of the name is a block, as wide as the
 * column, and its box runs straight across the face.
 *
 * The sizes are the ones that failed while the ground was tuned: a short
 * laptop, where the copy climbs into the chin, and a small phone, where it
 * crosses the whole face.
 */

const luminance = (r: number, g: number, b: number): number => {
	const f = (c: number): number => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** The name is large text: 3:1. The eyebrow and the lede are body text: 4.5:1. */
const FLOORS = { eyebrow: 4.5, rick: 3, groot: 3, lede: 4.5 } as const;
const SELECTORS = {
	eyebrow: '.hero__eyebrow',
	rick: '.hero__copy h1 > span:first-child',
	groot: '.hero__copy h1 > span:last-child',
	lede: '.hero .lede',
} as const;

/** The field's entry, ENTRY_MS in src/lib/field/field.ts, plus a margin. */
const PAST_ENTRY_MS = 3600;

type Rect = { x: number; y: number; w: number; h: number };

for (const size of [
	{ width: 1440, height: 900 },
	{ width: 1280, height: 720 },
	{ width: 390, height: 844 },
	{ width: 360, height: 640 },
]) {
	test(`${size.width}x${size.height}: the hero's copy clears its floor over the live field`, async ({
		page,
	}) => {
		test.slow();
		await page.setViewportSize(size);
		await page.goto('/', { waitUntil: 'networkidle' });
		await page.evaluate(() => document.fonts.ready);
		await page.mouse.move(size.width - 2, 2);
		await expect(page.locator('[data-character-field]')).toHaveAttribute(
			'data-field-state',
			'live',
		);
		await page.waitForTimeout(PAST_ENTRY_MS);

		const blocks = await page.evaluate((selectors) => {
			const out: Record<string, { rects: Rect[]; c: number[] }> = {};
			for (const [k, sel] of Object.entries(selectors)) {
				const el = document.querySelector(sel);
				if (!el) continue;
				const range = document.createRange();
				range.selectNodeContents(el);
				const rects = [...range.getClientRects()]
					.filter((r) => r.width > 1)
					.map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
				const c = (getComputedStyle(el).color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
				out[k] = { rects, c };
			}
			const hide = document.createElement('style');
			hide.textContent =
				'.hero__copy, .hero__copy * { color: transparent !important; } ' +
				'.cursor__dot, .cursor__ring { display: none !important; }';
			document.head.append(hide);
			return out;
		}, SELECTORS);
		expect(Object.keys(blocks), 'every block of the copy was found').toHaveLength(4);

		// Only the copy is read, so only the copy is captured: a full-screen
		// capture decoded six times over starved the rest of a parallel run.
		const all = Object.values(blocks).flatMap((b) => b.rects);
		const x0 = Math.max(0, Math.floor(Math.min(...all.map((r) => r.x))));
		const y0 = Math.max(0, Math.floor(Math.min(...all.map((r) => r.y))));
		const clip = {
			x: x0,
			y: y0,
			width: Math.min(size.width, Math.ceil(Math.max(...all.map((r) => r.x + r.w)))) - x0,
			height: Math.min(size.height, Math.ceil(Math.max(...all.map((r) => r.y + r.h)))) - y0,
		};

		const brightest: Record<string, number> = {};
		for (const pointer of ['away', 'over'] as const) {
			if (pointer === 'over') {
				const g = blocks.groot!.rects[0]!;
				await page.mouse.move(g.x + g.w / 2, g.y + g.h / 2, { steps: 8 });
			}
			for (let frame = 0; frame < 3; frame++) {
				await page.waitForTimeout(400);
				const { data, info } = await sharp(await page.screenshot({ clip }))
					.raw()
					.toBuffer({ resolveWithObject: true });
				for (const [k, b] of Object.entries(blocks)) {
					for (const r of b.rects) {
						const top = Math.max(0, Math.floor(r.y) - y0);
						const left = Math.max(0, Math.floor(r.x) - x0);
						const bottom = Math.min(info.height, Math.ceil(r.y + r.h) - y0);
						const right = Math.min(info.width, Math.ceil(r.x + r.w) - x0);
						for (let y = top; y < bottom; y++) {
							for (let x = left; x < right; x++) {
								const i = (y * info.width + x) * info.channels;
								const l = luminance(data[i]!, data[i + 1]!, data[i + 2]!);
								if (l > (brightest[k] ?? 0)) brightest[k] = l;
							}
						}
					}
				}
			}
		}

		for (const [k, b] of Object.entries(blocks)) {
			const text = luminance(b.c[0]!, b.c[1]!, b.c[2]!);
			const behind = brightest[k] ?? 0;
			const ratio = (Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05);
			expect(
				ratio,
				`${k} is ${ratio.toFixed(2)}:1 against the brightest pixel behind it`,
			).toBeGreaterThanOrEqual(FLOORS[k as keyof typeof FLOORS]);
		}
	});
}
