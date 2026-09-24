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
 *   - Deep links (`/#vamp`) land on the right section.
 *   - Focus moves with the view, so a screen reader and a sighted user stay in
 *     the same place.
 *   - It uses the browser's own smooth scrolling. No animation loop — the one
 *     loop on this site belongs to the character field.
 */

/** How long to ignore further intent while a move is settling. */
const SETTLE_MS = 620;
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
	root.dataset.sections = 'on';

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

	function go(next: number): void {
		const target = sections[Math.max(0, Math.min(sections.length - 1, next))];
		if (!target) return;

		locked = true;
		window.clearTimeout(lockTimer);
		lockTimer = window.setTimeout(() => {
			locked = false;
		}, SETTLE_MS);

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
		if (locked) {
			ev.preventDefault();
			return;
		}
		ev.preventDefault();
		go(index + dir);
	}

	function onKey(ev: KeyboardEvent): void {
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
		if (!locked) go(index + dir);
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
		go(index + dir);
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

	// Land on the right section for /#vamp and friends.
	if (location.hash) {
		const i = sections.findIndex((s) => `#${s.id}` === location.hash);
		if (i >= 0) setCurrent(i);
	}

	// `passive: false` because the whole point is to preventDefault. It is the
	// one listener on the page that must not be passive.
	window.addEventListener('wheel', onWheel, { passive: false });
	window.addEventListener('keydown', onKey);
	window.addEventListener('touchstart', onTouchStart, { passive: true });
	window.addEventListener('touchend', onTouchEnd, { passive: true });
}
