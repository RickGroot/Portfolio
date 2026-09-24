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
 * Everything is a Web Animation or the shared loop (via decode), so there is
 * no second animation loop. The section advance is off under reduced motion,
 * so none of this ever runs there. All of it is decoration and aria-hidden:
 * the headings are the truth, and focus already moves with the view.
 */
import { decode } from '../lib/decode';

/** How long the readout stays up after a change. */
const OSD_MS = 2200;
/** The static burst. With the section advance's lock, never more than two a second. */
const ZAP_MS = 460;

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

	document.addEventListener('section:enter', (ev) => {
		const section = ev.target;
		if (!(section instanceof HTMLElement)) return;
		const from = (ev as CustomEvent<{ from: 'above' | 'below' }>).detail.from;
		const down = from === 'above';

		// ---- the static
		zap.getAnimations().forEach((a) => a.cancel());
		zap.animate(
			[
				{ opacity: 0 },
				{ opacity: 0.3, offset: 0.14 },
				{ opacity: 0.2, offset: 0.6 },
				{ opacity: 0 },
			],
			{ duration: ZAP_MS, easing: 'linear' },
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
			{ duration: ZAP_MS, easing: 'steps(6, end)' },
		);
		bar.animate(
			[
				{ transform: `translateY(${down ? 122 : -22}vh)` },
				{ transform: `translateY(${down ? -22 : 122}vh)` },
			],
			{ duration: ZAP_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
		);

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
