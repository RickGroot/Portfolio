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
 */

export type Tick = (now: number, dtMs: number) => void;

const subscribers = new Set<Tick>();

/** 60fps, and no faster. It was 30: a glyph either changes or it does not,
 *  so the gap to 60 looked small on paper, but on screen the field's roll and
 *  the face's shimmer stepped, and Rick asked for smooth (2026-09-24). The cap
 *  still matters on a 120Hz display, which would otherwise double the work. */
const TARGET_FPS = 60;
const INTERVAL = 1000 / TARGET_FPS;
/**
 * Frame timestamps on a 60Hz display land either side of 16.67ms. Without some
 * slack, the ones that land a hair early are skipped and the loop runs at a
 * ragged 30-60.
 */
const SLACK_MS = 1.5;

let handle: number | null = null;
let last = 0;
let listening = false;

function frame(now: number): void {
	handle = requestAnimationFrame(frame);

	const dt = now - last;
	if (dt < INTERVAL - SLACK_MS) return;
	// Keep the phase rather than snapping to `now`, so cadence stays even. A
	// frame let in by the slack is not a full interval late: take it as on time.
	last = dt >= INTERVAL ? now - (dt % INTERVAL) : now;

	for (const tick of subscribers) tick(now, dt);
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
export function subscribe(tick: Tick): () => void {
	subscribers.add(tick);

	if (!listening && typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibility);
		listening = true;
	}
	start();

	return () => {
		subscribers.delete(tick);
		if (subscribers.size === 0) {
			stop();
			if (listening) {
				document.removeEventListener('visibilitychange', onVisibility);
				listening = false;
			}
		}
	};
}

/** Test seam: is the loop currently scheduled? */
export const isRunning = (): boolean => handle !== null;
