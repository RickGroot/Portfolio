/**
 * Cursor and trail — one script, no animation loop.
 *
 *   - The TRAIL is the lag between two elements. The dot has
 *     `transition: none`, the ring has `transition: translate 420ms`. Because
 *     the ring interpolates a longer distance in a fixed time, it stretches
 *     further behind on fast movement automatically. No rAF, no lerp.
 *   - VELOCITY is one smoothed number published as `--pointer-v`.
 *
 * The proximity glow that used to live here -- a soft light following the
 * pointer across cards -- went with the rest of the glows in the Channels
 * redesign: flat fields, no light effects. The pointer's job from here on is to
 * reveal the photograph under it, which is the renderer's to do.
 *
 * `pointermove` is already coalesced to frame rate by the browser, so sampling
 * it directly is not wasteful.
 *
 * The one loop on this site belongs to the character field
 * (src/lib/field/loop.ts). This file must never schedule frames — eslint
 * enforces that.
 */

const FINE_POINTER = '(hover: hover) and (pointer: fine)';

interface Disposable {
	destroy(): void;
}

function mountCursor(): Disposable | null {
	const root = document.documentElement;

	const dot = document.createElement('div');
	dot.className = 'cursor__dot';
	const ring = document.createElement('div');
	ring.className = 'cursor__ring';
	// Decoration. Never announce it, never let it take a click.
	for (const el of [dot, ring]) {
		el.setAttribute('aria-hidden', 'true');
		document.body.appendChild(el);
	}

	// Only claim the native cursor once our own nodes exist. If this script
	// never runs, the page must not be left with `cursor: none` and nothing
	// drawn in its place.
	root.dataset.cursor = 'custom';

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

	let lastX = 0;
	let lastY = 0;
	let lastT = 0;
	let velocity = 0;
	let published = -1;

	function onMove(ev: PointerEvent): void {
		const x = ev.clientX;
		const y = ev.clientY;
		dot.style.translate = `${x}px ${y}px`;
		ring.style.translate = `${x}px ${y}px`;

		if (reduced.matches) return;

		const dt = Math.max(1, ev.timeStamp - lastT);
		const step = Math.hypot(x - lastX, y - lastY) / dt;
		lastX = x;
		lastY = y;
		lastT = ev.timeStamp;

		// Smoothed, clamped. An impulse that decays as movement slows.
		velocity = velocity * 0.86 + Math.min(1, step / 2.2) * 0.14;

		// Publish coarsely: a custom property write invalidates the inherited
		// subtree, so doing it every event would be wasteful. 0.05 steps are
		// finer than the effect can show.
		const q = Math.round(velocity * 20) / 20;
		if (q !== published) {
			published = q;
			root.style.setProperty('--pointer-v', String(q));
		}
	}

	function onDown(): void {
		root.dataset.pressed = '';
	}
	function onUp(): void {
		delete root.dataset.pressed;
	}
	function onLeave(): void {
		root.dataset.cursorOut = '';
	}
	function onEnter(): void {
		delete root.dataset.cursorOut;
	}

	window.addEventListener('pointermove', onMove, { passive: true });
	window.addEventListener('pointerdown', onDown, { passive: true });
	window.addEventListener('pointerup', onUp, { passive: true });
	document.addEventListener('pointerleave', onLeave);
	document.addEventListener('pointerenter', onEnter);

	return {
		destroy() {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerdown', onDown);
			window.removeEventListener('pointerup', onUp);
			document.removeEventListener('pointerleave', onLeave);
			document.removeEventListener('pointerenter', onEnter);
			dot.remove();
			ring.remove();
			delete root.dataset.cursor;
			root.style.removeProperty('--pointer-v');
		},
	};
}

export function boot(): void {
	// Coarse pointers get none of this. There is no touch equivalent of a
	// cursor.
	if (!window.matchMedia(FINE_POINTER).matches) return;

	mountCursor();
}
