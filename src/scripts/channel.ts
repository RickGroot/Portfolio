/**
 * Publishes the channel in view onto <html>.
 *
 * Every region of a page that is a channel -- each section of the one-pager,
 * the hero and the reading area of a case study -- carries its colours inline
 * and says so with `data-channel` (see src/lib/channels.ts). The fixed chrome
 * -- the rail, the cursor, the progress bar -- sits outside all of them, so it
 * reads the page's colours from <html> instead, and this keeps <html> pointed
 * at whichever channel is under the middle of the viewport.
 *
 * Deliberately separate from the section advance in sections.ts. The advance
 * switches itself off under `prefers-reduced-motion`; this must not. It is
 * colour, not motion, and on saturated fields the chrome needs the right colour
 * to stay visible at all -- paper marks over the yellow channel would be about
 * 1.2:1.
 */

/** Everything a channel sets. Must match channelStyle() in src/lib/channels.ts. */
const VARS = [
	'--field',
	'--mark',
	'--mark-dim',
	'--accent',
	'--line',
	'--line-loud',
	'--duo-blend',
] as const;

export function boot(): void {
	const channels = [...document.querySelectorAll<HTMLElement>('[data-channel]')];
	if (channels.length === 0) return;

	const root = document.documentElement;
	const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	let current: HTMLElement | undefined;

	function publish(region: HTMLElement): void {
		if (region === current) return;
		current = region;
		const cs = getComputedStyle(region);
		for (const name of VARS) {
			const value = cs.getPropertyValue(name).trim();
			if (value) root.style.setProperty(name, value);
		}
		// The browser's own chrome follows too, so on a phone the address bar
		// changes channel with the page.
		const field = cs.getPropertyValue('--field').trim();
		if (themeColor && field) themeColor.content = field;
	}

	// A zero-height line across the middle of the viewport: whichever region
	// it crosses is the one you are looking at. Cheaper and more honest than
	// reading scroll positions, and it cannot disagree with what is on screen.
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) publish(entry.target as HTMLElement);
			}
		},
		{ rootMargin: '-50% 0px -50% 0px' },
	);
	for (const region of channels) io.observe(region);
}
