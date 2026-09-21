/**
 * Entry point for the character field.
 *
 * Everything expensive lives behind a dynamic import, and the gates run BEFORE
 * it — so a visitor who will never see the animation never downloads it.
 *
 * The <pre> already contains the fully-resolved portrait, server-rendered at
 * build time. This module only ever takes over something that is already
 * correct, which is the inverse of the usual progressive-enhancement failure
 * where the no-JS state is a broken placeholder.
 */

interface NetworkInformation {
	saveData?: boolean;
}

export function boot(): void {
	const host = document.querySelector<HTMLElement>('[data-character-field]');
	if (!host) return;

	// Reduced motion keeps the static resolved portrait. That is a different
	// composition from the animated idle state, not "the same thing minus
	// motion" -- and it is the right call: the point of the hero is the face.
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		host.dataset.fieldState = 'static';
		return;
	}

	// Don't spend a visitor's metered data on decoration.
	const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
	if (conn?.saveData) {
		host.dataset.fieldState = 'static';
		return;
	}

	// A generation counter, because the import can resolve after teardown --
	// scroll past fast enough and you would otherwise mount a dead element.
	const generation = ++current;

	void import('./field')
		.then(({ mountField }) => {
			if (generation !== current || !host.isConnected) return;
			handle = mountField(host);
		})
		.catch(() => {
			// Import failed: the static frame stands. Nothing to report.
			host.dataset.fieldState = 'static';
		});
}

let current = 0;
let handle: { destroy(): void } | null = null;

/** Test seam. Not used by the page. */
export function teardown(): void {
	current++;
	handle?.destroy();
	handle = null;
}
