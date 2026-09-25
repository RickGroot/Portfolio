import { test, expect } from '@playwright/test';
import sharp from 'sharp';

/**
 * A case study's title stands on a gradient over its key art, not on a plate
 * (Rick, 2026-09-25: "I don't really like the background on those texts").
 * axe cannot judge that -- the background is a photograph -- so this reads the
 * pixels: hide the text, take the brightest pixel behind each block, and hold
 * the block's own colour to the contrast floor against it. The brightest pixel,
 * because every case study is on a deep channel and its text is light: that
 * pixel is the worst case anywhere behind the words.
 */

const luminance = (r: number, g: number, b: number): number => {
	const f = (c: number): number => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/** The title is large text: 3:1. Everything else is body text: 4.5:1. */
const FLOORS = { title: 3, status: 4.5, lede: 4.5 } as const;
const SELECTORS = { title: '.info__title', status: '.info__status', lede: '.info__lede' } as const;

for (const size of [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 },
]) {
	for (const slug of ['nlziet', 'chromecast', 'vamp', 'kijk', 'nos', 'streamz-vtm-go']) {
		test(`${size.width}px /work/${slug}: the stage's text clears its floor over the picture`, async ({
			page,
		}) => {
			await page.setViewportSize(size);
			await page.goto(`/work/${slug}`, { waitUntil: 'networkidle' });
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(size.width - 2, size.height - 2);
			await page.waitForTimeout(800);

			const blocks = await page.evaluate((selectors) => {
				const out: Record<string, { x: number; y: number; w: number; h: number; c: number[] }> = {};
				for (const [k, sel] of Object.entries(selectors)) {
					const el = document.querySelector(sel);
					if (!el) continue;
					const r = el.getBoundingClientRect();
					const c = (getComputedStyle(el).color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
					out[k] = { x: r.left, y: r.top, w: r.width, h: r.height, c };
				}
				const hide = document.createElement('style');
				hide.textContent = `${Object.values(selectors).join(',')}, .info__status * { color: transparent !important; background: transparent !important; }`;
				document.head.append(hide);
				return out;
			}, SELECTORS);
			await page.waitForTimeout(150);

			const { data, info } = await sharp(await page.screenshot())
				.raw()
				.toBuffer({ resolveWithObject: true });
			for (const [k, b] of Object.entries(blocks)) {
				let brightest = 0;
				for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(info.height, b.y + b.h); y++) {
					for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(info.width, b.x + b.w); x++) {
						const i = (y * info.width + x) * info.channels;
						brightest = Math.max(brightest, luminance(data[i]!, data[i + 1]!, data[i + 2]!));
					}
				}
				const text = luminance(b.c[0]!, b.c[1]!, b.c[2]!);
				const ratio = (Math.max(text, brightest) + 0.05) / (Math.min(text, brightest) + 0.05);
				expect(
					ratio,
					`${k} is ${ratio.toFixed(2)}:1 against the brightest pixel behind it`,
				).toBeGreaterThanOrEqual(FLOORS[k as keyof typeof FLOORS]);
			}
		});
	}
}
