/*
 * The one script: everything that makes the table feel handled.
 *
 *   - flip:   a card turns over (click, Enter or Space on its front button).
 *   - tilt:   a card leans toward a mouse, with a gloss that follows it.
 *   - drag:   a card can be moved about the table, wide screens, mouse only.
 *   - pause:  a card that is off screen stops its idle loops.
 *   - deal:   the cards are dealt from a stack when the page opens.
 *
 * There is no requestAnimationFrame loop here, and eslint forbids one: the
 * only per-frame work is the browser's own (CSS animations and transitions,
 * and one WAAPI deal). Everything below runs on an event.
 *
 *   - still:  a "Pause motion" button stops every idle loop, and remembers.
 *
 * Without this script the page is still complete: CSS lays each back out under
 * its front (`html:not(.js)`), so every case study and link is reachable.
 */

const DRAG_THRESHOLD = 5;
const WIDE = '(min-width: 821px)';
const root = document.documentElement;
/** Reduced motion, or the visitor pressed "Pause motion". */
const reduced = (): boolean =>
	root.classList.contains('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The stacking counter: the card handled last lies on top. */
let top = 10;
const raise = (slot: HTMLElement): void => {
	slot.style.zIndex = String(++top);
};

const front = (slot: HTMLElement): HTMLElement | null => slot.querySelector('.front');
const back = (slot: HTMLElement): HTMLElement | null => slot.querySelector('.back');

function flip(slot: HTMLElement, flipped: boolean, moveFocus = true): void {
	const f = front(slot);
	const b = back(slot);
	const turn = slot.querySelector<HTMLButtonElement>('.turn');
	if (!f || !b || !turn) return;

	slot.classList.toggle('is-flipped', flipped);
	turn.setAttribute('aria-pressed', String(flipped));
	// Reset the tilt, so the card does not turn over leaning.
	slot.style.removeProperty('--rx');
	slot.style.removeProperty('--ry');

	if (flipped) {
		raise(slot);
		// The back opens first, then takes focus, THEN the front is shut: an
		// inert element that holds focus drops it to <body>.
		b.inert = false;
		if (moveFocus) b.querySelector<HTMLElement>('.turn-back')?.focus({ preventScroll: true });
		f.inert = true;
	} else {
		f.inert = false;
		if (moveFocus) turn.focus({ preventScroll: true });
		b.inert = true;
	}
}

const copyTimers = new WeakMap<HTMLElement, number>();

/** Copy the address, and say so in words: on the button and in the live region. */
async function copyAddress(button: HTMLButtonElement): Promise<void> {
	const text = button.dataset.copy ?? '';
	const status = button.closest('.actions')?.querySelector<HTMLElement>('.copied');
	const idle = button.dataset.label ?? button.textContent ?? 'Copy address';
	button.dataset.label = idle;
	let message: string;
	try {
		await navigator.clipboard.writeText(text);
		message = 'Copied';
		button.textContent = 'Copied';
	} catch {
		// No clipboard (an insecure origin, a blocked permission): show it to copy by hand.
		message = text;
	}
	if (status) status.textContent = message === 'Copied' ? 'Copied to clipboard' : message;
	window.clearTimeout(copyTimers.get(button));
	copyTimers.set(
		button,
		window.setTimeout(() => {
			button.textContent = idle;
			if (status) status.textContent = '';
		}, 2500),
	);
}

export function boot(): void {
	const table = document.querySelector<HTMLElement>('.table');
	if (!table) return;
	const slots = [...table.querySelectorAll<HTMLElement>('.slot')];

	// The backs are inert from here on; the markup leaves them open for a
	// visitor without JavaScript.
	for (const slot of slots) {
		const b = back(slot);
		if (b) b.inert = true;
	}

	// ---- still: pause every idle loop -------------------------------------
	const toggle = document.querySelector<HTMLButtonElement>('.still-toggle');
	if (toggle) {
		const show = (): void => {
			const still = root.classList.contains('still');
			toggle.setAttribute('aria-pressed', String(still));
		};
		show();
		toggle.addEventListener('click', () => {
			const still = root.classList.toggle('still');
			try {
				if (still) localStorage.setItem('still', '1');
				else localStorage.removeItem('still');
			} catch {
				// Storage blocked: the choice lasts this visit.
			}
			show();
		});
	}

	// ---- the ticket: tear the stub off and turn it over; press again to put it back
	const stubFace = (slot: HTMLElement, side: 'fr' | 'bk'): HTMLElement | null =>
		slot.querySelector(`.stub.${side}`);
	// The stub's back starts shut, like the card backs.
	for (const slot of slots) {
		const bk = stubFace(slot, 'bk');
		if (bk) bk.inert = true;
	}
	function tear(slot: HTMLElement, torn: boolean): void {
		const fr = stubFace(slot, 'fr');
		const bk = stubFace(slot, 'bk');
		if (!fr || !bk || slot.classList.contains('is-torn') === torn) return;
		slot.classList.toggle('is-torn', torn);
		fr.setAttribute('aria-expanded', String(torn));
		// Open the face that is coming, move focus to it, THEN shut the other:
		// an inert element that holds focus drops it to <body>.
		if (torn) {
			raise(slot);
			bk.inert = false;
			bk.querySelector<HTMLElement>('.actions .go')?.focus({ preventScroll: true });
			fr.inert = true;
		} else {
			fr.inert = false;
			fr.focus({ preventScroll: true });
			bk.inert = true;
		}
	}
	table.addEventListener('click', (e) => {
		const target = e.target;
		if (!(target instanceof Element)) return;
		const slot = target.closest<HTMLElement>('.slot');
		if (slot && target.closest('.tear')) {
			tear(slot, true);
			return;
		}
		if (slot && target.closest('.put-back')) {
			tear(slot, false);
			return;
		}
		const copy = target.closest<HTMLButtonElement>('.copy');
		if (copy) void copyAddress(copy);
	});

	// ---- flip ------------------------------------------------------------
	let swallow = false;

	table.addEventListener('click', (e) => {
		const target = e.target;
		if (!(target instanceof Element)) return;
		const slot = target.closest<HTMLElement>('.slot');
		if (!slot) return;
		if (target.closest('.turn')) {
			if (swallow) return; // the click that ends a drag is not a flip
			flip(slot, true);
		} else if (target.closest('.turn-back')) {
			flip(slot, false);
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.key !== 'Escape') return;
		const active = document.activeElement;
		const slot = active?.closest<HTMLElement>('.slot.is-flipped');
		if (slot) flip(slot, false);
		const torn = active?.closest<HTMLElement>('.slot.is-torn');
		if (torn) tear(torn, false);
	});

	// ---- tilt: a mouse only. Touch has no hover to lean toward. ------------
	table.addEventListener('pointermove', (e) => {
		if (e.pointerType !== 'mouse' || reduced()) return;
		const slot = (e.target as Element).closest<HTMLElement>('.slot');
		if (!slot || slot.classList.contains('is-flipped') || slot.classList.contains('is-dragging')) {
			return;
		}
		const r = slot.getBoundingClientRect();
		// Clamped: on the hover pad around the card the pointer is outside it.
		const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
		const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
		slot.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
		slot.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
		slot.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
		slot.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
		slot.style.setProperty('--mxn', x.toFixed(3));
	});

	for (const slot of slots) {
		slot.addEventListener('pointerleave', () => {
			slot.style.removeProperty('--rx');
			slot.style.removeProperty('--ry');
		});
	}

	// ---- drag: wide screens, mouse only. A pen taps to turn, like a finger. --
	const offsets = new Map<HTMLElement, { x: number; y: number }>();

	table.addEventListener('pointerdown', (e) => {
		if (e.pointerType !== 'mouse' || e.button !== 0 || !matchMedia(WIDE).matches) return;
		const handle = (e.target as Element).closest<HTMLElement>('.turn');
		const slot = handle?.closest<HTMLElement>('.slot');
		if (!handle || !slot) return;

		const origin = offsets.get(slot) ?? { x: 0, y: 0 };
		const startX = e.clientX;
		const startY = e.clientY;
		let dragging = false;

		const move = (m: PointerEvent): void => {
			// The button came up somewhere no pointerup reached (another window,
			// a context menu): the drag is over.
			if (m.buttons === 0) {
				end();
				return;
			}
			const dx = m.clientX - startX;
			const dy = m.clientY - startY;
			if (!dragging) {
				if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
				dragging = true;
				slot.classList.add('is-dragging');
				raise(slot);
				handle.setPointerCapture(e.pointerId);
			}
			const next = { x: origin.x + dx, y: origin.y + dy };
			offsets.set(slot, next);
			slot.style.setProperty('--dx', `${next.x}px`);
			slot.style.setProperty('--dy', `${next.y}px`);
		};

		const end = (): void => {
			handle.removeEventListener('pointermove', move);
			window.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', end);
			handle.removeEventListener('pointercancel', end);
			window.removeEventListener('pointerup', end);
			if (dragging) {
				slot.classList.remove('is-dragging');
				swallow = true;
				setTimeout(() => (swallow = false), 60);
			}
		};

		// Until the threshold the pointer is not captured, so listen on window.
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', end);
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', end);
		handle.addEventListener('pointercancel', end);
	});

	// ---- pause what is not on screen ---------------------------------------
	for (const slot of slots) slot.classList.add('is-off');
	const seen = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			entry.target.classList.toggle('is-off', !entry.isIntersecting);
		}
	});
	for (const slot of slots) seen.observe(slot);

	// ---- the deal ------------------------------------------------------------
	if (!reduced()) {
		const t = table.getBoundingClientRect();
		const originX = t.left + t.width / 2;
		const originY = Math.max(t.top, 0) + 80;
		let n = 0;
		for (const slot of slots) {
			const r = slot.getBoundingClientRect();
			if (r.top > innerHeight) continue; // below the fold: already on the table
			const dx = originX - (r.left + r.width / 2);
			const dy = originY - (r.top + r.height / 2);
			const spin = (n % 2 ? 1 : -1) * (8 + n * 3);
			slot.animate(
				[
					{ transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(0.6)`, opacity: 0 },
					{ transform: 'none', opacity: 1 },
				],
				{
					duration: 520,
					delay: n * 70,
					easing: 'cubic-bezier(0.2, 0.9, 0.25, 1.12)',
					fill: 'backwards',
				},
			);
			n++;
		}
	}
	root.classList.remove('will-deal');
}

boot();
