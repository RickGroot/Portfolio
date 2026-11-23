/**
 * Animated section-to-section advance for the one-page narrative.
 *
 * This is scroll-jacking, and the brief rules it out. It was chosen anyway, so
 * it is built as the version that cannot trap anyone:
 *
 *   - `prefers-reduced-motion` disables it completely. Native scroll returns.
 *   - A section taller than the viewport scrolls NORMALLY until you reach its
 *     end; only then does the next gesture advance. Otherwise its bottom would
 *     be unreachable, which is the classic failure of this pattern.
 *   - Past the last section the browser has the move: nothing is below it.
 *   - Ctrl + wheel and a trackpad pinch still zoom.
 *   - Keyboard keeps working: PageUp/PageDown, Space, Home/End and arrows all
 *     move between sections, and Tab moves focus normally without hijacking.
 *     The number keys tune straight to a channel, as on a remote.
 *   - Deep links (`/#work`) land on the right section.
 *   - A section can have steps of its own. The programme guide takes each
 *     scroll as a step through its programmes, and the page only moves on
 *     after the last one -- asked first, with a cancelable event, so a section
 *     that does not answer is advanced past exactly as before.
 *   - Focus moves with the view, so a screen reader and a sighted user stay in
 *     the same place.
 *   - It uses the browser's own smooth scrolling. No animation loop of its
 *     own — the site's one loop holds its ambient work still while a move
 *     settles, so the scroll and the static have the frames.
 */
import { hold } from '../lib/field/loop';

/** How long to ignore further intent while a move is settling. */
const SETTLE_MS = 620;
/** The same, for a step inside a section: nothing scrolls, so it settles sooner. */
const STEP_MS = 420;
/**
 * A lock also lasts until the gesture has gone quiet for this long. A trackpad
 * flick keeps sending wheel events for a second or more of inertia, and
 * without this the tail of one flick was a second step.
 */
const QUIET_MS = 160;
/**
 * Wheel movement has to add up to this before it counts as intent. Added up,
 * not judged event by event: a slow trackpad scroll is a stream of 1-5px
 * deltas, and when each was let through as drift, the page crept past the edge
 * of a channel. It was 12, and a 15px nudge on a trackpad -- someone settling
 * their hand -- changed channel (2026-09-29). A mouse notch is 100px or a
 * line, far over either.
 */
const WHEEL_THRESHOLD = 32;
/** A pause this long between wheel events starts a new gesture. */
const WHEEL_GAP_MS = 240;
/** A wheel "line" in px, for a mouse that reports lines (Firefox). */
const LINE_PX = 16;
/** Vertical swipe distance that counts as intent. */
const SWIPE_THRESHOLD = 48;
/** Where Space presses the thing in focus rather than paging. */
const CONTROLS =
	'button, summary, audio, video, [role="button"], [role="checkbox"], [role="switch"], [role="tab"], [role="option"], [role="menuitem"]';

/**
 * The number keys are a remote: 1 is the masthead and each channel after it
 * the next number, as the readout in the corner counts them. Returns the
 * channel's index, or -1.
 *
 * A single character is a shortcut that speech input can type by accident
 * (WCAG 2.1.4), so the keys are live only while focus is in the page's
 * content -- which is where every change of channel leaves it. On a page
 * nobody has touched yet, focus is on the body and a number does nothing.
 * Shift is allowed: on AZERTY the digits are shifted, and `key` is still the
 * digit.
 */
function channelKey(ev: KeyboardEvent, count: number): number {
	if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return -1;
	if (!/^[1-9]$/.test(ev.key)) return -1;
	const el = ev.target;
	if (!(el instanceof HTMLElement) || !el.closest('main')) return -1;
	if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return -1;
	const i = Number(ev.key) - 1;
	return i < count ? i : -1;
}

/**
 * Move focus with the view. Without this a keyboard user's next Tab continues
 * from wherever they were, which is now off-screen.
 */
function focusIn(section: HTMLElement): void {
	const target = section.querySelector<HTMLElement>('h1, h2') ?? section;
	target.setAttribute('tabindex', '-1');
	target.focus({ preventScroll: true });
}

export function boot(): void {
	const sections = [...document.querySelectorAll<HTMLElement>('[data-section]')];
	if (sections.length < 2) return;

	// Asking for less motion and getting smooth-scroll-jacking would be the
	// exact opposite of the request. Leave the page as a normal long scroll.
	// The remote still works there: a number jumps, the way a rail link does
	// with smooth scrolling off, with no static and no readout.
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	if (reduced.matches) {
		window.addEventListener('keydown', (ev) => {
			const target = sections[channelKey(ev, sections.length)];
			if (!target) return;
			ev.preventDefault();
			target.scrollIntoView({ behavior: 'instant', block: 'start' });
			focusIn(target);
		});
		return;
	}

	const root = document.documentElement;

	let index = 0;
	let locked = false;
	let lockTimer = 0;

	const rail = document.querySelector<HTMLElement>('[data-rail]');
	const dots = rail ? [...rail.querySelectorAll<HTMLAnchorElement>('a')] : [];

	/**
	 * Mark which sections are taller than the viewport, so we can let them scroll.
	 *
	 * The section's own box, not its scrollHeight. scrollHeight counts the
	 * transformed overflow of its children, and the parallax layers and
	 * arrival animations translate children past the edge on purpose: with
	 * scrollHeight every full-screen section measured a few px too tall, was
	 * handed to native scrolling, and one PageDown skipped a section.
	 */
	function measure(): void {
		for (const section of sections) {
			const overflows = section.getBoundingClientRect().height > window.innerHeight + 8;
			if (overflows) section.dataset.overflows = '';
			else delete section.dataset.overflows;
		}
	}

	// Channel colours are published by src/scripts/channel.ts, which runs even
	// when this advance is switched off for reduced motion. This only tracks
	// position.
	function setCurrent(next: number): void {
		index = Math.max(0, Math.min(sections.length - 1, next));
		dots.forEach((dot, i) => {
			if (i === index) dot.setAttribute('aria-current', 'true');
			else dot.removeAttribute('aria-current');
		});
	}

	let lockEnds = 0;

	/** Ignore intent for `ms`, and for as long after that as it keeps coming. */
	function lock(ms: number): void {
		locked = true;
		lockEnds = performance.now() + ms;
		window.clearTimeout(lockTimer);
		lockTimer = window.setTimeout(release, ms);
	}

	function release(): void {
		const left = lockEnds - performance.now();
		if (left > 0) {
			lockTimer = window.setTimeout(release, left);
			return;
		}
		locked = false;
	}

	/** Intent arrived while locked: keep the lock until the gesture goes quiet. */
	function extendLock(): void {
		lockEnds = Math.max(lockEnds, performance.now() + QUIET_MS);
	}

	/**
	 * Ask the current section whether it wants this step for itself. It says
	 * yes by cancelling the event. An overflowing section is never asked: it
	 * scrolls natively first, and stepping as well would fight the scroll.
	 */
	function stepWithin(dir: number): boolean {
		const section = sections[index];
		if (!section || !('steps' in section.dataset) || 'overflows' in section.dataset) return false;
		const ev = new CustomEvent('section:step', { cancelable: true, detail: { dir } });
		section.dispatchEvent(ev);
		return ev.defaultPrevented;
	}

	function go(next: number): void {
		const i = Math.max(0, Math.min(sections.length - 1, next));
		const target = sections[i];
		if (!target) return;

		lock(SETTLE_MS);
		hold(SETTLE_MS);

		// A stepped section starts from the end you came in at: from above at
		// its first step, from below at its last.
		if (i !== index) {
			target.dispatchEvent(
				new CustomEvent('section:enter', {
					bubbles: true,
					detail: { from: i > index ? 'above' : 'below' },
				}),
			);
		}

		// Into a section taller than the screen from below, at its foot: the part
		// next to where you came from. At its top, going back up from Field on a
		// phone put the whole of How I work's lower half out of sight.
		const fromBelow = i < index;
		setCurrent(next);
		target.scrollIntoView({
			behavior: 'smooth',
			block: fromBelow && 'overflows' in target.dataset ? 'end' : 'start',
		});
		focusIn(target);
	}

	/**
	 * Back to where the current channel rests, after a gesture that was not a
	 * change of channel: its top, or anywhere within it if it is taller than
	 * the screen, clamped to its edges. A 40px drag used to leave the page there
	 * for good, a strip of the next channel showing under this one.
	 */
	function settleBack(): void {
		const section = sections[index];
		if (!section) return;
		const rect = section.getBoundingClientRect();
		const top = rect.top + window.scrollY;
		const foot = 'overflows' in section.dataset ? top + rect.height - window.innerHeight : top;
		const y = window.scrollY;
		const rest = Math.min(foot, Math.max(top, y));
		if (Math.abs(rest - y) > 1) window.scrollTo({ top: rest, behavior: 'smooth' });
	}

	/**
	 * How far the current section can still scroll in `dir`, in px; 0 when it
	 * cannot. This is what stops a tall section from becoming a trap.
	 */
	function roomWithin(dir: number): number {
		const section = sections[index];
		if (!section || !('overflows' in section.dataset)) return 0;
		const rect = section.getBoundingClientRect();
		const room = dir > 0 ? rect.bottom - window.innerHeight : -rect.top;
		return room > 4 ? room : 0;
	}

	function canScrollWithin(dir: number): boolean {
		return roomWithin(dir) > 0;
	}

	/**
	 * True when this move is past the last section. Nothing is below it, so
	 * the move is left to the browser rather than taken: the end of the page
	 * behaves like the end of a page, a trackpad's bounce and all.
	 */
	function pastTheEnd(dir: number): boolean {
		return dir > 0 && index === sections.length - 1;
	}

	/** One step of intent: a step inside the section, or the next channel. */
	function advance(dir: number): void {
		if (stepWithin(dir)) lock(STEP_MS);
		else go(index + dir);
	}

	let wheelSum = 0;
	let wheelAt = 0;

	function onWheel(ev: WheelEvent): void {
		// Ctrl + wheel is the browser's zoom, and a trackpad pinch arrives as
		// one. Neither is a scroll.
		if (ev.ctrlKey) return;
		const dy =
			ev.deltaMode === 1
				? ev.deltaY * LINE_PX
				: ev.deltaMode === 2
					? ev.deltaY * window.innerHeight
					: ev.deltaY;
		if (dy === 0) return; // sideways
		const dir = dy > 0 ? 1 : -1;
		if (canScrollWithin(dir) || pastTheEnd(dir)) {
			wheelSum = 0;
			return; // let the page scroll itself
		}
		// Every wheel event over a channel is ours, however small: one let
		// through is a pixel of drift, and a slow scroll is hundreds of them.
		ev.preventDefault();
		if (locked) {
			extendLock();
			return;
		}
		if (ev.timeStamp - wheelAt > WHEEL_GAP_MS || Math.sign(wheelSum) !== dir) wheelSum = 0;
		wheelAt = ev.timeStamp;
		wheelSum += dy;
		if (Math.abs(wheelSum) < WHEEL_THRESHOLD) return;
		wheelSum = 0;
		advance(dir);
	}

	function onKey(ev: KeyboardEvent): void {
		// A number goes straight to its channel, but not while a change is still
		// settling: every change is a burst of static, and the lock is what keeps
		// those under two a second however fast the keys are pressed.
		const channel = channelKey(ev, sections.length);
		if (channel >= 0) {
			ev.preventDefault();
			if (!locked && channel !== index) go(channel);
			return;
		}

		// Something inside the page already used the key -- the programme guide
		// moving between its rows. Only what is left over advances a section.
		if (ev.defaultPrevented) return;
		// Never steal typing.
		const el = ev.target as HTMLElement | null;
		if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
		if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

		let dir: number;
		if (ev.key === 'PageDown' || ev.key === 'ArrowDown') dir = 1;
		else if (ev.key === 'PageUp' || ev.key === 'ArrowUp') dir = -1;
		else if (ev.key === ' ') {
			// Space pages like PageDown, and Shift+Space like PageUp -- except on
			// a control, where Space presses it.
			if (el?.closest(CONTROLS)) return;
			dir = ev.shiftKey ? -1 : 1;
		} else if (ev.key === 'Home') {
			ev.preventDefault();
			go(0);
			return;
		} else if (ev.key === 'End') {
			ev.preventDefault();
			go(sections.length - 1);
			return;
		} else return;

		if (pastTheEnd(dir)) return;
		const room = roomWithin(dir);
		if (room) {
			// A native page is most of the viewport. In a section only a little
			// taller than the screen it carried the view past the section's end
			// and 150px into the next one, which then took over misaligned. Page
			// by at most what is left; the next press changes channel.
			if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') {
				ev.preventDefault();
				const page = Math.min(room, window.innerHeight * 0.875);
				window.scrollTo({ top: window.scrollY + dir * page, behavior: 'smooth' });
			}
			return;
		}
		ev.preventDefault();
		if (locked) return;
		advance(dir);
	}

	/*
	 * A finger scrolls the page natively, and what it meant is decided when it
	 * lifts, from where it started: the channel it went down on, and how far and
	 * which way it moved. Measured on a phone (2026-09-29), trusting the page
	 * instead failed three ways. The observer below moved `index` on to the next
	 * channel while the finger was still dragging, so the swipe then advanced
	 * from there: a slow drag off the foot of the guide skipped the Signal
	 * interlude, five in five, and one up from Field skipped How I work. A drag
	 * under the threshold left the page wherever the finger let go. And a
	 * sideways swipe with a little vertical in it changed channel.
	 */
	let touchX = 0;
	let touchY = 0;
	let touching = false;
	let touchFrom = 0;
	function onTouchStart(ev: TouchEvent): void {
		const t = ev.touches[0];
		// A second finger is a pinch: the browser's, as Ctrl + wheel is.
		if (!t || ev.touches.length > 1) {
			touching = false;
			return;
		}
		touchX = t.clientX;
		touchY = t.clientY;
		touching = true;
		touchFrom = index;
	}
	function onTouchEnd(ev: TouchEvent): void {
		if (!touching) return;
		touching = false;
		const t = ev.changedTouches[0];
		const dx = touchX - (t?.clientX ?? touchX);
		const dy = touchY - (t?.clientY ?? touchY);
		setCurrent(touchFrom);
		if (locked) return;
		const dir = dy > 0 ? 1 : -1;
		if (Math.abs(dy) < SWIPE_THRESHOLD || Math.abs(dx) > Math.abs(dy)) {
			settleBack();
			return;
		}
		if (canScrollWithin(dir) || pastTheEnd(dir)) return;
		advance(dir);
	}
	function onTouchCancel(): void {
		touching = false;
	}

	/**
	 * Keep `index` honest when something else moves the page (deep link, Tab).
	 * The ratio, not isIntersecting: a channel on its way OUT crosses the
	 * threshold too, still intersecting, and used to become the current one.
	 * Not while a finger is down: see the touch handlers.
	 */
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.intersectionRatio < 0.55) continue;
				const i = sections.indexOf(entry.target as HTMLElement);
				if (i >= 0 && !locked && !touching) setCurrent(i);
			}
		},
		{ threshold: 0.55 },
	);
	for (const section of sections) observer.observe(section);

	measure();
	const resize = new ResizeObserver(measure);
	resize.observe(document.body);

	// Land on the right section for /#work and friends -- instantly. A deep
	// link is a place, not a journey. The browser does its own jump to the
	// fragment only after this has run, and with smooth scrolling already on it
	// glided there from the top of the page: a case study's "Guide" link rolled
	// the whole hero past on the way back.
	if (location.hash) {
		const i = sections.findIndex((s) => `#${s.id}` === location.hash);
		if (i >= 0) {
			setCurrent(i);
			sections[i]?.scrollIntoView({ behavior: 'instant', block: 'start' });
		}
	}

	// Smooth scrolling on only now, after any deep link has landed.
	root.dataset.sections = 'on';

	// `passive: false` because the whole point is to preventDefault. It is the
	// one listener on the page that must not be passive.
	window.addEventListener('wheel', onWheel, { passive: false });
	window.addEventListener('keydown', onKey);
	window.addEventListener('touchstart', onTouchStart, { passive: true });
	window.addEventListener('touchend', onTouchEnd, { passive: true });
	window.addEventListener('touchcancel', onTouchCancel, { passive: true });

	// A dot on the rail is a change of channel like any other: the static, the
	// readout, focus moved into the channel. As a plain link it scrolled there
	// with none of them and left focus behind, on the rail. The fragment still
	// goes into the address, replaced rather than pushed, as the section
	// advance never pushes one either.
	for (const dot of dots) {
		const i = sections.findIndex((s) => `#${s.id}` === dot.hash);
		if (i < 0) continue;
		dot.addEventListener('click', (ev) => {
			if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
			ev.preventDefault();
			history.replaceState(null, '', dot.hash);
			go(i);
		});
	}
}
