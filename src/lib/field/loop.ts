/**
 * The one requestAnimationFrame loop on the site.
 *
 * Everything that needs a frame subscribes here. This is the ONLY module
 * permitted to call requestAnimationFrame -- `eslint.config.js` enforces that
 * with `no-restricted-globals` everywhere else, because a comment is not a
 * control.
 *
 * The loop stops entirely when the last subscriber leaves or the tab is hidden.
 * It does not idle; there is no permanent background loop on this site.
 *
 * Two kinds of work subscribe. Transient work -- a decode, half a second of
 * it -- runs every frame: it is short, and it is what the visitor is looking
 * at. Ambient work -- the 1-bit print's life, the masthead's tracker, and
 * until 2026-10-14 the character field -- runs at the rate the machine can
 * afford, and holds still while the page changes channel. On a CPU slowed four
 * times the field at 60fps kept the main thread 99% busy, and a wheel or a
 * PageDown waited behind it (2026-09-29).
 *
 * It lives in src/lib/field/ for the field it was written for; it is the
 * site's loop now, and moving it would only churn every import.
 */

export type Tick = (now: number, dtMs: number) => void;

export interface SubscribeOptions {
	/** Runs at the rate the frames can afford, and holds during a channel change. */
	ambient?: boolean | undefined;
}

interface Subscriber {
	tick: Tick;
	ambient: boolean;
	/** When it last ran. Its dt is its own: at 30fps a frame's dt is half of it. */
	last: number;
}

const subscribers = new Set<Subscriber>();

/** 60fps, and no faster. It was 30: on screen the character field's roll
 *  stepped at 30, and Rick asked for smooth (2026-09-24). The cap still
 *  matters on a 120Hz display, which would otherwise double the work. */
const TARGET_FPS = 60;
const INTERVAL = 1000 / TARGET_FPS;
/**
 * Frame timestamps on a 60Hz display land either side of 16.67ms. Without some
 * slack, the ones that land a hair early are skipped and the loop runs at a
 * ragged 30-60.
 */
const SLACK_MS = 1.5;

/**
 * The rates ambient work steps through, fastest first, and how much of each
 * one's interval its frames may take of the main thread -- style, layout and
 * paint included -- before it steps down. At 60fps most of a frame: the step
 * costs smoothness, and smooth is what Rick asked for. At 30 half, so input
 * gets the other half. It steps back up once its frames would fit the faster
 * rate with a fifth to spare, and have for three seconds, so it does not hunt.
 */
const TIERS = [
	{ fps: 60, share: 0.75 },
	{ fps: 30, share: 0.5 },
	{ fps: 20, share: 1 },
] as const;
const UP_MARGIN = 0.8;
const DOWN_AFTER_MS = 1000;
const UP_AFTER_MS = 3000;

let handle: number | null = null;
let last = 0;
let listening = false;

let tier = 0;
let tierSince = 0;
let ambientAt = 0;
let heldUntil = 0;
/** Main-thread cost of a frame with ambient work in it, ms, smoothed. */
let cost = 0;
/** The frame being timed, by its start; 0 when none is. */
let timing = 0;
let port: MessagePort | null = null;

/**
 * Test seam: a page that sets `window.__steadyLoop = true` before this runs
 * keeps ambient work at 60fps. The rate tests count renders, and eight
 * browsers sharing one CPU would otherwise step it down under them.
 */
const steady = (): boolean => (globalThis as { __steadyLoop?: boolean }).__steadyLoop === true;

const rateOf = (t: number): number => TIERS[t]?.fps ?? TARGET_FPS;

function adapt(now: number): void {
	const here = TIERS[tier];
	const faster = TIERS[tier - 1];
	if (here && tier < TIERS.length - 1 && cost > (1000 / here.fps) * here.share) {
		if (now - tierSince > DOWN_AFTER_MS) {
			tier += 1;
			tierSince = now;
		}
	} else if (faster && cost < (1000 / faster.fps) * faster.share * UP_MARGIN) {
		if (now - tierSince > UP_AFTER_MS) {
			tier -= 1;
			tierSince = now;
		}
	}
}

/**
 * Times the frame that started at `start`, to the end of its rendering. A
 * message posted from a frame callback is handled after the frame's style,
 * layout and paint, so the difference is what the frame cost the main thread,
 * not only the script's share of it.
 */
function time(start: number): void {
	if (timing || typeof MessageChannel === 'undefined') return;
	if (!port) {
		const channel = new MessageChannel();
		channel.port2.onmessage = () => {
			const now = performance.now();
			const took = now - timing;
			timing = 0;
			cost = cost === 0 ? took : cost + (took - cost) * 0.2;
			adapt(now);
		};
		port = channel.port1;
	}
	timing = start;
	port.postMessage(null);
}

function frame(now: number): void {
	handle = requestAnimationFrame(frame);

	const dt = now - last;
	if (dt < INTERVAL - SLACK_MS) return;
	// Keep the phase rather than snapping to `now`, so cadence stays even. A
	// frame let in by the slack is not a full interval late: take it as on time.
	last = dt >= INTERVAL ? now - (dt % INTERVAL) : now;

	const rate = steady() ? TARGET_FPS : rateOf(tier);
	const ambientDue = now >= heldUntil && now - ambientAt >= 1000 / rate - SLACK_MS;
	let worked = false;
	for (const s of subscribers) {
		if (s.ambient) {
			if (!ambientDue) continue;
			worked = true;
		}
		const own = now - s.last;
		s.last = now;
		s.tick(now, own);
	}
	if (worked) {
		ambientAt = now;
		if (!steady()) time(now);
	}
}

function start(): void {
	if (handle !== null || subscribers.size === 0) return;
	if (typeof document !== 'undefined' && document.hidden) return;
	last = performance.now();
	handle = requestAnimationFrame(frame);
}

function stop(): void {
	if (handle === null) return;
	cancelAnimationFrame(handle);
	handle = null;
}

function onVisibility(): void {
	if (document.hidden) stop();
	else start();
}

/** Subscribe to the loop. Returns an unsubscribe function. */
export function subscribe(tick: Tick, options: SubscribeOptions = {}): () => void {
	const s: Subscriber = { tick, ambient: options.ambient === true, last: performance.now() };
	subscribers.add(s);

	if (!listening && typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibility);
		listening = true;
	}
	start();

	return () => {
		subscribers.delete(s);
		if (subscribers.size === 0) {
			stop();
			if (listening) {
				document.removeEventListener('visibilitychange', onVisibility);
				listening = false;
			}
		}
	};
}

/**
 * Ambient work holds still for `ms`: the page is changing channel, and the
 * scroll and the static need the frames. Transient work carries on.
 */
export function hold(ms: number): void {
	heldUntil = Math.max(heldUntil, performance.now() + ms);
}

/** Test seam: is the loop currently scheduled? */
export const isRunning = (): boolean => handle !== null;

/** Test seam: the rate ambient work runs at now. */
export const ambientRate = (): number => (steady() ? TARGET_FPS : rateOf(tier));
