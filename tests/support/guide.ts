import { expect, type Page } from '@playwright/test';

/**
 * Pointing at the programme guide the way a hand does, for every spec that
 * needs a programme in focus.
 *
 * A pointer picks a programme once it comes to rest on it (src/scripts/
 * guide.ts), not as it passes. And the rows draw themselves in as the guide
 * arrives, one after another, growing from nothing: a move made before a
 * block has grown under the pointer lands on the lane beside it. Playwright's
 * hover() answers that by scrolling the block into view and trying again, and
 * on a page that scrolls smoothly that scroll carried on after the hover was
 * done, sliding other rows under the pointer. So: no smooth scroll, wait for
 * the draw, then a plain move.
 */

/** The guide on screen, jumped to rather than scrolled to. */
export async function onGuide(page: Page): Promise<void> {
	await page.evaluate(() => {
		const guide = document.getElementById('work');
		if (!guide) throw new Error('no programme guide on this page');
		const root = document.documentElement;
		root.style.scrollBehavior = 'auto';
		if (Math.abs(guide.getBoundingClientRect().top) > 1) guide.scrollIntoView({ block: 'start' });
		root.style.scrollBehavior = '';
	});
}

/**
 * Every row drawn in: the draw has started (guide.ts marks it once the guide
 * is on screen, just after a jump to it) and no block is still growing. Before
 * it starts there are no animations at all, and "all of them finished" was
 * true of none: the move went in ahead of the rows.
 *
 * The draw, not the colours: a change of programme fades the rows it leaves,
 * and waiting for those transitions too held every step of a sweep back by
 * the length of the fade, spacing its changes 470-530ms apart -- either side
 * of the 500ms the static is rationed to, so the test of that rationing
 * passed or failed by the millisecond.
 */
export async function guideDrawn(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const guide = document.getElementById('work');
		if (!guide) return false;
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!still && !guide.hasAttribute('data-drawing')) return false;
		return [...guide.querySelectorAll('[data-block]')].every((b) =>
			b
				.getAnimations()
				.filter((a) => a instanceof CSSAnimation)
				.every((a) => a.playState === 'finished'),
		);
	});
}

/** The pointer on a programme's block, standing still. */
export async function pointAt(page: Page, id: string): Promise<void> {
	await onGuide(page);
	await guideDrawn(page);
	const box = await page.locator(`#work [data-block="${id}"]`).boundingBox();
	if (!box) throw new Error(`the ${id} programme is not on screen`);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** Rest the pointer on a programme until it is the one in focus. */
export async function restOn(page: Page, id: string): Promise<void> {
	await pointAt(page, id);
	await expect(page.locator(`#work [data-preview="${id}"]`)).toHaveAttribute('data-active', '');
}
