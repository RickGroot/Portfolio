/**
 * The palette: the one source of every colour on the site.
 *
 * Paper is the table, card is the stock a card is printed on, ink is the one
 * line colour, and each card is flooded with one of five pigments. A pigment's
 * text colour is SOLVED here at build time -- ink, or card paper where ink
 * falls short -- and the build throws if neither reaches WCAG AA. Saturated
 * colours make that non-negotiable: ink on this blue measures 2.99:1.
 *
 * The palette and each pigment's solved text colour are emitted as inline
 * custom properties (BaseLayout's <html>, each card's own style); stylesheets
 * only read them, so there is no second hex value to drift. The one file that
 * cannot read a custom property, the web manifest, carries copies, and
 * tests/a11y/palette.spec.ts pins it here.
 *
 * Build time rather than CSS `oklch(from ...)`: the target includes real
 * Smart TV browsers, and a constant computed here is deterministic and
 * assertable in a test.
 */

type RGB = readonly [number, number, number];

const toLinear = (c: number): number =>
	c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

function parseHex(hex: string): RGB {
	const h = hex.replace('#', '');
	if (!/^[0-9a-fA-F]{6}$/.test(h)) {
		throw new Error(`palette: expected a 6-digit hex colour, got "${hex}"`);
	}
	return [
		parseInt(h.slice(0, 2), 16) / 255,
		parseInt(h.slice(2, 4), 16) / 255,
		parseInt(h.slice(4, 6), 16) / 255,
	];
}

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

/** WCAG AA for body text. */
export const AA = 4.5;

export const PALETTE = {
	paper: '#f2eee3',
	card: '#fbf9f3',
	ink: '#0e0e0e',
	yellow: '#ffc21a',
	orange: '#ff5c1c',
	red: '#ff145b',
	blue: '#2340ff',
	green: '#19c17a',
} as const;

export const PIGMENTS = ['yellow', 'orange', 'red', 'blue', 'green'] as const;
export type Pigment = (typeof PIGMENTS)[number];

export interface SolvedPigment {
	/** The flat field. */
	field: string;
	/** Everything printed on it: ink, or card paper where ink is too dark to read. */
	on: string;
	/** The solved ratio, for the test and for the curious. */
	ratio: number;
}

/** Picks the better of ink and card paper for a field, and refuses below AA. */
export function solve(name: Pigment): SolvedPigment {
	const field = PALETTE[name];
	const onInk = contrast(PALETTE.ink, field);
	const onCard = contrast(PALETTE.card, field);
	const [on, ratio] = onInk >= onCard ? [PALETTE.ink, onInk] : [PALETTE.card, onCard];
	if (ratio < AA) {
		throw new Error(
			`palette: no text colour reaches ${AA}:1 on ${name} ${field} ` +
				`(ink ${onInk.toFixed(2)}, card ${onCard.toFixed(2)}). Change the pigment.`,
		);
	}
	return { field, on, ratio };
}

/** Inline style for one card: its field and what is printed on it. */
export function pigmentStyle(name: Pigment): string {
	const { field, on } = solve(name);
	return `--field:${field};--on-field:${on}`;
}

/** The palette as custom properties, for <html style>. */
export function paletteStyle(): string {
	// Solving every pigment here makes a failing one stop the build on every
	// page, not only on a page that happens to use it.
	for (const p of PIGMENTS) solve(p);
	return Object.entries(PALETTE)
		.map(([k, v]) => `--${k}:${v}`)
		.join(';');
}
