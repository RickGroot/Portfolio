/**
 * Zapping: what changing channel looks like on the one-pager.
 *
 * The section advance (sections.ts) announces every move with `section:enter`
 * on the section it is moving to. This answers it with the three things a
 * television does when you change channel:
 *
 *   - a flicker of static with a bar rolling through it, in the direction you
 *     are travelling -- one rise and fall per change, never a strobe;
 *   - the channel readout in the corner: number and name, flickering on, gone
 *     again after a couple of seconds;
 *   - the new channel's headline decoding out of noise as it lands.
 *
 * The guide changes channel too, every time the programme in focus changes,
 * and asks for a lighter burst of the same static with `channel:zap`.
 * Changing page is the third: that static belongs to the view transition, in
 * CSS (zap.css, .vt-static), because a page that is leaving cannot run a
 * script over the one arriving.
 *
 * Everything is a Web Animation or the shared loop (via decode), so there is
 * no second animation loop. The section advance is off under reduced motion,
 * and the guide asks for nothing there, so none of this ever runs there. All
 * of it is decoration and aria-hidden: the headings are the truth, and focus
 * already moves with the view.
 */
import { decode } from '../lib/decode';

/** How long the readout stays up after a change. */
const OSD_MS = 2200;
/** The static burst. With the section advance's lock, never more than two a second. */
const ZAP_MS = 520;

/**
 * A change of programme in the guide: the same static at under half the
 * strength and half the length, with no roll bar. A pointer sweeping down the
 * guide changes programme on every block it crosses, so a light burst is
 * dropped while another is still on screen: at most one every ZAP_MS, whatever
 * the pointer does, and never a strobe.
 */
const LIGHT_MS = 280;

type Strength = 'full' | 'light';

function make(tag: string, className: string): HTMLElement {
	const el = document.createElement(tag);
	el.className = className;
	return el;
}

export function boot(): void {
	const sections = [...document.querySelectorAll<HTMLElement>('[data-section]')];
	if (sections.length < 2) return;

	const zap = make('div', 'zap');
	const noise = make('i', 'zap__noise');
	const bar = make('i', 'zap__bar');
	zap.append(noise, bar);

	const osd = make('div', 'osd');
	const num = make('span', 'osd__num');
	const name = make('span', 'osd__name');
	osd.append(num, name);

	for (const el of [zap, osd]) {
		el.setAttribute('aria-hidden', 'true');
		document.body.append(el);
	}

	let hideTimer = 0;
	let lastBurst = Number.NEGATIVE_INFINITY;

	function burst(strength: Strength, down: boolean): void {
		const now = performance.now();
		// A full burst always plays, over whatever is running. A light one never
		// interrupts: it waits its turn, and a turn missed is simply dropped.
		if (strength === 'light' && now - lastBurst < ZAP_MS) return;
		lastBurst = now;
		const full = strength === 'full';
		const duration = full ? ZAP_MS : LIGHT_MS;

		for (const el of [zap, noise, bar]) el.getAnimations().forEach((a) => a.cancel());
		zap.animate(
			full
				? [
						{ opacity: 0 },
						{ opacity: 0.4, offset: 0.12 },
						{ opacity: 0.28, offset: 0.6 },
						{ opacity: 0 },
					]
				: [{ opacity: 0 }, { opacity: 0.16, offset: 0.2 }, { opacity: 0 }],
			{ duration, easing: 'linear' },
		);
		// The texture jumps between offsets, which is what makes still noise
		// read as live static without redrawing it.
		noise.animate(
			[
				{ transform: 'translate(0, 0)' },
				{ transform: 'translate(-37px, 21px)' },
				{ transform: 'translate(23px, -44px)' },
				{ transform: 'translate(-12px, 56px)' },
				{ transform: 'translate(48px, 9px)' },
				{ transform: 'translate(-51px, -30px)' },
			],
			{ duration, easing: 'steps(6, end)' },
		);
		if (!full) return;
		bar.animate(
			[
				{ transform: `translateY(${down ? 122 : -22}vh)` },
				{ transform: `translateY(${down ? -22 : 122}vh)` },
			],
			{ duration, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
		);
	}

	document.addEventListener('channel:zap', (ev) => {
		burst('light', (ev as CustomEvent<{ dir: number }>).detail.dir > 0);
	});

	document.addEventListener('section:enter', (ev) => {
		const section = ev.target;
		if (!(section instanceof HTMLElement)) return;
		const from = (ev as CustomEvent<{ from: 'above' | 'below' }>).detail.from;

		// ---- the static
		burst('full', from === 'above');

		// ---- the readout
		num.textContent = String(sections.indexOf(section) + 1).padStart(2, '0');
		name.textContent = section.dataset.osd ?? '';
		osd.getAnimations().forEach((a) => a.cancel());
		osd.animate(
			[
				{ opacity: 0, easing: 'steps(1, end)' },
				{ opacity: 1, offset: 0.25, easing: 'steps(1, end)' },
				{ opacity: 0.3, offset: 0.4, easing: 'steps(1, end)' },
				{ opacity: 1, offset: 0.55 },
				{ opacity: 1 },
			],
			{ duration: 360, fill: 'forwards' },
		);
		decode(name, { duration: 420, label: false });
		window.clearTimeout(hideTimer);
		hideTimer = window.setTimeout(() => {
			osd.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: 'forwards' });
		}, OSD_MS);

		// ---- the headline, landing
		// A beat late, so it resolves as the section arrives rather than while
		// it is still off screen. A guide preview that is not the one in focus
		// is invisible, so it is left alone.
		window.setTimeout(() => {
			for (const el of section.querySelectorAll<HTMLElement>('[data-decode]')) {
				if (el.closest('[data-preview]:not([data-active])')) continue;
				decode(el);
			}
		}, 160);
	});
}
