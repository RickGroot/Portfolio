/**
 * Per-entry accent colours, made safe to put text on.
 *
 * Work entries carry a brand colour in frontmatter. Several of them are far too
 * dark to use against the page ground -- Chromecast's `#2c2c2c` measures 1.34:1
 * and KIJK's `#431093` 1.55:1, so a `::selection` painted in the raw accent made
 * text *less* readable, not more. axe does not check `::selection`, which is why
 * a green test suite missed it.
 *
 * `ink()` raises lightness in OKLCH until the colour clears AA, keeping hue and
 * as much chroma as the sRGB gamut allows. NLZIET stays hot pink, Chromecast
 * stays a neutral grey -- each entry still reads as its own brand.
 *
 * This runs at BUILD time, not in CSS. `oklch(from …)` would be more elegant but
 * is newly-available and needs a @supports fallback, and Phase 6 targets real
 * Smart TV browsers. A constant computed here is deterministic, costs nothing at
 * runtime, and can be asserted in a test.
 */

type RGB = readonly [number, number, number];

/* ---- sRGB <-> linear ---------------------------------------------------- */

const toLinear = (c: number): number =>
	c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const toGamma = (c: number): number =>
	c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

function parseHex(hex: string): RGB {
	const h = hex.replace('#', '');
	if (!/^[0-9a-fA-F]{6}$/.test(h)) {
		throw new Error(`accent: expected a 6-digit hex colour, got "${hex}"`);
	}
	return [
		parseInt(h.slice(0, 2), 16) / 255,
		parseInt(h.slice(2, 4), 16) / 255,
		parseInt(h.slice(4, 6), 16) / 255,
	];
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function toHex([r, g, b]: RGB): string {
	const part = (n: number): string =>
		Math.round(clamp01(n) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${part(r)}${part(g)}${part(b)}`;
}

/* ---- OKLab (Björn Ottosson) --------------------------------------------- */

function linearToOklab([r, g, b]: RGB): RGB {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

function oklabToLinear([L, A, B]: RGB): RGB {
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

const inGamut = ([r, g, b]: RGB): boolean =>
	r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;

/** OKLCH -> sRGB hex, reducing chroma until the colour fits the gamut. */
function oklchToHex(L: number, C: number, H: number): string {
	let lo = 0;
	let hi = C;
	let best: RGB = [0, 0, 0];

	// 24 iterations resolves chroma far finer than 8-bit output can show.
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		const lab: RGB = [L, mid * Math.cos(H), mid * Math.sin(H)];
		const rgb = oklabToLinear(lab);
		if (inGamut(rgb)) {
			best = rgb;
			lo = mid;
		} else {
			hi = mid;
		}
	}

	return toHex(best.map(toGamma) as unknown as RGB);
}

/* ---- public ------------------------------------------------------------- */

/** WCAG relative luminance. */
export function luminance(hex: string): number {
	const [r, g, b] = parseHex(hex).map(toLinear);
	return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
	const la = luminance(a);
	const lb = luminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The lightness floor.
 *
 * 0.72 was chosen by measuring every entry accent in the collection: it is the
 * lowest floor at which all of them clear 4.5:1 on the page ground. A higher
 * floor (0.78) also clears, but washes NLZIET's pink out noticeably.
 */
export const INK_LIGHTNESS = 0.72;

/**
 * Raise an accent to a lightness that is safe to read against a dark ground,
 * preserving hue and as much chroma as sRGB allows.
 */
export function ink(hex: string, floor: number = INK_LIGHTNESS): string {
	const [L, A, B] = linearToOklab(parseHex(hex).map(toLinear) as unknown as RGB);
	if (L >= floor) return hex.toLowerCase();

	const C = Math.hypot(A, B);
	const H = Math.atan2(B, A);
	return oklchToHex(floor, C, H);
}
