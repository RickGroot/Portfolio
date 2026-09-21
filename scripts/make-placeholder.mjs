#!/usr/bin/env node
/*
 * Generates the placeholder portrait the character field resolves into, until a
 * real photograph exists.
 *
 * Why generated rather than a stock photo: it is licence-clean, it is obviously
 * not a person, and it can be built with exactly the properties a real portrait
 * needs in order to survive being reduced to ~80x40 characters --
 *
 *   - subject fills most of the frame
 *   - EYES ARE VISIBLE (the single feature that makes a low-res face legible)
 *   - strong directional light, so the luminance ramp has range to work with
 *   - plain background well separated from the subject in luminance
 *
 * The current real photo (src/assets/rick.jpg) has none of those: sunglasses,
 * head at ~7% of frame height, and foliage at the same luminance as the subject.
 *
 * Run:  node scripts/make-placeholder.mjs
 * Out:  src/assets/portrait-placeholder.png
 */

import sharp from 'sharp';

const SIZE = 1024;
const OUT = 'src/assets/portrait-placeholder.png';

// Light direction, normalised. Up and to the left, slightly toward camera.
const LX = -0.48;
const LY = -0.62;
const LZ = 0.62;

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
const smoothstep = (a, b, x) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};

/** Lambertian + a little rim light, for a surface normal. */
function shade(nx, ny, nz) {
	const diffuse = clamp01(nx * LX + ny * LY + nz * LZ);
	const rim = Math.pow(clamp01(1 - nz), 3) * 0.22;
	return clamp01(0.1 + diffuse * 0.82 + rim);
}

const buf = Buffer.alloc(SIZE * SIZE);

for (let py = 0; py < SIZE; py++) {
	for (let px = 0; px < SIZE; px++) {
		// Normalised coords, origin at centre, y down.
		const x = (px / SIZE) * 2 - 1;
		const y = (py / SIZE) * 2 - 1;

		// Background: a soft vertical falloff, kept dark so the subject separates.
		let v = 0.1 - y * 0.05;

		/* ---- shoulders: a wide, shallow ellipse low in the frame ---------- */
		const sx = x / 0.92;
		const sy = (y - 1.02) / 0.62;
		const sd = sx * sx + sy * sy;
		if (sd < 1) {
			const nz = Math.sqrt(1 - Math.min(1, sd));
			v = shade(sx * 0.55, sy * 0.55, nz) * 0.62;
		}

		/* ---- neck --------------------------------------------------------- */
		const nx2 = x / 0.17;
		const ny2 = (y - 0.42) / 0.3;
		if (nx2 * nx2 + ny2 * ny2 < 1) {
			v = shade(nx2 * 0.8, 0, Math.sqrt(1 - Math.min(1, nx2 * nx2))) * 0.5;
		}

		/* ---- head: an ellipsoid ------------------------------------------- */
		const hx = x / 0.46;
		const hy = (y + 0.16) / 0.58;
		const hd = hx * hx + hy * hy;
		if (hd < 1) {
			const nz = Math.sqrt(1 - hd);
			v = shade(hx, hy, nz);

			// Brow ridge shadow, so the eyes sit in a socket.
			v -= 0.2 * smoothstep(0.22, 0.02, Math.abs(y + 0.3));

			/* ---- eyes: the feature that makes this read as a face --------- */
			for (const ex of [-0.185, 0.185]) {
				const dx = (x - ex) / 0.115;
				const dy = (y + 0.245) / 0.06;
				const d = dx * dx + dy * dy;
				if (d < 1) {
					// socket dark, then a bright specular catchlight off-centre
					v = v * 0.28;
					const cx = (x - ex + 0.028) / 0.035;
					const cy = (y + 0.262) / 0.028;
					if (cx * cx + cy * cy < 1) v = 0.97;
				}
			}

			// Nose: a lit ridge with a shadow on the unlit side.
			const noseR = Math.hypot((x - 0.012) / 0.075, (y + 0.02) / 0.16);
			if (noseR < 1) v += 0.16 * (1 - noseR);
			const noseS = Math.hypot((x - 0.1) / 0.07, (y + 0.01) / 0.15);
			if (noseS < 1) v -= 0.17 * (1 - noseS);

			// Mouth line.
			const mx = x / 0.17;
			const my = (y + -0.215) / 0.035;
			if (mx * mx + my * my < 1) v -= 0.22;

			// Jaw/cheek shading on the far side.
			v -= 0.12 * smoothstep(0.25, 0.85, x);
		}

		buf[py * SIZE + px] = Math.round(clamp01(v) * 255);
	}
}

await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 1 } })
	.png({ compressionLevel: 9, palette: true })
	.toFile(OUT);

const { size } = await sharp(OUT).metadata();
console.log(`wrote ${OUT} (${SIZE}x${SIZE}, ${(size / 1024).toFixed(1)} KB)`);
