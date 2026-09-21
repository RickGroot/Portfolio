#!/usr/bin/env node
/*
 * Generates the art-interlude images.
 *
 * These are PLACEHOLDERS for Rick's photography, but real images rather than
 * grey boxes, so the layout can be judged for what it will actually be.
 *
 * They are generated for the same reasons as the portrait placeholder: no
 * licence question, obviously not a photograph, and built to the properties the
 * treatment needs -- strong structure and a wide luminance range.
 *
 * The forms are interference and flow patterns, which is the "Human Signal"
 * idea at its most literal: a field resolving into structure.
 *
 * DELIBERATELY SMOOTH. The first version quantised these through an ordered
 * dither, which looked right in isolation and was a real mistake: high-frequency
 * noise is the worst possible input for WebP, and the asset gate caught the
 * result at 507 KB for a backdrop CSS then darkens to 42% brightness. The
 * screen the design wants is applied at display time by `.art__dither`, over
 * the rendered pixels, at a period tied to CSS pixels rather than to whatever
 * `srcset` candidate the browser happened to pick. Baking it into the source
 * both doubled the effect and destroyed compressibility.
 *
 * Run:  node scripts/make-art.mjs
 * Out:  src/assets/art/*.webp
 */

import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';

const W = 1600;
const H = 1000;
const OUT = 'src/assets/art';

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Interference: overlapping radial waves, the classic moire field.
 * Reads as signal.
 */
function interference(x, y, seed) {
	const sources = [
		[0.22, 0.32, 0.055],
		[0.78, 0.28, 0.041],
		[0.55, 0.82, 0.068],
		[0.12, 0.88, 0.033],
	];
	let v = 0;
	for (const [sx, sy, freq] of sources) {
		const dx = (x - sx * W) / W;
		const dy = (y - sy * H) / H;
		v += Math.sin(Math.sqrt(dx * dx + dy * dy) * (1 / freq) * Math.PI * 2 + seed);
	}
	return clamp01(v / sources.length / 2 + 0.5);
}

/** Flow: layered directional bands warped by a slow noise, like a contour map. */
function flow(x, y, seed) {
	const u = x / W;
	const t = y / H;
	const warp =
		Math.sin(u * 5.3 + seed) * 0.16 +
		Math.sin(t * 7.1 - seed * 0.7) * 0.11 +
		Math.sin((u + t) * 3.7) * 0.07;
	const bands = Math.sin((t + warp) * Math.PI * 14);
	const falloff = 1 - Math.abs(t - 0.5) * 0.7;
	return clamp01((bands * 0.5 + 0.5) * falloff);
}

async function render(name, field, seed, contrast) {
	const buf = Buffer.alloc(W * H);
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			// Push toward the ends of the range: the treatment needs contrast.
			const v = clamp01((field(x, y, seed) - 0.5) * contrast + 0.5);
			buf[y * W + x] = Math.round(v * 255);
		}
	}

	// WebP, not PNG. Lossless PNG of an interference field is ~1.1 MB because
	// the rings near each source are genuinely high-frequency, and these are
	// placeholders bound for git history. Astro re-encodes to WebP regardless,
	// and the page then greyscales, darkens to 42% and screens the result, so
	// q92 generation loss has nothing left to show by the time it is on screen.
	const file = `${OUT}/${name}.webp`;
	await sharp(buf, { raw: { width: W, height: H, channels: 1 } })
		// A sub-pixel blur costs nothing visible on a field this smooth and
		// removes the last of the sampling stairstep, which is what a lossy
		// encoder spends its bits on.
		.blur(0.4)
		.webp({ quality: 92, effort: 6 })
		.toFile(file);

	const { width, height } = await sharp(file).metadata();
	const { size } = statSync(file);
	console.log(`  ${file}  ${width}x${height}  ${(size / 1024).toFixed(1)} KB`);
}

mkdirSync(OUT, { recursive: true });
await render('signal', interference, 1.7, 1.45);
await render('field', flow, 0.6, 1.3);
