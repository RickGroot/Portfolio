import { test, expect, type Page } from '@playwright/test';
import { guideDrawn, onGuide, pointAt } from '../support/guide';

/**
 * The programme guide as a pointer and a keyboard use it (src/scripts/guide.ts).
 *
 * Measured on 2026-09-29: the way from a programme to its own buttons crossed
 * the rows between, and the guide committed on every move, so the button under
 * the pointer ended up belonging to the programme it had passed through -- from
 * VAMP to its Live app opened NLZIET, six runs in six. Keyboard focus on one of
 * the preview's buttons dropped to <body> when the preview changed, and VAMP's
 * Live app could not be reached with Tab at all.
 */

test.use({ viewport: { width: 1440, height: 900 } });

const activePreview = (page: Page): Promise<string | undefined> =>
	page.evaluate(
		() => document.querySelector<HTMLElement>('#work [data-preview][data-active]')?.dataset.preview,
	);

// Pointing uses tests/support/guide.ts: raw moves, once the rows have drawn in.
// Where it comes to rest: a programme tunes in with its copy sliding 12px into
// place, and a button read at the start of the slide was clicked beside, or
// not, depending on how busy the machine was. Two reads 100ms apart, because
// two in the same frame agree mid-slide.
const centre = async (page: Page, selector: string): Promise<{ x: number; y: number }> => {
	const read = async (): Promise<{ x: number; y: number; width: number; height: number }> => {
		const box = await page.locator(selector).boundingBox();
		if (!box) throw new Error(`no box for ${selector}`);
		return box;
	};
	let box = await read();
	for (;;) {
		await page.waitForTimeout(100);
		const next = await read();
		if (next.x === box.x && next.y === box.y) break;
		box = next;
	}
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('on the way to its buttons, crossing another programme does not take the preview', async ({
	page,
}) => {
	await page.goto('/#work');
	await pointAt(page, 'vamp');
	await expect.poll(() => activePreview(page)).toBe('vamp');

	// Straight up and across to the preview's Case study button, over the
	// NLZIET and Chromecast rows, at the speed a hand moves a mouse.
	const button = await centre(
		page,
		'#work [data-preview="vamp"] .guide__actions a[href="/work/vamp"]',
	);
	await page.mouse.move(button.x, button.y, { steps: 12 });
	expect(await activePreview(page), 'a row the pointer only passed took the preview').toBe('vamp');

	await page.mouse.down();
	await page.mouse.up();
	await expect(page).toHaveURL(/\/work\/vamp$/);
});

test('a quick sweep over the rows retunes nothing; resting on one does', async ({ page }) => {
	await page.goto('/#work');
	// The rows draw themselves in first; sweep a guide that is standing still,
	// its colours settled too. guideDrawn waits for the draw only, and a sweep
	// begun while the arrival was still fading, under a full run's load, held
	// on a row past the rest that picks it.
	await guideDrawn(page);
	await page.waitForFunction(() =>
		[...document.querySelectorAll('#work [data-block]')].every((b) =>
			b.getAnimations().every((a) => a.playState === 'finished'),
		),
	);
	await page.evaluate(() => {
		const w = window as unknown as { __changes: number };
		w.__changes = 0;
		for (const p of document.querySelectorAll('#work [data-preview]')) {
			new MutationObserver(() => w.__changes++).observe(p, {
				attributes: true,
				attributeFilter: ['data-active'],
			});
		}
	});

	// Down across every row and off the grid, without stopping.
	const top = await centre(page, '#work [data-block="nlziet"]');
	const below = await centre(page, '#work .guide__moretoggle');
	await page.mouse.move(top.x, top.y - 60);
	await page.mouse.move(top.x, below.y + 40, { steps: 10 });
	await page.waitForTimeout(400);
	expect(
		await page.evaluate(() => (window as unknown as { __changes: number }).__changes),
		'the sweep changed programme on its way through',
	).toBe(0);
	expect(await activePreview(page)).toBe('nlziet');

	await pointAt(page, 'chromecast');
	await expect.poll(() => activePreview(page)).toBe('chromecast');
});

test('Tab goes through the programmes, then to the buttons of the one in focus', async ({
	page,
}) => {
	await page.goto('/#work');
	await page.locator('#work [data-block="vamp"]').focus();
	await expect.poll(() => activePreview(page)).toBe('vamp');

	const seen: string[] = [];
	for (let i = 0; i < 4; i++) {
		await page.keyboard.press('Tab');
		seen.push(
			await page.evaluate(() => {
				const el = document.activeElement as HTMLAnchorElement | null;
				const name = el?.getAttribute('aria-label') ?? el?.textContent?.replace(/\s+/g, ' ').trim();
				return `${name} -> ${el?.getAttribute('href')}`;
			}),
		);
	}
	expect(seen.join('\n'), "VAMP's own buttons are out of the keyboard's reach").toMatch(
		/Case study: VAMP -> \/work\/vamp[\s\S]*Live app[^\n]*: VAMP[^\n]*-> https:\/\/rickgroot\.github\.io\/vamp\//,
	);
});

test('focus on a button stays in the page when the programme changes under it', async ({
	page,
}) => {
	await page.goto('/#work');
	await page.locator('#work [data-preview="nlziet"] .guide__actions a').first().focus();

	await pointAt(page, 'chromecast');
	await expect.poll(() => activePreview(page)).toBe('chromecast');

	const focus = await page.evaluate(() => {
		const el = document.activeElement;
		return {
			inMain: !!el?.closest('main'),
			href: el?.getAttribute('href'),
		};
	});
	expect(focus.inMain, 'focus fell out of the page').toBe(true);
	expect(focus.href, 'focus did not move to the same button on the new programme').toBe(
		'/work/chromecast',
	);
});

test('the meta line breaks between its parts, not inside them', async ({ page }) => {
	await page.goto('/#work');
	const meta = await page
		.locator('#work [data-preview="nlziet"] .guide__meta')
		.evaluate((el) => el.textContent?.replace(/\s+/g, ' ').trim());
	expect(meta).toMatch(/developer \/ Hypersolid \/ Ongoing/i);
});

// A tab that draws no frames never ticks the loop: a hidden one, or a window
// the system has covered. A title decoding there stayed in noise until the tab
// was shown again; a timer now finishes it.
test('a title decode finishes in a tab that draws no frames', async ({ page }) => {
	await page.addInitScript(() => {
		window.requestAnimationFrame = () => 0;
		window.cancelAnimationFrame = () => undefined;
	});
	await page.goto('/');
	await onGuide(page);
	const title = page.locator('#work [data-preview="chromecast"] .guide__title');
	await page.locator('#work [data-block="chromecast"]').focus();
	await expect(page.locator('#work [data-preview="chromecast"]')).toHaveAttribute(
		'data-active',
		'',
	);
	await expect
		.poll(() => title.locator('.decode-ch').count(), { message: 'the decode never started' })
		.toBeGreaterThan(0);
	await expect(title.locator('.decode-ch')).toHaveCount(0, { timeout: 3000 });
	await expect(title).toHaveText(/chromecast/i);
});
