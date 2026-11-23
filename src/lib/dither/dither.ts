/**
 * The 1-bit print, and the life in it.
 *
 * Two kinds of picture are drawn here, by one fragment shader.
 *
 * PHOTOGRAPHS are printed in their channel's two colours, one bit a pixel: an
 * 8x8 ordered (Bayer) dither at whole device pixels, so a dot is one colour or
 * the other on any screen. `.duo` (src/styles/surfaces.css) is the same print
 * as a duotone, and what stays wherever this does not run. Picked on
 * 2026-10-13 from three candidates, at 2px dots (Rick).
 *
 * KEY ART keeps its own colours -- a logo printed in a channel's colours loses
 * its own (Rick, 2026-09-25) -- so on the guide's screen and a case study's
 * stage the dither is laid over the picture as dots of the field, never mixed
 * into it.
 *
 * Both are alive (Rick, 2026-10-13, "A + B" of three candidates):
 *   - ambient, like a picture on air: a hum bar rolls down every few seconds
 *     and bends the picture as it passes, a photograph's edges shimmer, and
 *     key art twinkles with a few dots of the field, and pushes in slowly as
 *     its CSS did -- under a fixed dot grid now, so the dots stay crisp;
 *   - answering: under the pointer a small lens shows a photograph finer, its
 *     edge fraying into the dots rather than drawn; a quick flick sends a
 *     ripple through them; and the picture develops as its channel scrolls in
 *     and dissolves as it scrolls out. Key art keeps its colours under the
 *     pointer: no lens there.
 *   Toned down on 2026-10-14 (Rick: "a bit too much and pulse too much"):
 *   the lens was 240px across with a ring drawn round it, turned key art to
 *   one bit inside, and a pointer at an ordinary pace set off ripples.
 *   A change of programme on the guide's screen is snow, and the new picture
 *   comes through it in Bayer order; a photograph tunes in the same way when
 *   its channel comes on.
 *
 * What the CSS did stays the CSS's: the colours (--duo-hi, --duo-lo, --field,
 * --accent), the levers (--duo-lift/--duo-contrast, or --dither-lift/-contrast
 * where one bit needs others), --dither-dot, a photograph's crop, box and
 * parallax (the canvas takes the <img>'s own rules), and where a picture runs
 * out into the field (--dither-fade). The renderer reads it and decides none.
 *
 * The life is ambient work on the one loop (src/lib/field/loop.ts) -- it steps
 * down on a slow machine and holds while the page changes channel -- and only
 * while the picture is on screen. Under reduced motion there is none: the
 * print is still, and drawn on resize and a new image only.
 */

import { subscribe } from '../field/loop';

/**
 * A dot, in CSS px, unless a frame sets --dither-dot. Rounded to whole device
 * px: 2 on a 1x screen, 3 at 1.25x and 1.5x, 4 at 2x.
 */
const DOT = 2;
/** A photograph tuning in: a Bayer dissolve, in blocks of 4x4 dots, falling down the picture. */
const TUNE_MS = 1100;
/** A change of picture on the guide's screen: snow, then the picture through it. */
const CHANGE_MS = 380;
/** The ambient life needs no more than this; the loop itself caps at 60. */
const AMBIENT_FPS = 30;
/** The lens over a photograph, in CSS px: its radius where its edge frays out. */
const LENS_R = 56;
/** Ripples: how fast a ring runs out and how wide it is, CSS px; how long one lasts. */
const RIPPLE_SPEED = 600;
const RIPPLE_WIDTH = 24;
const RIPPLE_MS = 900;
const RIPPLES = 3;
/** A ripple only for a flick: CSS px per ms, and never closer than this apart. */
const RIPPLE_FLICK = 1.8;
const RIPPLE_GAP_MS = 260;

/*
 * A photograph's tone, on top of what .duo does. One bit has no grey to spare:
 * SHARPEN  an unsharp mask from the mip chain -- without it a clock face's
 *          numerals dissolve into the dither.
 * PUNCH    a touch more contrast than the print: a big near-white area is a
 *          screen of dots, and clipping it to the colour reads cleaner.
 * GAMMA    coverage = tone ^ GAMMA. Half the dots lit reads lighter than a
 *          50% grey, so the mid-tones need pulling down to look like the photo.
 */
const SHARPEN = 0.9;
const PUNCH = 1.15;
const GAMMA = 1.5;

const VERT = `#version 300 es
void main() {
	vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
	gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D u_img;
uniform int u_kind;          // 0 a photograph, printed; 1 key art, in its own colours
uniform vec2 u_size;         // canvas, device px
uniform vec2 u_imgSize;      // image, texels
uniform vec4 u_box;          // where the picture lies at rest: x, y, w, h, device px
uniform vec2 u_focus;        // its object-position, 0..1
uniform float u_zoom;        // the push, about the box's centre
uniform vec2 u_shift;        // and its drift and parallax, device px
uniform float u_dot;         // device px a dot
uniform float u_fine;        // device px a dot, under the lens
uniform float u_lift;
uniform float u_contrast;
uniform vec3 u_hi;
uniform vec3 u_lo;
uniform vec3 u_field;
uniform vec3 u_accent;
uniform float u_fieldIsHi;   // 1 where the field is the highlight colour
uniform vec3 u_fade;         // canvas v where the fade starts, where it is all field, on
uniform float u_p;           // a photograph tuning in, 0..1
uniform float u_change;      // key art changing picture, 0..1; 1 at rest
uniform float u_away;        // scrolled away, 0..1
uniform float u_t;           // seconds
uniform float u_live;        // 1 where motion is welcome
uniform vec3 u_ptr;          // the pointer: x, y device px, on
uniform float u_lensR;       // device px
uniform vec4 u_rip[${RIPPLES}];     // ripples: x, y device px, age s, strength
uniform vec2 u_ripple;       // their speed (device px/s) and width (device px)
out vec4 o;

uint pcg(uint v) {
	uint s = v * 747796405u + 2891336453u;
	uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
	return (w >> 22u) ^ w;
}

float rnd(ivec2 c, int k) {
	return float(pcg(uint(c.x) ^ pcg(uint(c.y) ^ pcg(uint(k))))) * (1.0 / 4294967296.0);
}

// 8x8 ordered dither, built from the 2x2 one: the finest bits vary fastest.
float bayer8(ivec2 p) {
	int v = 0;
	for (int i = 0; i < 3; i++) {
		int a = (p.x >> i) & 1;
		int b = (p.y >> i) & 1;
		v |= (((a ^ b) << 1) | b) << (2 * (2 - i));
	}
	return (float(v) + 0.5) / 64.0;
}

// object-fit: cover inside the box, pushed in about its centre.
vec2 pictureUv(vec2 px) {
	vec2 local = (px - u_box.xy - u_box.zw * 0.5 - u_shift) / u_zoom + u_box.zw * 0.5;
	float s = max(u_box.z / u_imgSize.x, u_box.w / u_imgSize.y);
	vec2 d = u_imgSize * s;
	return (local - (u_box.zw - d) * u_focus) / d;
}

// The mip that covers a footprint of device px.
float lodFor(float footprint) {
	float s = max(u_box.z / u_imgSize.x, u_box.w / u_imgSize.y) * u_zoom;
	return max(0.0, log2(footprint / s));
}

// CSS grayscale(1)'s weights.
float grey(vec3 c) {
	return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// A photograph as the print takes it, sharpened.
float tone(vec2 uv, float lod, float contrastMul) {
	float g = grey(textureLod(u_img, uv, lod).rgb);
	float b = grey(textureLod(u_img, uv, lod + 2.5).rgb);
	float v = (g + ${SHARPEN.toFixed(2)} * (g - b)) * u_lift;
	v = (v - 0.5) * u_contrast * ${PUNCH.toFixed(2)} * contrastMul + 0.5;
	return pow(clamp(v, 0.0, 1.0), ${GAMMA.toFixed(2)});
}

float fadeAt(float v) {
	if (u_fade.z < 0.5) return 0.0;
	float t = clamp((v - u_fade.x) / (u_fade.y - u_fade.x), 0.0, 1.0);
	return t * t * (3.0 - 2.0 * t);
}

// Rings running out from where a fast pointer went.
float ripple(vec2 px) {
	float w = 0.0;
	for (int i = 0; i < ${RIPPLES}; i++) {
		vec4 r = u_rip[i];
		if (r.w <= 0.0) continue;
		float ring = length(px - r.xy) - r.z * u_ripple.x;
		w += r.w * exp(-r.z * 2.4) * exp(-(ring * ring) / (2.0 * u_ripple.y * u_ripple.y));
	}
	return w;
}

void main() {
	vec2 px = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y);
	float v = px.y / u_size.y;
	int frame = int(u_t * 12.0);

	// The hum bar: a soft band rolling down every seven seconds, bending the
	// picture sideways as it passes.
	float band = u_live * exp(-pow((v - (fract(u_t / 7.0) * 1.5 - 0.25)) / 0.06, 2.0));
	px.x += band * u_dot * 3.0 * sin(v * 90.0 + u_t * 7.0);

	// The lens, on a photograph: its edge is not drawn but frayed, each dot
	// deciding by its own threshold where the lens ends.
	float d = u_ptr.z > 0.0 ? length(px - u_ptr.xy) : 1e9;
	bool lens = u_kind == 0 && d < u_lensR * (0.65 + 0.35 * bayer8(ivec2(floor(px / u_dot))));
	float rip = ripple(px);

	float dot_ = lens ? u_fine : u_dot;
	ivec2 cell = ivec2(floor(px / dot_));
	vec2 c = (vec2(cell) + 0.5) * dot_;
	float th = bayer8(cell);
	float fade = fadeAt(c.y / u_size.y);
	vec3 col;

	if (u_kind == 0) {
		// ---- a photograph: two colours, one bit
		float tn = tone(pictureUv(c), lodFor(dot_), lens ? 1.1 : 1.0);
		tn += 0.16 * band + 0.9 * rip;
		// Into the field: at the fade, and as the channel scrolls away. After
		// the bar and the ripples, so neither ever puts a dot on the field.
		tn = mix(tn, u_fieldIsHi, max(fade, u_away));
		// The edges shimmer: only a dot near its threshold can flip, so the
		// field and the solid shapes stay still.
		th = clamp(th + u_live * (rnd(cell, frame) - 0.5) * 0.08, 0.01, 0.99);
		float bit = step(th, tn);
		// Tuning in: blocks come on in Bayer order -- a different phase from
		// the dither's own -- leaning down the picture. Until then, the field.
		float order = 0.6 * bayer8(cell / 4 + ivec2(3, 5)) + 0.4 * (c.y / u_size.y);
		if (order > u_p * 1.02) bit = u_fieldIsHi;
		col = mix(u_lo, u_hi, bit);
	} else {
		// ---- key art: its own colours, with the field's dots over it
		col = textureLod(u_img, pictureUv(px), lodFor(1.0)).rgb * (1.0 + 0.45 * band);
		if (th < 0.22 * band || th < 1.3 * rip || rnd(cell, frame) < 0.004 * u_live) col = u_field;
		if (th < fade) col = u_field;
		// Scrolled away, it dissolves into the field from the foot up.
		float order = 0.6 * bayer8(cell / 3 + ivec2(2, 5)) + 0.4 * (1.0 - v);
		if (order < u_away * 1.1) col = u_field;
		// Changing picture: snow, then the new one through it in Bayer order.
		if (u_change < 1.0) {
			bool lit = rnd(ivec2(cell.x / 2, cell.y), frame * 3 + int(u_change * 40.0)) < 0.5;
			if (bayer8(cell / 2 + ivec2(3, 5)) > (u_change - 0.25) / 0.75) col = lit ? u_accent : u_field;
		}
	}

	o = vec4(col, 1.0);
}`;

type RGB = [number, number, number];

/** Where a picture lies and how it moves, this frame, in device px. */
export interface Geometry {
	box: [number, number, number, number];
	zoom: number;
	shift: [number, number];
	/** Canvas v where the fade starts and where it is all field; null for none. */
	fade: [number, number] | null;
	/** Scrolled away, 0..1. */
	away: number;
}

/**
 * Test seam: a page that sets `window.__ditherSoftware = true` before this
 * runs accepts a software WebGL context. Headless Chromium has no GPU, and the
 * tests need the print to run there; a visitor's software context is refused.
 */
const softwareAllowed = (): boolean =>
	(globalThis as { __ditherSoftware?: boolean }).__ditherSoftware === true;

/**
 * Is this context drawn by the CPU? `failIfMajorPerformanceCaveat` is a hint
 * Chrome does not always take: headless Chromium hands back SwiftShader with
 * it set. So ask the driver's name as well -- SwiftShader, Mesa's llvmpipe,
 * Windows' WARP ("Microsoft Basic Render Driver").
 */
function software(gl: WebGL2RenderingContext): boolean {
	const info = gl.getExtension('WEBGL_debug_renderer_info');
	const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
	return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/** A custom property's colour as the browser resolves it, 0..1 sRGB. */
function colour(el: Element, prop: string): RGB {
	const probe = document.createElement('span');
	probe.hidden = true;
	probe.style.color = `var(${prop})`;
	el.append(probe);
	const css = getComputedStyle(probe).color;
	probe.remove();
	const n = (css.match(/[\d.]+/g) ?? []).map(Number);
	const k = css.startsWith('color(') ? 1 : 255;
	return [(n[0] ?? 0) / k, (n[1] ?? 0) / k, (n[2] ?? 0) / k];
}

const same = (a: RGB, b: RGB): boolean => a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 0.01);

/** "40% 50%" -> [0.4, 0.5]. */
function position(css: string): [number, number] {
	const [x, y] = css.split(/\s+/).map((v) => parseFloat(v) / 100);
	return [Number.isFinite(x) ? (x ?? 0.5) : 0.5, Number.isFinite(y) ? (y ?? 0.5) : 0.5];
}

/** A CSS ease-in-out over an alternating cycle of `period` seconds, 0..1..0. */
function push(t: number, period: number): number {
	const phase = (t / period) % 2;
	const x = phase > 1 ? 2 - phase : phase;
	return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

interface Gpu {
	u: (name: string) => WebGLUniformLocation | null;
	texture: WebGLTexture;
}

function compile(gl: WebGL2RenderingContext): Gpu | null {
	const shader = (type: number, src: string): WebGLShader | null => {
		const s = gl.createShader(type);
		if (!s) return null;
		gl.shaderSource(s, src);
		gl.compileShader(s);
		return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
	};
	const vs = shader(gl.VERTEX_SHADER, VERT);
	const fs = shader(gl.FRAGMENT_SHADER, FRAG);
	const prog = gl.createProgram();
	if (!vs || !fs || !prog) return null;
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

	gl.useProgram(prog);
	// The triangle is made in the vertex shader; WebGL still wants a VAO bound.
	gl.bindVertexArray(gl.createVertexArray());
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	const locations = new Map<string, WebGLUniformLocation | null>();
	return {
		texture,
		u: (name) => {
			if (!locations.has(name)) locations.set(name, gl.getUniformLocation(prog, name));
			return locations.get(name) ?? null;
		},
	};
}

interface Ripple {
	x: number;
	y: number;
	at: number;
	strength: number;
}

interface SurfaceOptions {
	kind: 0 | 1;
	/** Where the pointer is listened for. */
	host: HTMLElement;
	/** Where the picture lies and how it moves, read every frame. */
	geometry: () => Geometry;
	/** Read once a resize: positions in CSS, which a frame must not read. */
	measure?: () => void;
	/** Says `on` when it is drawing, and back when it is not. */
	onShow: (on: boolean) => void;
}

/**
 * One canvas, one context, one picture at a time. Everything above is the
 * shader; this is when it runs.
 */
class Surface {
	private readonly gl: WebGL2RenderingContext;
	private gpu: Gpu | null;
	private img: HTMLImageElement | null = null;
	private size: [number, number] | null = null;
	private sized = false;
	private visible = false;
	private hi: RGB = [1, 1, 1];
	private lo: RGB = [0, 0, 0];
	private field: RGB = [0, 0, 0];
	private accent: RGB = [1, 1, 1];
	private fieldIsHi = 0;
	private lift = 1;
	private contrast = 1.1;
	private dotCss = DOT;
	private focus: [number, number] = [0.5, 0.5];
	private p = 1;
	private tuneStart = -1;
	private change = 1;
	private changeStart = -1;
	private ptr: [number, number, number] = [0, 0, 0];
	private ripples: Ripple[] = [];
	private lastMove: { x: number; y: number; at: number } | null = null;
	private lastRipple = 0;
	/** Every frame until then: the pointer moving, the page scrolling. */
	private activeUntil = 0;
	private drawnAt = -1;
	private ambient: (() => void) | null = null;
	private transient: (() => void) | null = null;
	private wait = 0;
	private readonly still = window.matchMedia('(prefers-reduced-motion: reduce)');
	private readonly cleanup: (() => void)[] = [];

	constructor(
		readonly canvas: HTMLCanvasElement,
		gl: WebGL2RenderingContext,
		gpu: Gpu,
		private readonly opts: SurfaceOptions,
	) {
		this.gl = gl;
		this.gpu = gpu;
		canvas.setAttribute('aria-hidden', 'true');

		// The geometry is read here, where layout is current, and never in a frame.
		const resize = new ResizeObserver(([entry]) => {
			if (!entry) return;
			// The device-pixel box is exact where there is one. Safari has none, and
			// an emulated device scale (devtools, Playwright) reports the real
			// screen's, which disagrees with devicePixelRatio: there the rounded CSS
			// box wins, so a dot is still whole device pixels.
			const box = (entry.devicePixelContentBoxSize as ResizeObserverSize[] | undefined)?.[0];
			const w = Math.round(entry.contentRect.width * devicePixelRatio);
			const h = Math.round(entry.contentRect.height * devicePixelRatio);
			const exact = box && Math.abs(box.inlineSize - w) <= 2 && Math.abs(box.blockSize - h) <= 2;
			this.canvas.width = exact ? box.inlineSize : w;
			this.canvas.height = exact ? box.blockSize : h;
			if (this.img) this.focus = position(getComputedStyle(this.img).objectPosition);
			opts.measure?.();
			this.sized = true;
			this.draw(performance.now(), true);
		});
		try {
			resize.observe(this.canvas, { box: 'device-pixel-content-box' });
		} catch {
			resize.observe(this.canvas);
		}

		// Alive only while it can be seen.
		const seen = new IntersectionObserver(([entry]) => {
			this.visible = entry?.isIntersecting ?? false;
			this.schedule();
		});
		seen.observe(opts.host);

		const onMove = (ev: PointerEvent): void => this.point(ev);
		const onLeave = (): void => {
			this.ptr = [0, 0, 0];
			this.lastMove = null;
			this.schedule();
		};
		opts.host.addEventListener('pointermove', onMove, { passive: true });
		opts.host.addEventListener('pointerleave', onLeave);

		// A lost context hands the picture back to the CSS until the browser
		// restores it: a driver reset, or too many contexts elsewhere.
		const onLost = (ev: Event): void => {
			ev.preventDefault();
			this.halt();
			this.gpu = null;
			opts.onShow(false);
		};
		const onRestored = (): void => {
			this.gpu = compile(gl);
			if (this.gpu && this.img) void this.upload(this.img);
		};
		this.canvas.addEventListener('webglcontextlost', onLost);
		this.canvas.addEventListener('webglcontextrestored', onRestored);

		this.cleanup.push(() => {
			resize.disconnect();
			seen.disconnect();
			opts.host.removeEventListener('pointermove', onMove);
			opts.host.removeEventListener('pointerleave', onLeave);
			this.canvas.removeEventListener('webglcontextlost', onLost);
			this.canvas.removeEventListener('webglcontextrestored', onRestored);
		});
	}

	private get live(): boolean {
		return !this.still.matches;
	}

	/** The channel's colours and the print's levers, from where they are set. */
	read(from: Element, levers: Element): void {
		this.hi = colour(from, '--duo-hi');
		this.lo = colour(from, '--duo-lo');
		this.field = colour(from, '--field');
		this.accent = colour(from, '--accent');
		this.fieldIsHi = same(this.field, this.hi) ? 1 : 0;
		const style = getComputedStyle(levers);
		// The print's own levers where a photograph needs different ones in one
		// bit, else the duotone's: a lift that sends a sunset's mid-tones to the
		// field as a tint sends a lit face to blank paper as dots.
		const lever = (name: string, fallback: number): number =>
			parseFloat(style.getPropertyValue(`--dither-${name}`)) ||
			parseFloat(style.getPropertyValue(`--duo-${name}`)) ||
			fallback;
		this.lift = lever('lift', 1);
		this.contrast = lever('contrast', 1.1);
		this.dotCss = lever('dot', DOT);
	}

	/** Take a picture: at once, or as a change of channel, through snow. */
	async show(img: HTMLImageElement, asChange: boolean): Promise<void> {
		this.img = img;
		if (asChange && this.live) {
			this.change = 0;
			this.changeStart = -1; // snow until the new picture is in
			this.schedule();
		}
		await this.upload(img);
	}

	private async upload(img: HTMLImageElement): Promise<void> {
		await img.decode().catch(() => undefined);
		if (!this.gpu || img !== this.img || !img.naturalWidth) return;
		const gl = this.gl;
		gl.bindTexture(gl.TEXTURE_2D, this.gpu.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.generateMipmap(gl.TEXTURE_2D);
		this.size = [img.naturalWidth, img.naturalHeight];
		this.focus = position(getComputedStyle(img).objectPosition);
		if (this.change < 1) this.changeStart = performance.now();
		this.draw(performance.now(), true);
		this.opts.onShow(true);
		this.schedule();
	}

	tuneIn(delayMs: number): void {
		if (!this.live || !this.gpu) return;
		window.clearTimeout(this.wait);
		this.p = 0;
		this.tuneStart = -1;
		this.draw(performance.now(), true);
		this.wait = window.setTimeout(() => {
			this.tuneStart = performance.now();
			this.schedule();
		}, delayMs);
	}

	private point(ev: PointerEvent): void {
		// A finger is scrolling, not pointing.
		if (ev.pointerType === 'touch' || !this.live) return;
		const r = this.canvas.getBoundingClientRect();
		if (!r.width || !r.height) return;
		const k = this.canvas.width / r.width;
		const x = (ev.clientX - r.left) * k;
		const y = (ev.clientY - r.top) * (this.canvas.height / r.height);
		const inside = x >= 0 && y >= 0 && x <= this.canvas.width && y <= this.canvas.height;
		this.ptr = inside ? [x, y, 1] : [0, 0, 0];
		const now = performance.now();
		if (inside && this.lastMove) {
			const speed =
				Math.hypot(x - this.lastMove.x, y - this.lastMove.y) /
				k /
				Math.max(1, now - this.lastMove.at);
			if (speed > RIPPLE_FLICK && now - this.lastRipple > RIPPLE_GAP_MS) {
				this.ripples.push({ x, y, at: now, strength: Math.min(0.5, speed / 6) });
				if (this.ripples.length > RIPPLES) this.ripples.shift();
				this.lastRipple = now;
			}
		}
		this.lastMove = inside ? { x, y, at: now } : null;
		this.nudge(120);
	}

	/** Draw every frame for the next `ms`: something outside is moving the picture. */
	nudge(ms: number): void {
		this.activeUntil = Math.max(this.activeUntil, performance.now() + ms);
		this.schedule();
	}

	/**
	 * Two kinds of frame. Ambient -- the life at rest -- on the loop's ambient
	 * tier, at most AMBIENT_FPS, and only while on screen. Transient -- a tune-in,
	 * a change, the pointer, a ripple -- every frame, until it is done.
	 */
	schedule(): void {
		const ready = this.gpu !== null && this.size !== null && this.sized;
		const ambientDue = ready && this.visible && this.live;
		if (ambientDue && !this.ambient) {
			let last = 0;
			this.ambient = subscribe(
				(now) => {
					if (now - last < 1000 / AMBIENT_FPS - 1) return;
					last = now;
					this.draw(now, false);
				},
				{ ambient: true },
			);
		} else if (!ambientDue && this.ambient) {
			this.ambient();
			this.ambient = null;
		}

		if (this.busy() && ready && !this.transient) {
			this.transient = subscribe((now) => {
				this.draw(now, false);
				if (!this.busy()) {
					this.transient?.();
					this.transient = null;
				}
			});
		}
	}

	private busy(): boolean {
		return (
			this.tuneStart >= 0 ||
			this.change < 1 ||
			this.ripples.length > 0 ||
			(this.visible && performance.now() < this.activeUntil)
		);
	}

	private halt(): void {
		window.clearTimeout(this.wait);
		this.ambient?.();
		this.ambient = null;
		this.transient?.();
		this.transient = null;
	}

	draw(now: number, force: boolean): void {
		const gpu = this.gpu;
		const size = this.size;
		if (!gpu || !size || !this.sized) return;
		if (!force && now === this.drawnAt) return;
		this.drawnAt = now;

		if (this.tuneStart >= 0) {
			this.p = Math.min(1, (now - this.tuneStart) / TUNE_MS);
			if (this.p >= 1) this.tuneStart = -1;
		}
		if (this.change < 1 && this.changeStart >= 0) {
			this.change = Math.min(1, (now - this.changeStart) / CHANGE_MS);
		}
		this.ripples = this.ripples.filter((r) => now - r.at < RIPPLE_MS);

		const gl = this.gl;
		const { u } = gpu;
		const dpr = devicePixelRatio;
		const dot = Math.max(1, Math.round(this.dotCss * dpr));
		const g = this.opts.geometry();
		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
		gl.uniform1i(u('u_kind'), this.opts.kind);
		gl.uniform2f(u('u_size'), this.canvas.width, this.canvas.height);
		gl.uniform2f(u('u_imgSize'), ...size);
		gl.uniform4f(u('u_box'), ...g.box);
		gl.uniform2f(u('u_focus'), ...this.focus);
		gl.uniform1f(u('u_zoom'), g.zoom);
		gl.uniform2f(u('u_shift'), ...g.shift);
		gl.uniform1f(u('u_dot'), dot);
		gl.uniform1f(u('u_fine'), Math.max(1, Math.round(dpr)));
		gl.uniform1f(u('u_lift'), this.lift);
		gl.uniform1f(u('u_contrast'), this.contrast);
		gl.uniform3f(u('u_hi'), ...this.hi);
		gl.uniform3f(u('u_lo'), ...this.lo);
		gl.uniform3f(u('u_field'), ...this.field);
		gl.uniform3f(u('u_accent'), ...this.accent);
		gl.uniform1f(u('u_fieldIsHi'), this.fieldIsHi);
		const fade: [number, number, number] = g.fade ? [g.fade[0], g.fade[1], 1] : [0, 1, 0];
		gl.uniform3f(u('u_fade'), ...fade);
		gl.uniform1f(u('u_p'), this.p);
		gl.uniform1f(u('u_change'), this.change);
		gl.uniform1f(u('u_away'), this.live ? g.away : 0);
		gl.uniform1f(u('u_t'), now / 1000);
		gl.uniform1f(u('u_live'), this.live ? 1 : 0);
		gl.uniform3f(u('u_ptr'), ...this.ptr);
		gl.uniform1f(u('u_lensR'), LENS_R * dpr);
		const rip = new Float32Array(RIPPLES * 4);
		this.ripples.forEach((r, i) => rip.set([r.x, r.y, (now - r.at) / 1000, r.strength], i * 4));
		gl.uniform4fv(u('u_rip[0]'), rip);
		gl.uniform2f(u('u_ripple'), RIPPLE_SPEED * dpr, RIPPLE_WIDTH * dpr);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	destroy(): void {
		this.halt();
		for (const fn of this.cleanup) fn();
		this.gl.getExtension('WEBGL_lose_context')?.loseContext();
		this.canvas.remove();
		this.opts.onShow(false);
	}
}

/** A canvas with a context that draws on a GPU, or null. */
function context(): { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext; gpu: Gpu } | null {
	const canvas = document.createElement('canvas');
	const gl = canvas.getContext('webgl2', {
		alpha: false,
		antialias: false,
		depth: false,
		stencil: false,
		powerPreference: 'low-power',
		// A software context would dither on the CPU, every dot of it: slower
		// than the CSS it replaces, on exactly the machine least able.
		failIfMajorPerformanceCaveat: !softwareAllowed(),
	});
	if (!gl) return null;
	if (software(gl) && !softwareAllowed()) {
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return null;
	}
	const gpu = compile(gl);
	return gpu ? { canvas, gl, gpu } : null;
}

export interface Print {
	/** Go to the field and tune back in, after `delayMs`. */
	tuneIn(delayMs?: number): void;
	destroy(): void;
}

/**
 * Print the photograph in `frame` -- a `.duo` element holding one <img> -- in
 * one bit. Returns null, and leaves the CSS print, where there is no WebGL2 or
 * only a software one.
 */
export function mountPrint(frame: HTMLElement): Print | null {
	const img = frame.querySelector('img');
	const ctx = img && context();
	if (!img || !ctx) return null;

	const section = frame.closest('[data-section]') ?? frame;
	let fade: [number, number] | null = null;
	let away = 0;
	const surface: Surface = new Surface(ctx.canvas, ctx.gl, ctx.gpu, {
		kind: 0,
		host: frame,
		// The canvas takes the <img>'s box and parallax from CSS: the picture
		// fills it as it is.
		geometry: () => ({
			box: [0, 0, surface.canvas.width, surface.canvas.height],
			zoom: 1,
			shift: [0, 0],
			fade,
			away,
		}),
		measure: () => {
			// --dither-fade is in the frame's terms; the canvas is oversized.
			const [a, b] = getComputedStyle(frame)
				.getPropertyValue('--dither-fade')
				.trim()
				.split(/\s+/)
				.map(Number);
			const fh = frame.clientHeight || 1;
			const ch = surface.canvas.clientHeight || 1;
			const toCanvas = (sv: number): number => (sv * fh - surface.canvas.offsetTop) / ch;
			fade =
				a !== undefined && b !== undefined && Number.isFinite(a) && Number.isFinite(b) && a !== b
					? [toCanvas(a), toCanvas(b)]
					: null;
		},
		onShow: (on) => {
			frame.dataset.dither = on ? 'on' : '';
		},
	});
	img.after(surface.canvas);
	surface.read(frame, frame);

	// Develops as its channel scrolls in, dissolves as it scrolls out: how much
	// of the screen the channel fills, from a ladder of thresholds rather than
	// reading layout in a frame.
	const filling = new IntersectionObserver(
		([entry]) => {
			if (!entry?.rootBounds) return;
			const seen = entry.intersectionRect.height;
			const full = Math.min(entry.boundingClientRect.height, entry.rootBounds.height) || 1;
			away = 1 - Math.min(1, Math.max(0, (seen / full - 0.15) / 0.75));
			surface.draw(performance.now(), true);
		},
		{ threshold: Array.from({ length: 41 }, (_, i) => i / 40) },
	);
	filling.observe(section);

	void surface.show(img, false);
	return {
		tuneIn: (delayMs = 0) => surface.tuneIn(delayMs),
		destroy: () => {
			filling.disconnect();
			surface.destroy();
		},
	};
}

export interface Screen {
	destroy(): void;
}

/**
 * The guide's screen: one canvas, carried to whichever programme is on, and a
 * change of programme comes through snow. Listens for `guide:tune` from
 * src/scripts/guide.ts.
 */
export function mountGuide(guide: HTMLElement): Screen | null {
	const active = (): HTMLElement | null =>
		guide.querySelector<HTMLElement>('.guide__preview[data-active]');
	let preview = active();
	let screen = preview?.querySelector<HTMLElement>('.guide__screen') ?? null;
	const img = screen?.querySelector('img');
	const ctx = preview && screen && img ? context() : null;
	if (!preview || !screen || !img || !ctx) return null;

	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	const surface: Surface = new Surface(ctx.canvas, ctx.gl, ctx.gpu, {
		kind: 1,
		host: guide,
		// The idle push the <img> had in CSS (guide-push, 22s): in the shader, so
		// the dots stay on the screen's grid while the picture moves under them.
		geometry: () => {
			const w = surface.canvas.width;
			const h = surface.canvas.height;
			const e = still.matches ? 0 : push(performance.now() / 1000, 22);
			return {
				box: [0, 0, w, h],
				zoom: 1.02 + 0.1 * e,
				shift: [-0.02 * w * e, -0.01 * h * e],
				fade: null,
				away: 0,
			};
		},
		onShow: (on) => {
			guide.dataset.ditherGuide = on ? 'on' : '';
		},
	});
	img.after(surface.canvas);
	surface.read(preview, preview);
	void surface.show(img, false);

	const onTune = (ev: Event): void => {
		const next = active();
		const nextScreen = next?.querySelector<HTMLElement>('.guide__screen');
		const nextImg = nextScreen?.querySelector('img');
		if (!next || !nextScreen || !nextImg || next === preview) return;
		preview = next;
		screen = nextScreen;
		nextImg.loading = 'eager';
		nextImg.after(surface.canvas);
		surface.read(next, next);
		void surface.show(nextImg, (ev as CustomEvent<{ dir?: number }>).detail?.dir !== undefined);
	};
	guide.addEventListener('guide:tune', onTune);
	return {
		destroy: () => {
			guide.removeEventListener('guide:tune', onTune);
			surface.destroy();
		},
	};
}

/**
 * A case study's stage: the key art behind the title, fading into the field
 * where the foot is, with the picture's push and parallax and the foot's lift
 * from WorkLayout's CSS carried into the shader.
 */
export function mountStage(stage: HTMLElement): Screen | null {
	const img = stage.querySelector('img');
	const head = stage.closest<HTMLElement>('.info__head');
	const foot = head?.querySelector<HTMLElement>('.info__foot');
	const titles = head?.querySelector<HTMLElement>('.info__titles');
	const article = stage.closest('[data-channel]') ?? stage;
	const ctx = img && head && foot && titles ? context() : null;
	if (!img || !head || !foot || !titles || !ctx) return null;

	// Read on resize, never in a frame.
	let headH = 1;
	let stageH = 1;
	let viewH = 1;
	let fadeAt: [number, number] = [0.6, 0.8];
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	const surface: Surface = new Surface(ctx.canvas, ctx.gl, ctx.gpu, {
		kind: 1,
		host: head,
		measure: () => {
			headH = head.offsetHeight || 1;
			stageH = stage.clientHeight || 1;
			viewH = window.innerHeight || 1;
			// From the foot's top to solid field: where the gradient was solid,
			// or above the title's first line, whichever is higher -- the title
			// must stand on clean field, not on a scatter of the picture's dots.
			// 24px clear of it, because the fade follows the scroll a frame
			// behind the title, which CSS lifts.
			const textTop = titles.offsetTop + parseFloat(getComputedStyle(titles).paddingTop) - 24;
			fadeAt = [
				foot.offsetTop / stageH,
				Math.min(foot.offsetTop + foot.offsetHeight * 0.74, textTop) / stageH,
			];
		},
		geometry: () => {
			const w = surface.canvas.width;
			const h = surface.canvas.height;
			const moving = !still.matches;
			// WorkLayout: the <img> is 130% of the head from 15% above it; it
			// pushes in (info-push, 24s) and, over the head's exit, falls to half
			// the page's speed and zooms (info-backdrop); the foot lifts 16vh.
			const e = moving ? push(performance.now() / 1000, 24) : 0;
			const p = moving ? Math.min(1, Math.max(0, window.scrollY / headH)) : 0;
			const boxH = 1.3 * h;
			const liftV = (0.16 * viewH * p) / stageH;
			return {
				box: [0, -0.15 * h, w, boxH],
				zoom: (moving ? 1.02 + 0.08 * e : 1) * (1 + 0.12 * p),
				shift: [-0.015 * w * e, -0.01 * boxH * e + 0.38 * boxH * p],
				fade: [fadeAt[0] - liftV, fadeAt[1] - liftV],
				// Dissolving once a quarter of the stage has gone, so the picture
				// leaves with the head rather than ahead of it.
				away: Math.min(1, Math.max(0, (p - 0.25) / 0.75)),
			};
		},
		onShow: (on) => {
			stage.dataset.ditherStage = on ? 'on' : '';
		},
	});
	img.after(surface.canvas);
	surface.read(article, article);

	// The page's own scroll moves the picture, the fade and the dissolve: draw
	// every frame while it does.
	const onScroll = (): void => surface.nudge(150);
	window.addEventListener('scroll', onScroll, { passive: true });
	void surface.show(img, false);
	return {
		destroy: () => {
			window.removeEventListener('scroll', onScroll);
			surface.destroy();
		},
	};
}
