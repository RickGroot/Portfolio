/**
 * The character field.
 *
 * Renders a grid of characters into two stacked <pre> elements -- one per
 * colour -- recomputed at 60fps and written as two strings. No canvas, no WebGL,
 * no graphics context to lose.
 *
 * One blue, two strengths: the field in the palette's signal blue, and the lit
 * part of the portrait in a lighter tint of it (--art-signal), so the face reads
 * as the field brightening, not as a second picture laid over it. The field's
 * motion carries on through the face as a shimmer.
 *
 * Measured on this approach (120x60 = 7200 cells, forced layout every frame):
 *   one <pre>, single colour      1.18 ms/frame
 *   two stacked <pre>, two colours 2.22 ms/frame   <- this
 *   one <span> per cell            40.71 ms/frame  <- 2.5x over a 60fps budget
 *
 * The colour split is free because it IS the resolve state: a cell that has
 * developed into the lit portrait goes to layer B, anything else to layer A,
 * and each writes a space to the other. At rest one layer is entirely spaces
 * and its write is skipped, so the field spends almost all its life at
 * single-layer cost.
 */

import { subscribe } from './loop';
import { MAP, MAP_SIZE, MAP_LEVELS } from '../../generated/portrait-map';

/** Must match RAMP in scripts/build-portrait-map.mjs.
 *  ASCII only: a block character missing from the user's font falls back
 *  per-glyph with an unconstrained advance, which shears the whole line.
 *  No letters either -- a field of random letters produces accidental words. */
const RAMP = ' .:-=+*#%@';
const RAMP_MAX = RAMP.length - 1;
const ALPHABET = '0123456789ab';

const MAX_CELLS = 6000;
const MIN_COLS = 24;
/** Pointer energy half-life. */
const ENERGY_TAU = 350;
/** How fast resolve catches up to its target. */
const P_TAU = 260;
/** Length of the load-time scatter-and-decode sequence. */
const ENTRY_MS = 3200;
/** How much of the resolve a cell takes to develop, in units of p. */
const DEVELOP = 0.14;
/**
 * The darkest map level belongs to the field, not the portrait: where the
 * photograph is black, the live field shows through. As portrait, those
 * cells resolved to spaces, and the face sat in an empty box cut out of the
 * field. On the current map that is exactly the matte around the head; the
 * darkest feature inside the face is level 1.
 */
const FIELD_LEVEL = 0;

export interface FieldHandle {
	destroy(): void;
}

const clamp = (n: number, lo: number, hi: number): number => (n < lo ? lo : n > hi ? hi : n);

/** Cheap deterministic per-cell hash, 0..1. */
function hash(x: number, y: number): number {
	let h = (x * 374761393 + y * 668265263) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Measure the real rendered advance width, rather than assuming one.
 *
 * Cell aspect varies by font (0.55 on Consolas, 0.60 on Courier New) and the
 * user's minimum-font-size setting can inflate it further. Measuring also
 * detects the failure that matters: a stack resolving to a proportional face,
 * which would shear the grid.
 */
function measure(host: HTMLElement): { cellW: number; rowH: number } | null {
	const probe = document.createElement('pre');
	const cs = getComputedStyle(host);
	probe.style.cssText =
		'position:absolute;visibility:hidden;left:-9999px;top:0;margin:0;white-space:pre;' +
		`font-family:${cs.fontFamily};font-size:${cs.fontSize};line-height:${cs.lineHeight};` +
		'font-variant-ligatures:none;font-kerning:none;letter-spacing:0';
	host.appendChild(probe);

	probe.textContent = '0'.repeat(64);
	const narrow = probe.getBoundingClientRect().width;
	probe.textContent = 'W'.repeat(64);
	const wide = probe.getBoundingClientRect().width;
	probe.textContent = 'x\nx\nx\nx';
	const rowH = probe.getBoundingClientRect().height / 4;

	probe.remove();

	// Not actually monospace -> the grid cannot hold. Bail to the static frame.
	if (Math.abs(narrow - wide) > 0.5 || narrow <= 0 || rowH <= 0) return null;
	return { cellW: narrow / 64, rowH };
}

export function mountField(host: HTMLElement): FieldHandle {
	const layerA = host.querySelector<HTMLPreElement>('[data-layer="a"]');
	const layerB = host.querySelector<HTMLPreElement>('[data-layer="b"]');
	if (!layerA || !layerB) return { destroy: () => undefined };

	// Bound after the guard so the narrowing survives into the frame closure.
	const preA: HTMLPreElement = layerA;
	const preB: HTMLPreElement = layerB;

	let cols = 0;
	let rows = 0;
	let thresh = new Float32Array(0);
	let portrait = new Int16Array(0);
	let rowsA: string[] = [];
	let rowsB: string[] = [];

	let p = 1; // start resolved, matching the server-rendered static frame
	let pTarget = 1;
	/** Hero visibility, 0..1, from IntersectionObserver. */
	let visible = 1;
	/** ms since mount, for the entry sequence. */
	let age = -1;
	let energy = 0;
	let px = 0;
	let py = 0;
	let wroteA = true;
	let wroteB = true;
	let alive = true;
	let lastStep = '';

	/* ---- geometry ------------------------------------------------------- */

	function layout(): boolean {
		const m = measure(host);
		if (!m) return false;

		const rect = host.getBoundingClientRect();
		let c = Math.floor(rect.width / m.cellW);
		let r = Math.floor(rect.height / m.rowH);
		if (c < MIN_COLS || r < 4) return false;

		// Keep the cell count bounded regardless of viewport.
		if (c * r > MAX_CELLS) {
			const k = Math.sqrt(MAX_CELLS / (c * r));
			c = Math.max(MIN_COLS, Math.floor(c * k));
			r = Math.max(4, Math.floor(r * k));
		}

		cols = c;
		rows = r;
		px = cols / 2;
		py = rows / 2;

		const cellAspect = m.cellW / m.rowH;

		// The portrait occupies a box, not the whole grid: a face emerging from
		// a still-live field reads far better than a rectangle appearing. And
		// only the lit part of the box is portrait: see FIELD_LEVEL.
		const portRows = Math.round(rows * 0.82);
		const portCols = Math.min(Math.round(portRows / cellAspect), Math.round(cols * 0.9), 110);
		const ox = Math.floor((cols - portCols) / 2);
		const oy = Math.floor((rows - portRows) / 2);

		thresh = new Float32Array(cols * rows);
		portrait = new Int16Array(cols * rows).fill(-1);
		rowsA = new Array<string>(rows);
		rowsB = new Array<string>(rows);

		const cx = cols / 2;
		const cy = rows / 2;
		const maxR = Math.hypot(cx, cy / cellAspect);

		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const i = y * cols + x;

				// Bilinear-ish resample of the square map into the portrait box.
				let lum = 0;
				const bx = x - ox;
				const by = y - oy;
				if (bx >= 0 && bx < portCols && by >= 0 && by < portRows) {
					const sx = Math.min(MAP_SIZE - 1, Math.floor((bx / portCols) * MAP_SIZE));
					const sy = Math.min(MAP_SIZE - 1, Math.floor((by / portRows) * MAP_SIZE));
					const level = ALPHABET.indexOf(MAP[sy * MAP_SIZE + sx] as string);
					if (level > FIELD_LEVEL) {
						portrait[i] = level;
						lum = level / (MAP_LEVELS - 1);
					}
				}

				/*
				 * Resolve order. NOT an ordered Bayer matrix: at one matrix cell
				 * per character cell a 4x4 Bayer has a ~36x64px period, which is
				 * plainly visible as a screen door. Tested side by side; this
				 * reads as a decode, that reads as an artifact.
				 */
				const radial = Math.hypot(x - cx, (y - cy) / cellAspect) / maxR;
				thresh[i] = 0.5 * radial + 0.3 * hash(x, y) + 0.2 * (1 - lum);
			}
		}
		return true;
	}

	/* ---- frame ---------------------------------------------------------- */

	function tick(now: number, dtMs: number): void {
		if (!alive || cols === 0) return;

		energy *= Math.exp(-dtMs / ENERGY_TAU);

		/*
		 * Entry sequence, then scroll takes over.
		 *
		 * p starts at 1 so the first frame matches the server-rendered static
		 * frame exactly -- no flash on handover. It then scatters to noise and
		 * decodes back in, so the decode is the first thing a visitor sees
		 * rather than something that happens off-screen as they scroll away.
		 */
		age = age < 0 ? 0 : age + dtMs;
		if (age < ENTRY_MS) {
			const u = age / ENTRY_MS;
			// 1 -> 0 over the first third, then back to 1 with an ease-out.
			pTarget = u < 0.34 ? 1 - u / 0.34 : Math.pow((u - 0.34) / 0.66, 0.55);
		} else {
			// Resolved while the hero is on screen; dissolves as it leaves.
			pTarget = clamp(visible * 1.35, 0, 1);
		}

		p += (pTarget - p) * (1 - Math.exp(-dtMs / P_TAU));

		// Resolve progress, exposed coarsely. It is a CSS hook (the copy can
		// react to the decode) and it is what makes the behaviour testable
		// without counting characters -- a resolved-but-dark cell renders a
		// space, so character counts understate the truth. Written only when
		// the rounded value changes, so this is ~20 attribute writes per decode.
		const step = (Math.round(p * 20) / 20).toFixed(2);
		if (step !== lastStep) {
			lastStep = step;
			host.dataset.resolve = step;
		}

		const t = now * 0.0012;
		let anyA = false;
		let anyB = false;
		let i = 0;

		for (let y = 0; y < rows; y++) {
			let a = '';
			let b = '';
			for (let x = 0; x < cols; x++) {
				const pv = portrait[i] as number;

				// The field. Broad and slow, so it rolls rather than flickers.
				// Cheap, periodic, and deliberately digital.
				let fv = 0.5 + 0.22 * (Math.sin(x * 0.13 + t * 0.7) + Math.cos(y * 0.23 - t * 0.55));
				if (energy > 0.01) {
					const dx = x - px;
					const dy = y - py;
					fv += Math.sin((dx * dx + dy * dy) * 0.012 - t * 6) * energy * 0.5;
				}

				// How far this cell has developed into the portrait: eased across a
				// band of p rather than switched, so the face develops out of the
				// field instead of being stamped onto it. Scaled so every cell is
				// fully developed at p = 1 (thresholds reach 1.0).
				let w = 0;
				let lum = 0;
				if (pv >= 0) {
					lum = pv / (MAP_LEVELS - 1);
					const d = (p * (1 + DEVELOP) - (thresh[i] as number)) / DEVELOP;
					w = d <= 0 ? 0 : d >= 1 ? 1 : d * d * (3 - 2 * d);
				}

				// The field runs on through the face as a faint shimmer, so the two
				// read as one surface. The field sits below the portrait in weight.
				const shimmer = 0.07 * Math.sin(x * 0.13 + y * 0.09 - t * 1.1);
				const v = (1 - w) * fv * 0.55 + w * clamp(lum + shimmer, 0, 1);
				const ch = RAMP[clamp((v * RAMP.length) | 0, 0, RAMP_MAX)] as string;

				// The lit face takes the portrait's tint; its darkest cells stay in
				// the field's own blue.
				if (w > 0.5 && lum > 0.1) {
					a += ' ';
					b += ch;
					anyB = true;
				} else {
					a += ch;
					b += ' ';
					anyA = true;
				}
				i++;
			}
			rowsA[y] = a;
			rowsB[y] = b;
		}

		// At rest one layer is entirely spaces; skip its write. Rewriting an
		// identical string is free anyway, but not building it is cheaper.
		if (anyA || wroteA) {
			preA.textContent = rowsA.join('\n');
			wroteA = anyA;
		}
		if (anyB || wroteB) {
			preB.textContent = rowsB.join('\n');
			wroteB = anyB;
		}
	}

	/* ---- input ---------------------------------------------------------- */

	let lastX = 0;
	let lastY = 0;
	let lastT = 0;

	function onPointer(ev: PointerEvent): void {
		const rect = host.getBoundingClientRect();
		const cellW = rect.width / cols;
		const rowH = rect.height / rows;
		px = (ev.clientX - rect.left) / cellW;
		py = (ev.clientY - rect.top) / rowH;

		const dt = Math.max(1, ev.timeStamp - lastT);
		const speed = Math.hypot(ev.clientX - lastX, ev.clientY - lastY) / dt;
		lastX = ev.clientX;
		lastY = ev.clientY;
		lastT = ev.timeStamp;

		// An impulse, not a level: fast movement spikes it, then it decays.
		energy = Math.min(1, energy + speed * 0.5);
	}

	/* ---- visibility ----------------------------------------------------- */

	let unsubscribe: (() => void) | null = null;

	// Resolve progress comes from IntersectionObserver thresholds, never from
	// reading layout in the tick -- `textContent = s` alone is ~0.0ms, but
	// adding a forced layout read is what makes it 0.3-0.9ms.
	const steps = Array.from({ length: 21 }, (_, n) => n / 20);
	const io = new IntersectionObserver(
		(entries) => {
			// The LAST entry is the current state, not the first. Entries queue
			// up between callbacks while the main thread is busy, and a fast
			// scroll crosses many thresholds in a few frames: reading entries[0]
			// acted on where the hero WAS. Scrolled straight past under load, the
			// field saw "still on screen", kept its subscription, and the loop
			// ran at full rate, offscreen, for good.
			const e = entries[entries.length - 1];
			if (!e) return;
			visible = e.intersectionRatio;

			if (e.isIntersecting && !unsubscribe) unsubscribe = subscribe(tick);
			else if (!e.isIntersecting && unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}
		},
		// A pixel in from each edge. The section advance leaves the next
		// channel exactly at the top of the screen, where the hero's bottom
		// edge TOUCHES the viewport's top one -- and a box that only touches
		// counts as intersecting, at a ratio of 0. So the field never
		// unsubscribed, and drew two full-screen <pre> every frame behind the
		// guide: at 4x CPU, long tasks of a second and more, and a slow scroll
		// that skipped a channel because the lock timed out inside one.
		{ threshold: steps, rootMargin: '-1px 0px' },
	);

	const ro = new ResizeObserver(() => {
		if (!layout()) destroy();
	});

	/* ---- lifecycle ------------------------------------------------------- */

	function destroy(): void {
		if (!alive) return;
		alive = false;
		unsubscribe?.();
		unsubscribe = null;
		io.disconnect();
		ro.disconnect();
		host.removeEventListener('pointermove', onPointer);
		host.dataset.fieldState = 'off';
		thresh = new Float32Array(0);
		portrait = new Int16Array(0);
	}

	if (!layout()) return { destroy: () => undefined };

	host.addEventListener('pointermove', onPointer, { passive: true });
	io.observe(host);
	ro.observe(host);
	host.dataset.fieldState = 'live';

	return { destroy };
}
