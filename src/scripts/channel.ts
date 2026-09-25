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
	'--duo-hi',
	'--duo-lo',
] as const;

export function boot(): void {
	const channels = [...document.querySelectorAll<HTMLElement>('[data-channel]')];
	if (channels.length === 0) return;

	const root = document.documentElement;
	const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	let current: HTMLElement | undefined;

	function publish(region: HTMLElement, force = false): void {
		if (region === current && !force) return;
		current = region;
		// Every value is read before any is written. Reading a computed style
		// after writing to <html> recomputes the whole document, and the old
		// read-write-read of eight properties did that eight times over: long
		// tasks of a second and more at 4x CPU on every change of channel, and
		// a slow scroll that skipped a channel because the advance's lock timed
		// out inside one. A region carries its colours inline, so they are
		// read from there, which computes nothing at all; the computed style is
		// only asked for what is not.
		let cs: CSSStyleDeclaration | null = null;
		const values = VARS.map((name) => {
			const inline = region.style.getPropertyValue(name).trim();
			if (inline) return [name, inline] as const;
			cs ??= getComputedStyle(region);
			return [name, cs.getPropertyValue(name).trim()] as const;
		});
		for (const [name, value] of values) if (value) root.style.setProperty(name, value);
		// The browser's own chrome follows too, so on a phone the address bar
		// changes channel with the page.
		const field = values.find(([name]) => name === '--field')?.[1];
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

	// A region can change channel while you look at it -- the programme guide
	// retunes its whole screen to the programme in focus. It announces that
	// with this event, and if it is the region on screen the chrome follows.
	document.addEventListener('channel:update', (ev) => {
		const region = ev.target;
		if (region instanceof HTMLElement && region === current) publish(region, true);
	});
}
