/**
 * The pointer's trail -- one ring, one script, no animation loop.
 *
 *   - The ring follows the pointer with `transition: translate 420ms`, so it
 *     trails behind a fast move and catches up when it stops. No rAF, no lerp.
 *   - VELOCITY is one smoothed number published as `--pointer-v`, on the ring:
 *     the only thing that reads it.
 *
 * The visitor's own pointer stays. Until 2026-09-29 a dot stood in for it and
 * the real one was hidden (`cursor: none`) almost everywhere: after every page
 * load there was no pointer at all until the mouse moved, a low-vision
 * visitor's enlarged or recoloured system pointer was gone, and over links two
 * cursors showed at once. The ring is decoration beside it, in the colour of
 * the channel you are on (src/scripts/channel.ts).
 *
 * `pointermove` is already coalesced to frame rate by the browser, so sampling
 * it directly is not wasteful.
 *
 * The site has one animation loop (src/lib/field/loop.ts). This file must
 * never schedule frames — eslint enforces that.
 */

const FINE_POINTER = '(hover: hover) and (pointer: fine)';

interface Disposable {
	destroy(): void;
}

function mountCursor(): Disposable | null {
	const ring = document.createElement('div');
	ring.className = 'cursor__ring';
	// Decoration. Never announce it, never let it take a click.
	ring.setAttribute('aria-hidden', 'true');
	document.body.appendChild(ring);

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

	let lastX = 0;
	let lastY = 0;
	let lastT = 0;
	let velocity = 0;
	let published = -1;

	function onMove(ev: PointerEvent): void {
		const x = ev.clientX;
		const y = ev.clientY;
		ring.style.translate = `${x}px ${y}px`;

		if (reduced.matches) return;

		const dt = Math.max(1, ev.timeStamp - lastT);
		const step = Math.hypot(x - lastX, y - lastY) / dt;
		lastX = x;
		lastY = y;
		lastT = ev.timeStamp;

		// Smoothed, clamped. An impulse that decays as movement slows.
		velocity = velocity * 0.86 + Math.min(1, step / 2.2) * 0.14;

		// Published coarsely, and on the ring. On <html> every write restyled
		// the whole page for one 30px element: 20 to 28 recalcs of about 15ms
		// each in 150 moves across a case study, at a 4x CPU slowdown. Here
		// the ring restyles alone (measured 2026-09-29).
		const q = Math.round(velocity * 20) / 20;
		if (q !== published) {
			published = q;
			ring.style.setProperty('--pointer-v', String(q));
		}
	}

	function onDown(): void {
		ring.dataset.pressed = '';
	}
	function onUp(): void {
		delete ring.dataset.pressed;
	}
	function onLeave(): void {
		ring.dataset.out = '';
	}
	function onEnter(): void {
		delete ring.dataset.out;
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
			ring.remove();
		},
	};
}

export function boot(): void {
	// Coarse pointers get none of this: there is no touch equivalent of a
	// trail. Nor do forced colours, where the system draws what matters and a
	// ring in the page's colours would be one more thing to see past.
	if (!window.matchMedia(FINE_POINTER).matches) return;
	if (window.matchMedia('(forced-colors: active)').matches) return;

	mountCursor();
}
