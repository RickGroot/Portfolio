/**
 * The test card's clock: the visitor's own time, as the guide's clock is --
 * real state, not decoration (docs/DESIGN_REFERENCES.md, 2xA).
 *
 * To the second, as a card's clock runs, and only while the hero is on
 * screen: a timer that nobody can see is still a style recalculation a
 * second. Under reduced motion it shows the minute, and changes once a minute.
 * A timer, not the animation loop: the loop is for frames, and this changes
 * once a second at most.
 */

const SECONDS = new Intl.DateTimeFormat('en-GB', {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
});
const MINUTES = new Intl.DateTimeFormat('en-GB', {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

export function boot(): void {
	const clock = document.querySelector<HTMLElement>('[data-hero-clock]');
	const hero = clock?.closest<HTMLElement>('.hero');
	if (!clock || !hero) return;

	const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const format = still ? MINUTES : SECONDS;
	const every = still ? 60_000 : 1000;
	let timer = 0;

	const tick = (): void => {
		clock.textContent = format.format(new Date());
		// On the boundary, plus a little, so it never shows a second late.
		timer = window.setTimeout(tick, every - (Date.now() % every) + 20);
	};

	clock.textContent = format.format(new Date());
	clock.hidden = false;

	new IntersectionObserver((entries) => {
		const e = entries[entries.length - 1];
		window.clearTimeout(timer);
		if (e?.isIntersecting) tick();
	}).observe(hero);
}
