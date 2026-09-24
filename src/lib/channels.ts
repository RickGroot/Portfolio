/**
 * Channels: the colour system.
 *
 * Every full-screen section is a channel with one flat colour field. The
 * "mark" -- the colour of everything drawn on it -- is SOLVED here at build
 * time, never picked by eye, and the build fails if a channel cannot reach
 * WCAG AA. Saturated fields make this non-negotiable: ink on electric blue
 * measures 2.99:1 and paper on the NLZIET red 3.29:1, so a field's mark is
 * not a matter of taste.
 *
 * This file is the single source of every colour on the site. The palette and
 * each channel's solved colours are emitted as inline custom properties
 * (BaseLayout's <html>, and each section), and the stylesheets only ever read
 * them -- there is no second copy of a hex value to drift out of sync. The two
 * files that cannot read a custom property, public/favicon.svg and the web
 * manifest, carry copies, and tests/a11y/channels.spec.ts pins them here.
 *
 * Build time, not CSS `oklch(from ...)`: the target includes real Smart TV
 * browsers, and a constant computed here is deterministic, free at runtime and
 * assertable in a test.
 */

type RGB = readonly [number, number, number];

/* ---- sRGB <-> linear <-> OKLab ------------------------------------------- */

const toLinear = (c: number): number =>
	c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const toGamma = (c: number): number =>
	c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function parseHex(hex: string): RGB {
	const h = hex.replace('#', '');
	if (!/^[0-9a-fA-F]{6}$/.test(h)) {
		throw new Error(`channels: expected a 6-digit hex colour, got "${hex}"`);
	}
	return [
		parseInt(h.slice(0, 2), 16) / 255,
		parseInt(h.slice(2, 4), 16) / 255,
		parseInt(h.slice(4, 6), 16) / 255,
	];
}

function toHex([r, g, b]: RGB): string {
	const part = (n: number): string =>
		Math.round(clamp01(n) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${part(r)}${part(g)}${part(b)}`;
}

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

const hexToOklab = (hex: string): RGB =>
	linearToOklab(parseHex(hex).map(toLinear) as unknown as RGB);

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
 * Mix `a` toward `b` by `t` (0 = a, 1 = b) in OKLab, so the midpoint of two
 * saturated colours stays saturated instead of going grey the way an sRGB mix
 * does.
 */
export function mix(a: string, b: string, t: number): string {
	const [L1, A1, B1] = hexToOklab(a);
	const [L2, A2, B2] = hexToOklab(b);
	const lab: RGB = [L1 + (L2 - L1) * t, A1 + (A2 - A1) * t, B1 + (B2 - B1) * t];
	return toHex(oklabToLinear(lab).map(toGamma) as unknown as RGB);
}

/* ---- the palette ---------------------------------------------------------- */

/**
 * Broadcast primaries: flat fields taken from Rick's own reference video --
 * halftone on yellow, dither on electric blue, the red of a broadcast poster --
 * plus warm paper, ink, and brass for the music work.
 *
 * `red` is NLZIET's own brand colour, so the NLZIET channel is the one place
 * the palette and a client's identity are the same colour.
 */
export const PALETTE = {
	ink: '#0e0e0e',
	paper: '#f2eee3',
	yellow: '#ffd400',
	blue: '#2340ff',
	red: '#ff145b',
	navy: '#0b1233',
	brass: '#e0a526',
} as const;

export const CHANNELS = ['ink', 'paper', 'yellow', 'blue', 'red', 'navy'] as const;
export type Channel = (typeof CHANNELS)[number];

const FIELDS: Record<Channel, string> = {
	ink: PALETTE.ink,
	paper: PALETTE.paper,
	yellow: PALETTE.yellow,
	blue: PALETTE.blue,
	red: PALETTE.red,
	navy: PALETTE.navy,
};

/**
 * A second colour for small details -- the channel number, a link, the index
 * on a card. A channel without one uses its mark: on the saturated fields a
 * third colour would fight the field instead of accenting it. Every accent is
 * contrast-checked exactly like the mark, because links are text.
 */
const ACCENTS: Partial<Record<Channel, string>> = {
	ink: PALETTE.yellow,
	paper: PALETTE.blue,
	navy: PALETTE.brass,
};

/** WCAG AA for body text. */
export const AA = 4.5;

export interface ChannelColours {
	field: string;
	/** Everything drawn on the field: text, rules, marks. */
	mark: string;
	/** Secondary text: the mark dimmed up to 30% toward the field, as far as AA
	 *  allows. On the NLZIET red, where ink only reaches 5.06:1, AA allows so
	 *  little that it is barely distinguishable from the mark. */
	markDim: string;
	/** Small details. Equal to the mark where a channel has no accent. */
	accent: string;
	/** Decorative hairlines only -- never the only thing identifying a control. */
	line: string;
	lineLoud: string;
	/**
	 * How a photograph takes the channel's two colours. A dark mark multiplies
	 * (the photo prints in ink on the field); a light mark screens (it prints in
	 * paper). Either way the image is made of exactly the channel's colours, so
	 * it can never read as a darkened photo laid on a colour.
	 */
	blend: 'multiply' | 'screen';
}

function solve(name: Channel): ChannelColours {
	const field = FIELDS[name];

	// Ink or paper, whichever reads better. Nothing else is ever a candidate for
	// the mark: two neutrals are what keep the saturated fields from clashing.
	const mark =
		contrast(PALETTE.ink, field) >= contrast(PALETTE.paper, field) ? PALETTE.ink : PALETTE.paper;
	const markContrast = contrast(mark, field);
	if (markContrast < AA) {
		throw new Error(
			`channels: "${name}" (${field}) cannot carry text -- its best mark ${mark} reaches ` +
				`${markContrast.toFixed(2)}:1, below ${AA}:1. Pick a different field colour.`,
		);
	}

	// Dim toward the field in 1% steps, stopping at the last step that still
	// clears AA with a small margin for rounding in the browser's own maths.
	//
	// Capped at 30%, not searched to the AA floor. The first version dimmed as
	// far as AA allowed and landed on #817f79 over ink: compliant at 4.82:1 and
	// exactly the murky grey the redesign exists to remove. Secondary text is a
	// step down in hierarchy, not a step toward the dark.
	let markDim: string = mark;
	for (let t = 0.3; t > 0; t -= 0.01) {
		const candidate = mix(mark, field, t);
		if (contrast(candidate, field) >= AA + 0.1) {
			markDim = candidate;
			break;
		}
	}

	const accent = ACCENTS[name] ?? mark;
	const accentContrast = contrast(accent, field);
	if (accentContrast < AA) {
		throw new Error(
			`channels: the accent for "${name}" (${accent} on ${field}) is ` +
				`${accentContrast.toFixed(2)}:1, below ${AA}:1. Accents are used for links.`,
		);
	}

	return {
		field,
		mark,
		markDim,
		accent,
		line: mix(mark, field, 0.72),
		lineLoud: mix(mark, field, 0.45),
		blend: luminance(mark) < 0.5 ? 'multiply' : 'screen',
	};
}

// Solved once per build, at import. A misconfigured channel throws here, which
// fails `astro build` -- the contrast floor is enforced, not remembered.
const SOLVED = Object.fromEntries(CHANNELS.map((c) => [c, solve(c)])) as Record<
	Channel,
	ChannelColours
>;

export function channel(name: Channel): ChannelColours {
	return SOLVED[name];
}

/** The custom properties a channel sets on the element that owns it. */
export function channelStyle(name: Channel): string {
	const c = SOLVED[name];
	return [
		`--field:${c.field}`,
		`--mark:${c.mark}`,
		`--mark-dim:${c.markDim}`,
		`--accent:${c.accent}`,
		`--line:${c.line}`,
		`--line-loud:${c.lineLoud}`,
		`--duo-blend:${c.blend}`,
	].join(';');
}

/**
 * How a cover marked `coverInvert` is printed (src/styles/surfaces.css .duo):
 * as a negative, with the contrast pushed harder than a positive print. A logo's
 * dark background only inverts to a light grey, and a light grey multiplied by
 * the field is a duller version of the field -- the extra contrast takes it the
 * rest of the way to the field itself.
 */
export const NEGATIVE_PRINT = '--duo-invert:1;--duo-contrast:1.6';

/** The palette as custom properties, for the <html> element. */
export function paletteStyle(): string {
	return [
		`--ink:${PALETTE.ink}`,
		`--paper:${PALETTE.paper}`,
		`--signal-yellow:${PALETTE.yellow}`,
		`--signal-blue:${PALETTE.blue}`,
		`--signal-red:${PALETTE.red}`,
		`--navy:${PALETTE.navy}`,
		`--brass:${PALETTE.brass}`,
	].join(';');
}
