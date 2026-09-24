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
 *   - Keyboard keeps working: PageUp/PageDown, Home/End and arrows all move
 *     between sections, and Tab moves focus normally without hijacking.
 *   - Deep links (`/#work`) land on the right section.
 *   - A section can have steps of its own. The programme guide takes each
 *     scroll as a step through its programmes, and the page only moves on
 *     after the last one -- asked first, with a cancelable event, so a section
 *     that does not answer is advanced past exactly as before.
 *   - Focus moves with the view, so a screen reader and a sighted user stay in
 *     the same place.
 *   - It uses the browser's own smooth scrolling. No animation loop — the one
 *     loop on this site belongs to the character field.
 */

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
/** Wheel deltas below this are trackpad drift, not intent. */
const WHEEL_THRESHOLD = 12;
/** Vertical swipe distance that counts as intent. */
const SWIPE_THRESHOLD = 48;

export function boot(): void {
	const sections = [...document.querySelectorAll<HTMLElement>('[data-section]')];
	if (sections.length < 2) return;

	// Asking for less motion and getting smooth-scroll-jacking would be the
	// exact opposite of the request. Leave the page as a normal long scroll.
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	if (reduced.matches) return;

	const root = document.documentElement;

	let index = 0;
	let locked = false;
	let lockTimer = 0;

	const rail = document.querySelector<HTMLElement>('[data-rail]');
	const dots = rail ? [...rail.querySelectorAll<HTMLAnchorElement>('a')] : [];

	/** Mark which sections are taller than the viewport, so we can let them scroll. */
	function measure(): void {
		for (const section of sections) {
			const overflows = section.scrollHeight > window.innerHeight + 8;
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

		// A stepped section starts from the end you came in at: from above at
		// its first step, from below at its last.
		if (i !== index) {
			target.dispatchEvent(
				new CustomEvent('section:enter', { detail: { from: i > index ? 'above' : 'below' } }),
			);
		}

		setCurrent(next);
		target.scrollIntoView({ behavior: 'smooth', block: 'start' });

		// Move focus with the view. Without this a keyboard user's next Tab
		// continues from wherever they were, which is now off-screen.
		const focusTarget = target.querySelector<HTMLElement>('h1, h2') ?? target;
		focusTarget.setAttribute('tabindex', '-1');
		focusTarget.focus({ preventScroll: true });
	}

	/**
	 * True when the current section still has somewhere to scroll in `dir`.
	 * This is what stops a tall section from becoming a trap.
	 */
	function canScrollWithin(dir: number): boolean {
		const section = sections[index];
		if (!section || !('overflows' in section.dataset)) return false;
		const rect = section.getBoundingClientRect();
		return dir > 0 ? rect.bottom > window.innerHeight + 4 : rect.top < -4;
	}

	function onWheel(ev: WheelEvent): void {
		if (Math.abs(ev.deltaY) < WHEEL_THRESHOLD) return;
		const dir = ev.deltaY > 0 ? 1 : -1;
		if (canScrollWithin(dir)) return; // let the section scroll itself
		ev.preventDefault();
		if (locked) {
			extendLock();
			return;
		}
		if (stepWithin(dir)) lock(STEP_MS);
		else go(index + dir);
	}

	function onKey(ev: KeyboardEvent): void {
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
		else if (ev.key === 'Home') {
			ev.preventDefault();
			go(0);
			return;
		} else if (ev.key === 'End') {
			ev.preventDefault();
			go(sections.length - 1);
			return;
		} else return;

		if (canScrollWithin(dir)) return;
		ev.preventDefault();
		if (locked) return;
		if (stepWithin(dir)) lock(STEP_MS);
		else go(index + dir);
	}

	let touchY = 0;
	function onTouchStart(ev: TouchEvent): void {
		touchY = ev.touches[0]?.clientY ?? 0;
	}
	function onTouchEnd(ev: TouchEvent): void {
		const endY = ev.changedTouches[0]?.clientY ?? touchY;
		const delta = touchY - endY;
		if (Math.abs(delta) < SWIPE_THRESHOLD) return;
		const dir = delta > 0 ? 1 : -1;
		if (canScrollWithin(dir) || locked) return;
		if (stepWithin(dir)) lock(STEP_MS);
		else go(index + dir);
	}

	/** Keep `index` honest when something else moves the page (deep link, rail). */
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const i = sections.indexOf(entry.target as HTMLElement);
				if (i >= 0 && !locked) setCurrent(i);
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
}
