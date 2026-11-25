/*
 * The one script: everything that makes the table feel handled.
 *
 *   - flip:   a card turns over (click, Enter or Space on its front button).
 *   - tilt:   a card leans toward a mouse, with a gloss that follows it.
 *   - drag:   a card can be moved about the table, wide screens, mouse only.
 *   - pause:  a card that is off screen stops its idle loops.
 *   - deal:   the cards are dealt from a stack when the page opens.
 *   - remote: the arrow keys move focus to the nearest card that way, as on a TV.
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

/**
 * Where an element is on screen. Not getBoundingClientRect: in WebKit a tilted
 * card at the top of a column pokes a corner above the column, and WebKit maps
 * that corner to the foot of the column before, so the bounding box of the
 * first card in a column spans the whole table. The largest piece is the card.
 */
const rect = (el: Element): DOMRect => {
	let best = el.getBoundingClientRect();
	const parts = el.getClientRects();
	if (parts.length < 2) return best;
	let area = -1;
	for (const r of parts) {
		if (r.width * r.height > area) {
			area = r.width * r.height;
			best = r;
		}
	}
	return best;
};

/** The stacking counter: the card handled last lies on top. */
let top = 10;
const raise = (slot: HTMLElement): void => {
	slot.style.zIndex = String(++top);
};

/**
 * Focus a control and bring it into view when it is not: first inside a back
 * that scrolls (large text), then in the window: the whole card when that
 * fits, else just the control (a tall card at high zoom).
 */
const reveal = (el: HTMLElement | null | undefined): void => {
	if (!el) return;
	el.focus({ preventScroll: true });
	const box = el.parentElement?.closest<HTMLElement>('.is-long, .scroll, .stub.bk');
	if (box) {
		// Vertical only: a back turned away is mirrored left to right, not up and down.
		const b = rect(box);
		const c = rect(el);
		if (c.top < b.top) box.scrollTop -= b.top - c.top;
		else if (c.bottom > b.bottom) box.scrollTop += Math.min(c.bottom - b.bottom, c.top - b.top);
	}
	const card = el.closest('.slot') ?? el;
	const fits = rect(card).height <= innerHeight;
	const shown = fits ? card : el;
	const r = rect(shown);
	if (r.top < 0 || r.bottom > innerHeight) {
		// From rect(), not scrollIntoView: WebKit's own geometry for a card split
		// at a column top spans the table, and it scrolls to the wrong place.
		const top = fits
			? r.top - (innerHeight - r.height) / 2
			: r.top < 0
				? r.top
				: r.bottom - innerHeight;
		scrollTo({ top: scrollY + top, behavior: reduced() ? 'auto' : 'smooth' });
	}
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
		if (moveFocus) reveal(b.querySelector<HTMLElement>('.turn-back'));
		f.inert = true;
	} else {
		f.inert = false;
		if (moveFocus) reveal(turn);
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
	// A printed address stays until the next press: it is there to copy by hand.
	if (message !== 'Copied') return;
	copyTimers.set(
		button,
		window.setTimeout(() => {
			button.textContent = idle;
			if (status) status.textContent = '';
		}, 2500),
	);
}

/*
 * The remote: a TV app's focus engine, for a keyboard. An arrow moves focus to
 * the nearest control that lies that way, on any card or in the bar. Controls
 * on a face that is turned away are inert and never count. With nothing
 * focused, the first arrow lands on the card nearest the window's top-left.
 */
const ARROWS: Record<string, readonly [number, number]> = {
	ArrowRight: [1, 0],
	ArrowLeft: [-1, 0],
	ArrowDown: [0, 1],
	ArrowUp: [0, -1],
};
const FOCUSABLE = 'a[href], button:not(:disabled), [tabindex="0"]';

/** Can focus land here: not on a face turned away, not hidden, laid out. */
const usable = (el: HTMLElement): boolean =>
	!el.closest('[inert]') &&
	el.getClientRects().length > 0 &&
	getComputedStyle(el).visibility !== 'hidden';

/**
 * Where the remote starts when nothing has focus: the card control nearest the
 * window's top-left corner, among those whose centre is on screen. The first
 * arrow wakes the remote, as the first press on a TV shows where you are.
 */
function start(table: Element): HTMLElement | null {
	let best: HTMLElement | null = null;
	let bestScore = Infinity;
	for (const el of table.querySelectorAll<HTMLElement>(FOCUSABLE)) {
		if (!usable(el)) continue;
		const r = rect(el);
		const cx = (r.left + r.right) / 2;
		const cy = (r.top + r.bottom) / 2;
		if (cx < 0 || cx > innerWidth || cy < 0 || cy > innerHeight) continue;
		const score = Math.hypot(Math.max(0, r.left), Math.max(0, r.top));
		if (score < bestScore) {
			bestScore = score;
			best = el;
		}
	}
	return best;
}

function nearest(
	from: HTMLElement,
	[x, y]: readonly [number, number],
	area: Element,
): HTMLElement | null {
	const sign = x || y;
	// A box as [start, end] along the direction of travel (mirrored when it
	// points back, so "further" is always larger), and as a span across it.
	const along = (r: DOMRect): [number, number] =>
		x
			? sign > 0
				? [r.left, r.right]
				: [-r.right, -r.left]
			: sign > 0
				? [r.top, r.bottom]
				: [-r.bottom, -r.top];
	const across = (r: DOMRect): [number, number] => (x ? [r.top, r.bottom] : [r.left, r.right]);
	const o = rect(from);
	const [, oEnd] = along(o);
	const [oA, oB] = across(o);
	// An open card holds focus until nothing on it lies that way, like a panel on a TV.
	const home = from.closest('.slot');
	let best: HTMLElement | null = null;
	let bestScore = Infinity;
	for (const el of area.querySelectorAll<HTMLElement>(FOCUSABLE)) {
		if (el === from || !usable(el)) continue;
		const r = rect(el);
		const [start, end] = along(r);
		// Its centre must lie past the far edge of `from`, so a card in the same
		// column, leaning a little, is not "to the right".
		if ((start + end) / 2 <= oEnd) continue;
		const [a, b] = across(r);
		const gap = Math.max(0, start - oEnd);
		const off = Math.abs(a + b - oA - oB) / 2;
		// In line (the two overlap across the direction) beats off to one side.
		const inLine = a < oB && b > oA;
		const score = (home?.contains(el) ? 0 : 2e5) + (inLine ? gap + off / 4 : 1e5 + gap + off * 2);
		if (score < bestScore) {
			bestScore = score;
			best = el;
		}
	}
	return best;
}

/**
 * A back is laid out to fit its card, but larger text (text-only zoom, a
 * reader's own spacing) can outgrow it. A body that overflows becomes a
 * scroller a keyboard can reach: a tab stop, named by the card's title, that
 * Up and Down scroll (the remote). One that fits again goes back to plain,
 * but not while it holds focus: that would drop focus to <body>, so it waits
 * for the blur. The cast's body is its screen, `.np`; the ticket's is the back
 * of its stub, which keeps its own role and name. The liner is always a
 * scroller, in its markup.
 */
const SCROLLERS = '.back .bb:not(.scroll), .back .np, .stub.bk';
const waiting = new WeakSet<HTMLElement>();
function fit(slot: HTMLElement): void {
	for (const el of slot.querySelectorAll<HTMLElement>(SCROLLERS)) {
		// The stub's back only counts once it is torn off: before that it is a
		// narrow strip, turned away and inert, that no one needs to scroll.
		const shut = el.matches('.stub.bk') && !slot.classList.contains('is-torn');
		const over = !shut && el.scrollHeight - el.clientHeight > 1;
		if (over === el.classList.contains('is-long')) continue;
		if (!over && el === document.activeElement) {
			if (!waiting.has(el)) {
				waiting.add(el);
				el.addEventListener(
					'blur',
					() => {
						waiting.delete(el);
						fit(slot);
					},
					{ once: true },
				);
			}
			continue;
		}
		el.classList.toggle('is-long', over);
		if (over) {
			el.tabIndex = 0;
			const title = slot.querySelector<HTMLElement>('.back h2');
			if (!el.hasAttribute('role') && title) {
				// Named by the title it holds, so the name is the heading's own text.
				title.id ||= `${slot.dataset.card ?? 'card'}-title`;
				el.setAttribute('role', 'region');
				el.setAttribute('aria-labelledby', title.id);
			}
		} else {
			el.removeAttribute('tabindex');
			if (el.hasAttribute('aria-labelledby')) {
				for (const a of ['role', 'aria-labelledby']) el.removeAttribute(a);
			}
		}
	}
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

	// ---- backs that outgrow their card scroll, and say so ------------------
	// Watched by size (the window, zoom) and their content's size (text-only
	// zoom, fonts loading); spacing applied by a reader's own style sheet
	// changes neither box, so a card is checked again when it turns and when
	// focus enters it.
	const fitAll = (): void => slots.forEach(fit);
	const grown = new ResizeObserver(fitAll);
	for (const el of table.querySelectorAll<HTMLElement>(SCROLLERS)) {
		grown.observe(el);
		for (const child of el.children) grown.observe(child);
	}
	void document.fonts.ready.then(fitAll);

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
			reveal(bk.querySelector<HTMLElement>('.actions .go'));
			fr.inert = true;
		} else {
			fr.inert = false;
			reveal(fr);
			bk.inert = true;
		}
		fit(slot);
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

	// ---- remote: the arrow keys move focus to the nearest control that way ----
	const area = table.closest('main') ?? table;
	document.addEventListener('keydown', (e) => {
		const dir = ARROWS[e.key];
		if (!dir || e.defaultPrevented || e.isComposing) return;
		if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
		const a = document.activeElement;
		const page = !a || a === document.body || a === document.documentElement;
		if (!page && !(a instanceof HTMLElement && area.contains(a))) return;
		const active = a instanceof HTMLElement && !page ? a : null;
		if (active?.isContentEditable || active?.matches('input, textarea, select')) return;
		let next: HTMLElement | null;
		if (!active || !active.matches(FOCUSABLE)) {
			// No control has focus (the page, or `main` after a click on the paper or
			// the skip link): the first arrow lands on a card.
			next = start(table);
		} else {
			// A scrolling back (the liner, or one that outgrew its card) scrolls under
			// Up and Down until it reaches its end; then the arrow moves on. At the
			// foot, Down goes to its own links first: they lie inside it, so they are
			// never "below" it.
			const scroller = active.matches('.scroll, .is-long');
			if (scroller && dir[1] !== 0) {
				const room =
					dir[1] > 0
						? active.scrollTop + active.clientHeight < active.scrollHeight - 1
						: active.scrollTop > 0;
				if (room) return;
			}
			next =
				(scroller && dir[1] > 0
					? [...active.querySelectorAll<HTMLElement>(FOCUSABLE)].find(usable)
					: null) ?? nearest(active, dir, area);
		}
		if (!next) return; // nothing that way: the arrow keeps its usual job
		e.preventDefault();
		reveal(next);
	});

	// A card in focus comes to the top of the pile, so one dragged over it
	// cannot hide the control that has focus.
	table.addEventListener('focusin', (e) => {
		const slot = (e.target as Element).closest<HTMLElement>('.slot');
		if (slot && slot.style.zIndex !== String(top)) raise(slot);
		if (slot) fit(slot);
	});

	// ---- tilt: a mouse only. Touch has no hover to lean toward. ------------
	table.addEventListener('pointermove', (e) => {
		if (e.pointerType !== 'mouse' || reduced()) return;
		const slot = (e.target as Element).closest<HTMLElement>('.slot');
		if (!slot || slot.classList.contains('is-flipped') || slot.classList.contains('is-dragging')) {
			return;
		}
		const r = rect(slot);
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
			const r = rect(slot);
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
