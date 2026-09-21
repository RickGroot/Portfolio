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

/** 30fps deliberately. Character art has no sub-cell motion -- a glyph either
 *  changes or it does not -- so the perceptual gap to 60 is far smaller than
 *  for continuous motion, and 30 divides evenly into 60/90/120, which is what
 *  makes a stepped cadence read as intentional rather than dropped. */
const TARGET_FPS = 30;
const INTERVAL = 1000 / TARGET_FPS;

let handle: number | null = null;
let last = 0;
let listening = false;

function frame(now: number): void {
	handle = requestAnimationFrame(frame);

	const dt = now - last;
	if (dt < INTERVAL) return;
	// Keep the phase rather than snapping to `now`, so cadence stays even.
	last = now - (dt % INTERVAL);

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
