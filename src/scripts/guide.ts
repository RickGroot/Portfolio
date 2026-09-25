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
 *   - Only the programmes on screen count. The first three show; the rest
 *     wait behind Load more (a native <details>), and until it is opened
 *     scrolling and the arrow keys pass them by. The arrow keys stop on Load
 *     more itself, and opening it hands focus to the first new programme.
 *   - NOW is moved to today, and a clock shows the visitor's own time -- real
 *     state, the one piece of chrome a TV guide always has.
 *
 * Changing programme is changing channel, and looks like it: the old
 * listing slides away and the new one rolls in from the direction you are
 * going, the picture jumps like a set losing vertical hold under a burst of
 * static, the new channel's colour wipes down the screen in scanline steps,
 * and the title decodes out of noise.
 *
 * No animation loop of its own: every one of those is a short Web Animation,
 * the title decode borrows the site's one loop for half a second, and the clock
 * is a timeout that fires once a minute.
 */
import { decode } from '../lib/decode';

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
	const order = blocks.map((b) => b.dataset.block);

	/* ---- the rest of the listings ------------------------------------------ */

	const more = guide.querySelector<HTMLDetailsElement>('[data-guide-more]');
	const moreToggle = more?.querySelector<HTMLElement>('summary') ?? null;

	/** The programmes on screen: not the ones still waiting behind Load more. */
	const shown = (): HTMLAnchorElement[] => blocks.filter((b) => !b.closest('details:not([open])'));

	// Opened from the button, focus goes to the first new programme: the
	// button itself is gone, and the keyboard must not be left on nothing.
	// Not when find-in-page opens it, which should not move anything.
	let openedByHand = false;
	moreToggle?.addEventListener('click', () => {
		openedByHand = true;
	});
	more?.addEventListener('toggle', () => {
		if (!more.open || !openedByHand) return;
		openedByHand = false;
		more.querySelector<HTMLAnchorElement>('[data-block]')?.focus({ preventScroll: true });
	});

	/* ---- the colour wipe ---------------------------------------------------- */

	// The new channel's ground comes in as a wipe over the old one, so the
	// section's own background changes only once the wipe has covered it. A
	// change arriving mid-wipe finishes the last one first.
	const wipe = guide.querySelector<HTMLElement>('[data-guide-wipe]');
	let wiping: { animation: Animation; field: string } | null = null;

	function commitField(field: string): void {
		guide.style.setProperty('--field', field);
		guide.dispatchEvent(new CustomEvent('channel:update', { bubbles: true }));
	}

	function retuneGround(field: string, dir: number): void {
		if (wiping) {
			wiping.animation.cancel();
			commitField(wiping.field);
			wiping = null;
		}
		if (!wipe || reduced.matches) {
			commitField(field);
			return;
		}
		wipe.style.background = field;
		const animation = wipe.animate(
			[
				{ clipPath: dir > 0 ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)', opacity: 1 },
				{ clipPath: 'inset(0 0 0 0)', opacity: 1 },
			],
			{ duration: 380, easing: 'steps(8, end)', fill: 'forwards' },
		);
		wiping = { animation, field };
		animation.onfinish = () => {
			if (wiping?.animation !== animation) return;
			commitField(field);
			animation.cancel();
			wiping = null;
		};
	}

	/* ---- changing programme ------------------------------------------------- */

	function activate(id: string | undefined): void {
		if (!id || id === active) return;
		const preview = previews.get(id);
		// The strip under a case study has no previews: the page it is on stays
		// lit, and hover is plain CSS.
		if (!preview) return;

		const previous = previews.get(active);
		const dir = Math.sign(order.indexOf(id) - order.indexOf(active)) || 1;
		previous?.removeAttribute('data-active');
		preview.setAttribute('data-active', '');
		for (const b of blocks) b.toggleAttribute('data-focus', b.dataset.block === id);
		active = id;

		// Retune the whole screen to the programme's channel. The preview
		// carries that channel's colours inline, so they are copied rather than
		// recomputed; the ground itself arrives with the wipe, and channel.ts is
		// told when it lands so the page chrome follows.
		for (const name of CHANNEL_VARS) {
			if (name === '--field') continue;
			const value = preview.style.getPropertyValue(name);
			if (value) guide.style.setProperty(name, value);
		}
		if (preview.dataset.tone) guide.dataset.channel = preview.dataset.tone;
		retuneGround(preview.style.getPropertyValue('--field'), dir);

		if (reduced.matches) return;

		// The whole screen gets a lighter burst of the section advance's static.
		// zap.ts rations it, so a pointer sweeping the guide cannot strobe.
		guide.dispatchEvent(new CustomEvent('channel:zap', { bubbles: true, detail: { dir } }));

		// The listing: out the way you are going, in from where you are going.
		// Added onto the depth layer's own transform rather than replacing it.
		previous
			?.querySelector('.guide__info')
			?.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-dir * 18}px)` }], {
				duration: 200,
				easing: 'ease-in',
				composite: 'add',
			});
		preview
			.querySelector('.guide__info')
			?.animate([{ transform: `translateY(${dir * 28}px)` }, { transform: 'translateY(0)' }], {
				duration: 380,
				easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
				composite: 'add',
			});

		// The picture: a burst of static, and a roll like a set losing
		// vertical hold before it locks.
		preview
			.querySelector('[data-guide-static]')
			?.animate([{ opacity: 0.95 }, { opacity: 0.55 }, { opacity: 0.8 }, { opacity: 0 }], {
				duration: 260,
				easing: 'steps(4, end)',
			});
		preview
			.querySelector('.guide__screen img')
			?.animate(
				[
					{ transform: `translateY(${dir * 10}%)` },
					{ transform: `translateY(${-dir * 3}%)`, offset: 0.55 },
					{ transform: 'translateY(0)' },
				],
				{ duration: 300, easing: 'steps(5, end)', composite: 'add' },
			);

		decode(preview.querySelector<HTMLElement>('[data-decode]'));
	}

	// Only a pointer that actually moved picks a programme. With pointerenter,
	// a block that scrolled under a pointer standing still changed the
	// programme: every section advance past the guide swept its rows under the
	// cursor and retuned the screen on the way through. The position is
	// compared rather than movementX/Y, which some synthetic input leaves at 0.
	let lastX = Number.NaN;
	let lastY = Number.NaN;
	let moved = false;
	window.addEventListener(
		'pointermove',
		(ev) => {
			moved = ev.clientX !== lastX || ev.clientY !== lastY;
			lastX = ev.clientX;
			lastY = ev.clientY;
		},
		{ capture: true, passive: true },
	);

	for (const block of blocks) {
		block.addEventListener('pointermove', () => {
			if (moved) activate(block.dataset.block);
		});
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
		const ids = shown().map((b) => b.dataset.block);
		const next = ids[ids.indexOf(active) + dir];
		// Past the first or last programme on screen: leave the step to the page.
		if (!next) return;
		ev.preventDefault();
		stepTo(next);
	});

	guide.addEventListener('section:enter', (ev) => {
		const from = (ev as CustomEvent<{ from: 'above' | 'below' }>).detail.from;
		const on = shown();
		stepTo((from === 'below' ? on[on.length - 1] : on[0])?.dataset.block);
	});

	guide.addEventListener('keydown', (ev) => {
		if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
		if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
		// The programmes on screen, then Load more while it is still closed.
		const stops: HTMLElement[] = shown();
		if (more && !more.open && moreToggle) stops.push(moreToggle);
		const i = stops.indexOf(document.activeElement as HTMLElement);
		if (i < 0) return;
		const next = stops[ev.key === 'ArrowDown' ? i + 1 : i - 1];
		// Off the end of the guide: leave the key for the section advance.
		if (!next) return;
		ev.preventDefault();
		next.focus();
	});
}

export function boot(): void {
	for (const guide of document.querySelectorAll<HTMLElement>('[data-guide]')) mount(guide);
}
