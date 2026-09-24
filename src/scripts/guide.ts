/**
 * The programme guide's behaviour. Everything here is an enhancement: without
 * it every block is a link and the first programme is previewed.
 *
 *   - Focus follows the pointer and the keyboard. Hovering or tabbing to a
 *     programme previews it, and the whole screen retunes to its channel.
 *   - ArrowUp / ArrowDown move between programmes, the way a remote moves
 *     through a guide. At the first and last row the key is left alone, so the
 *     one-pager's section advance picks it up and you leave the guide.
 *   - Scrolling does the same. The section advance asks the guide first
 *     (`section:step`), so a scroll steps to the next programme, and only a
 *     scroll past the last one moves the page on. Arriving from below starts
 *     at the last programme, so scrolling back up walks back through them.
 *   - NOW is moved to today, and a clock shows the visitor's own time -- real
 *     state, the one piece of chrome a TV guide always has.
 *
 * No animation loop: the tuning burst is a short Web Animation, and the clock
 * is a timeout that fires once a minute. The one loop on this site belongs to
 * the character field.
 */

/** Everything a channel sets. Must match channelStyle() in src/lib/channels.ts. */
const CHANNEL_VARS = [
	'--field',
	'--mark',
	'--mark-dim',
	'--accent',
	'--line',
	'--line-loud',
	'--duo-hi',
	'--duo-lo',
] as const;

function yearFraction(d: Date): number {
	const year = d.getUTCFullYear();
	const start = Date.UTC(year, 0, 1);
	const end = Date.UTC(year + 1, 0, 1);
	return year + (d.getTime() - start) / (end - start);
}

const CLOCK = new Intl.DateTimeFormat('en-GB', {
	weekday: 'short',
	day: '2-digit',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
});

function mount(guide: HTMLElement): void {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	const blocks = [...guide.querySelectorAll<HTMLAnchorElement>('[data-block]')];
	const previews = new Map(
		[...guide.querySelectorAll<HTMLElement>('[data-preview]')].map((p) => [p.dataset.preview, p]),
	);

	/* ---- NOW, and the clock ------------------------------------------------ */

	// The axis was laid out at build time; only NOW moves along it.
	const start = Number(guide.dataset.guideStart);
	const end = Number(guide.dataset.guideEnd);
	if (end > start) {
		const now = (yearFraction(new Date()) - start) / (end - start);
		guide.style.setProperty('--now', Math.min(1, Math.max(0, now)).toFixed(4));
	}

	const clock = guide.querySelector<HTMLElement>('[data-guide-clock]');
	if (clock) {
		const tick = (): void => {
			// Uppercase in CSS; Intl joins the parts with a comma this drops.
			clock.textContent = CLOCK.format(new Date()).replace(',', ' ·');
			clock.hidden = false;
			window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
		};
		tick();
	}

	/* ---- focus follows the pointer and the keyboard ------------------------ */

	let active = blocks.find((b) => 'focus' in b.dataset)?.dataset.block;

	function activate(id: string | undefined): void {
		if (!id || id === active) return;
		const preview = previews.get(id);
		// The strip under a case study has no previews: the page it is on stays
		// lit, and hover is plain CSS.
		if (!preview) return;

		previews.get(active)?.removeAttribute('data-active');
		preview.setAttribute('data-active', '');
		for (const b of blocks) b.toggleAttribute('data-focus', b.dataset.block === id);
		active = id;

		// Retune the whole screen to the programme's channel. The preview
		// carries that channel's colours inline, so they are copied rather than
		// recomputed, and channel.ts is told so the page chrome follows.
		for (const name of CHANNEL_VARS) {
			const value = preview.style.getPropertyValue(name);
			if (value) guide.style.setProperty(name, value);
		}
		if (preview.dataset.tone) guide.dataset.channel = preview.dataset.tone;
		guide.dispatchEvent(new CustomEvent('channel:update', { bubbles: true }));

		// A burst of static as the screen changes channel. Opacity only.
		const staticLayer = preview.querySelector<HTMLElement>('[data-guide-static]');
		if (staticLayer && !reduced.matches) {
			staticLayer.animate(
				[{ opacity: 0.95 }, { opacity: 0.55 }, { opacity: 0.8 }, { opacity: 0 }],
				{
					duration: 260,
					easing: 'steps(4, end)',
				},
			);
		}
	}

	for (const block of blocks) {
		block.addEventListener('pointerenter', () => activate(block.dataset.block));
		block.addEventListener('focus', () => activate(block.dataset.block));
	}

	// The listings draw in the first time the guide is properly on screen.
	if (!reduced.matches && 'IntersectionObserver' in window) {
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				guide.dataset.drawing = '';
			},
			{ threshold: 0.4 },
		);
		io.observe(guide);
	}

	/* ---- scrolling steps through the programmes --------------------------- */

	const order = blocks.map((b) => b.dataset.block);

	/** Move to a programme -- focus too, if the keyboard is already in the guide. */
	function stepTo(id: string | undefined): void {
		const block = blocks.find((b) => b.dataset.block === id);
		if (!block) return;
		if (blocks.includes(document.activeElement as HTMLAnchorElement)) {
			block.focus({ preventScroll: true });
		} else {
			activate(id);
		}
	}

	guide.addEventListener('section:step', (ev) => {
		const dir = (ev as CustomEvent<{ dir: number }>).detail.dir;
		const next = order[order.indexOf(active) + dir];
		// Past the first or last programme: leave the step to the page.
		if (!next) return;
		ev.preventDefault();
		stepTo(next);
	});

	guide.addEventListener('section:enter', (ev) => {
		const from = (ev as CustomEvent<{ from: 'above' | 'below' }>).detail.from;
		stepTo(from === 'below' ? order[order.length - 1] : order[0]);
	});

	guide.addEventListener('keydown', (ev) => {
		if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
		if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
		const i = blocks.indexOf(document.activeElement as HTMLAnchorElement);
		if (i < 0) return;
		const next = blocks[ev.key === 'ArrowDown' ? i + 1 : i - 1];
		// Off the end of the guide: leave the key for the section advance.
		if (!next) return;
		ev.preventDefault();
		next.focus();
	});
}

export function boot(): void {
	for (const guide of document.querySelectorAll<HTMLElement>('[data-guide]')) mount(guide);
}
