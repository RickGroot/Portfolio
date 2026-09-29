/**
 * The character field: the test card.
 *
 * Renders a grid of characters into stacked <pre> elements -- one per colour --
 * recomputed at 60fps and written as strings. No canvas, no WebGL, no graphics
 * context to lose.
 *
 * Channel 01 is the card a television shows before the programmes start (Rick,
 * 2026-09-28, of three candidates: "more visually impressive"). A test card's
 * grid of lines, drawn in characters, runs edge to edge; a circle sits in the
 * middle of it, and the portrait develops inside the circle out of a field of
 * its own. The name, the colour bars and the synopsis are the card's boxes, in
 * HTML, and the clock is a real one (src/scripts/testcard.ts).
 *
 * One blue, two strengths: the grid and the field in the palette's signal blue,
 * and the lit part of the portrait in a lighter tint of it (--art-signal), so
 * the face reads as the field brightening, not as a second picture laid over
 * it. The field's motion carries on through the face as a shimmer.
 *
 * Measured on this approach (120x60 = 7200 cells, forced layout every frame):
 *   one <pre>, single colour      1.18 ms/frame
 *   two stacked <pre>, two colours 2.22 ms/frame   <- the two that move
 *   one <span> per cell            40.71 ms/frame  <- 2.5x over a 60fps budget
 *
 * The colour split is free because it IS the resolve state: a cell that has
 * developed into the lit portrait goes to layer B, anything else to layer A,
 * and each writes a space to the other. The circle is layer C, in the face's
 * tint: it never moves, so it is written once per layout and never per frame,
 * and costs paint rather than layout. A and B leave its cells blank.
 *
 * The card's geometry -- where the circle's centre and the face's are, the
 * circle's radius, the grid's step -- belongs to the stylesheet (index.astro),
 * not to this module. The boxes on the card are laid out from the same custom
 * properties before any script runs, so reading them here, rather than
 * deciding them, is what keeps the handover from moving a box.
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
/** How far the pointer's ripple reaches, in cells: it disturbs the card near it, not the whole screen. */
const RIPPLE_CELLS = 16;
/** How fast resolve catches up to its target. */
const P_TAU = 260;
/** Length of the load-time scatter-and-decode sequence. */
const ENTRY_MS = 3200;
/** How much of the resolve a cell takes to develop, in units of p. */
const DEVELOP = 0.14;
/** The field inside the circle sits well below the face: the card is the frame, the face is the picture. */
const FIELD_WEIGHT = 0.36;
/** The face box: this share of the host's height, or of its width where that runs out first. */
const FACE_HEIGHT = 0.64;
const FACE_WIDTH = 0.8;
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

/**
 * The card's geometry, as the stylesheet resolved it, in the host's pixels.
 * Custom properties are not resolved to lengths by getComputedStyle unless
 * they are registered, so a probe is laid out with them instead.
 */
function measureCard(host: HTMLElement): { ringY: number; faceY: number; r: number; step: number } {
	const probe = document.createElement('i');
	probe.style.cssText =
		'position:absolute;left:0;visibility:hidden;pointer-events:none;' +
		'top:var(--ring-cy,50%);inline-size:var(--ring-r,40%);block-size:var(--grid,10%)';
	const face = document.createElement('i');
	face.style.cssText =
		'position:absolute;left:0;visibility:hidden;pointer-events:none;top:var(--face-cy,50%);block-size:0';
	host.append(probe, face);
	const origin = host.getBoundingClientRect().top;
	const p = probe.getBoundingClientRect();
	const faceY = face.getBoundingClientRect().top - origin;
	probe.remove();
	face.remove();
	return { ringY: p.top - origin, faceY, r: p.width, step: Math.max(8, p.height) };
}

export function mountField(host: HTMLElement): FieldHandle {
	const layerA = host.querySelector<HTMLPreElement>('[data-layer="a"]');
	const layerB = host.querySelector<HTMLPreElement>('[data-layer="b"]');
	if (!layerA || !layerB) return { destroy: () => undefined };

	// Bound after the guard so the narrowing survives into the frame closure.
	const preA: HTMLPreElement = layerA;
	const preB: HTMLPreElement = layerB;
	const preC = host.querySelector<HTMLPreElement>('[data-layer="c"]');
	const layers = preC ? [preA, preB, preC] : [preA, preB];

	let cols = 0;
	let rows = 0;
	/** The drawn cell, after the glyphs are scaled to cover the host, and where the grid starts in it. */
	let cellW = 0;
	let rowH = 0;
	let gridX = 0;
	let gridY = 0;
	let aspect = 1;
	let thresh = new Float32Array(0);
	let portrait = new Int16Array(0);
	/** The test card: the grid's glyph in each cell ('' where it has none), the circle's cells, and what lies inside it. */
	let line: string[] = [];
	let ring = new Uint8Array(0);
	let inside = new Uint8Array(0);
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

		// Keep the cell count bounded, but let it grow with the screen: at one
		// cap for every size, a 2560x1440 face got the cells a laptop's does,
		// only bigger, and read as a blob. A large screen is a desktop's, with
		// the frame time to spare; the cap stops at 2.2 times a 1440x900 one.
		const cap = MAX_CELLS * clamp((rect.width * rect.height) / (1440 * 900), 1, 2.2);
		if (c * r > cap) {
			const k = Math.sqrt(cap / (c * r));
			c = Math.max(MIN_COLS, Math.floor(c * k));
			r = Math.max(4, Math.floor(r * k));
		}

		cols = c;
		rows = r;
		px = -1e4;
		py = -1e4;

		// Capped, the grid is fewer cells than the host holds, so the glyphs
		// grow instead and the grid still covers the host edge to edge. At the
		// stylesheet's size a large screen got the cap's grid in its middle:
		// 52% of a 2560x1440 hero, and short of the edges even at 1440x900
		// (Rick, 2026-09-25: "the header isn't full-screen on large device").
		// Cover, not fit: the grid overhangs by a fraction of a cell, and the
		// host clips it. The host keeps the stylesheet's size, so measuring
		// again on a resize starts from the same base.
		const fit = Math.max(rect.width / (c * m.cellW), rect.height / (r * m.rowH));
		const base = parseFloat(getComputedStyle(host).fontSize);
		for (const pre of layers) pre.style.fontSize = `${base * fit}px`;
		cellW = m.cellW * fit;
		rowH = m.rowH * fit;
		gridX = (rect.width - c * cellW) / 2;
		gridY = (rect.height - r * rowH) / 2;
		aspect = m.cellW / m.rowH;

		const card = measureCard(host);
		const cx = rect.width / 2;

		// The face sits in the circle, above its centre on a wide screen, so the
		// name's box under it crosses the chin rather than the smile. The box is
		// a square in pixels, as big as its share allows: sized in cells, a
		// phone's face -- where the width ran out first -- was stretched to
		// twice its height, which the photograph under it (CharacterField.astro)
		// would have shown at once.
		const side = Math.min(rect.height * FACE_HEIGHT, rect.width * FACE_WIDTH);
		const portRows = Math.max(4, Math.round(side / rowH));
		const portCols = Math.max(4, Math.round(side / cellW));
		const ox = Math.round((cx - gridX) / cellW - portCols / 2);
		const oy = Math.round((card.faceY - gridY) / rowH - portRows / 2);

		// Where the face is, for the photograph laid under it: its size, and its
		// corner, measured across from the host's centre and down from the face's
		// own, where the photograph's box stays pinned (see CharacterField.astro).
		host.style.setProperty('--port-dx', `${gridX + ox * cellW - cx}px`);
		host.style.setProperty('--port-dy', `${gridY + oy * rowH - card.faceY}px`);
		host.style.setProperty('--port-w', `${portCols * cellW}px`);
		host.style.setProperty('--port-h', `${portRows * rowH}px`);

		const n = cols * rows;
		thresh = new Float32Array(n);
		portrait = new Int16Array(n).fill(-1);
		line = new Array<string>(n).fill('');
		ring = new Uint8Array(n);
		inside = new Uint8Array(n);
		rowsA = new Array<string>(rows);
		rowsB = new Array<string>(rows);

		const gcx = cols / 2;
		const gcy = rows / 2;
		const maxR = Math.hypot(gcx, gcy / aspect);
		const G = card.step;

		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const i = y * cols + x;

				// Nearest-neighbour resample of the square map into the portrait
				// box, taken at the CENTRE of each cell. Taken at its corner, the
				// face drew about half a cell right of and below the photograph
				// under it (tests/e2e/field.spec.ts measures the two together).
				let lum = 0;
				const bx = x - ox;
				const by = y - oy;
				if (bx >= 0 && bx < portCols && by >= 0 && by < portRows) {
					const sx = Math.min(MAP_SIZE - 1, Math.floor(((bx + 0.5) / portCols) * MAP_SIZE));
					const sy = Math.min(MAP_SIZE - 1, Math.floor(((by + 0.5) / portRows) * MAP_SIZE));
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
				const radial = Math.hypot(x - gcx, (y - gcy) / aspect) / maxR;
				thresh[i] = 0.5 * radial + 0.3 * hash(x, y) + 0.2 * (1 - lum);

				// The card: inside the circle, the field; outside it, the grid, its
				// lines laid from the circle's centre, one cell wide.
				const dx = gridX + (x + 0.5) * cellW - cx;
				const dy = gridY + (y + 0.5) * rowH - card.ringY;
				if (Math.hypot(dx, dy) < card.r) {
					inside[i] = 1;
				} else {
					const onV = Math.abs(dx - G * Math.round(dx / G)) < cellW * 0.5;
					const onH = Math.abs(dy - G * Math.round(dy / G)) < rowH * 0.5;
					line[i] = onV && onH ? '+' : onV ? '|' : onH ? '-' : '';
				}
			}
		}

		drawCircle(cx, card.ringY, card.r);
		return true;
	}

	/**
	 * The circle, rasterised as a line into layer C: one cell per column where
	 * it runs flat, one per row where it runs steep. Where it is flat the glyph
	 * follows the line's height inside its cell -- ' - . _ -- which is how an
	 * ASCII drawing makes a shallow curve read smooth; steep, it is / \ and |.
	 * Drawn as a band of every cell it touches, it came out two and three
	 * columns thick at the sides and one row at the top: a ring of hashes, not
	 * a line (the first prototype, 2026-09-28).
	 */
	function drawCircle(cx: number, cy: number, R: number): void {
		const glyphs = new Array<string>(cols * rows).fill(' ');
		// Rows per column along the circle at a point: under 0.9 it runs flat.
		const slope = (dx: number, dy: number): number =>
			(Math.abs(dx) * cellW) / (Math.abs(dy) * rowH + 1e-6);
		const mark = (x: number, y: number, g: string): void => {
			if (x < 0 || x >= cols || y < 0 || y >= rows) return;
			const i = y * cols + x;
			glyphs[i] = g;
			ring[i] = 1;
			line[i] = '';
		};
		for (let x = 0; x < cols; x++) {
			const dx = gridX + (x + 0.5) * cellW - cx;
			if (Math.abs(dx) > R) continue;
			const h = Math.sqrt(R * R - dx * dx);
			for (const Y of [cy - h, cy + h]) {
				if (slope(dx, Y - cy) >= 0.9) continue;
				const at = (Y - gridY) / rowH;
				const y = Math.floor(at);
				const f = at - y;
				mark(x, y, f < 0.3 ? "'" : f < 0.56 ? '-' : f < 0.82 ? '.' : '_');
			}
		}
		for (let y = 0; y < rows; y++) {
			const dy = gridY + (y + 0.5) * rowH - cy;
			if (Math.abs(dy) > R) continue;
			const w = Math.sqrt(R * R - dy * dy);
			for (const X of [cx - w, cx + w]) {
				const dx = X - cx;
				const s = slope(dx, dy);
				if (s < 0.9) continue;
				mark(Math.floor((X - gridX) / cellW), y, s > 2.4 ? '|' : dx * dy < 0 ? '\\' : '/');
			}
		}
		if (!preC) return;
		const out = new Array<string>(rows);
		for (let y = 0; y < rows; y++) out[y] = glyphs.slice(y * cols, (y + 1) * cols).join('');
		preC.textContent = out.join('\n');
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
		const reach = 2 * RIPPLE_CELLS * RIPPLE_CELLS;
		let anyA = false;
		let anyB = false;
		let i = 0;

		for (let y = 0; y < rows; y++) {
			let a = '';
			let b = '';
			for (let x = 0; x < cols; x++) {
				// The circle is layer C's, drawn once; both of these leave it blank.
				if (ring[i]) {
					a += ' ';
					b += ' ';
					i++;
					continue;
				}
				const pv = portrait[i] as number;
				const lineGlyph = line[i] as string;

				// The field, inside the circle only. Broad and slow, so it rolls
				// rather than flickers. Cheap, periodic, and deliberately digital.
				let fv = inside[i]
					? FIELD_WEIGHT *
						(0.5 + 0.22 * (Math.sin(x * 0.13 + t * 0.7) + Math.cos(y * 0.23 - t * 0.55)))
					: 0;
				// A fast pointer disturbs the card near it: the field inside the
				// circle, and the empty squares of the grid, as interference.
				if (energy > 0.01 && !lineGlyph) {
					const dx = x - px;
					const dy = (y - py) / aspect;
					const d2 = dx * dx + dy * dy;
					if (d2 < reach * 4) {
						fv += Math.sin(d2 * 0.012 - t * 6) * energy * 0.5 * Math.exp(-d2 / reach);
					}
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

				if (lineGlyph) {
					a += lineGlyph;
					b += ' ';
					anyA = true;
					i++;
					continue;
				}

				// The field runs on through the face as a faint shimmer, so the two
				// read as one surface.
				const shimmer = 0.07 * Math.sin(x * 0.13 + y * 0.09 - t * 1.1);
				const v = (1 - w) * fv + w * clamp(lum + shimmer, 0, 1);
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

		// A layer that is entirely spaces is skipped. Rewriting an identical
		// string is free anyway, but not building it is cheaper.
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
		px = (ev.clientX - rect.left - gridX) / cellW;
		py = (ev.clientY - rect.top - gridY) / rowH;

		const dt = Math.max(1, ev.timeStamp - lastT);
		const speed = Math.hypot(ev.clientX - lastX, ev.clientY - lastY) / dt;
		lastX = ev.clientX;
		lastY = ev.clientY;
		lastT = ev.timeStamp;

		// An impulse, not a level: fast movement spikes it, then it decays.
		energy = Math.min(1, energy + speed * 0.5);
	}

	/*
	 * The field is `pointer-events: none` -- it must never eat a click -- so it
	 * is never the target of a pointer event, and a listener on it never runs.
	 * One did, from the start: the pointer's disturbance was documented and
	 * never happened (found 2026-09-28, 30 moves over the hero, 0 calls). The
	 * hero around it receives them.
	 */
	const pointerTarget = host.parentElement ?? host;

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
		pointerTarget.removeEventListener('pointermove', onPointer);
		host.dataset.fieldState = 'off';
		// The static frame is laid out at the stylesheet's size, and the photo
		// goes back to sitting under it.
		for (const pre of layers) pre.style.fontSize = '';
		for (const v of ['--port-dx', '--port-dy', '--port-w', '--port-h'])
			host.style.removeProperty(v);
		thresh = new Float32Array(0);
		portrait = new Int16Array(0);
	}

	if (!layout()) return { destroy: () => undefined };

	pointerTarget.addEventListener('pointermove', onPointer, { passive: true });
	io.observe(host);
	ro.observe(host);
	host.dataset.fieldState = 'live';

	return { destroy };
}
