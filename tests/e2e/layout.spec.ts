import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * The hero bleeds the full viewport width so the character field can fill it.
 * That made its copy re-centre in the viewport rather than align to the page
 * column, leaving the h1 221px right of every heading below it -- obvious on
 * screen, invisible to every other test we had.
 */
test('the hero copy aligns to the same column as the rest of the page', async ({ page }) => {
	await page.goto('/');

	const left = async (selector: string): Promise<number> =>
		(await page.locator(selector).first().boundingBox())?.x ?? -1;

	// The column itself. <main> is full width on a page of bands and the page
	// has no footer, so a probe that is nothing but .wrap measures it.
	const main = await page.evaluate(() => {
		const probe = document.createElement('div');
		probe.className = 'wrap';
		document.body.append(probe);
		const x = probe.getBoundingClientRect().left;
		probe.remove();
		return x;
	});
	const h1 = await left('.hero__copy h1');
	const lede = await left('.hero .lede');
	// The guide's content column.
	const work = await left('#work .guide__inner');
	// Also the content column: the section's '04' index marker sits before the
	// heading, so the h2 itself is inset by design.
	const contact = await left('#contact .section__inner');

	for (const [name, x] of [
		['hero h1', h1],
		['hero lede', lede],
		['Work guide column', work],
		['Contact', contact],
	] as const) {
		expect(
			Math.abs(x - main),
			`${name} is ${Math.round(x - main)}px off the page column`,
		).toBeLessThan(2);
	}
});

/**
 * <main> takes focus from the skip link. Ringing it drew a 2px box around the
 * whole page. The ring is suppressed for that one element only -- focus must
 * still move, and real controls must still be ringed.
 */
test.describe('skip link', () => {
	test('moves focus to main without ringing the entire page', async ({ page }) => {
		await page.goto('/');

		await page.keyboard.press('Tab');
		const skipFocused = await page.evaluate(
			() => document.activeElement?.className === 'skip-link',
		);
		expect(skipFocused, 'the skip link is not the first tab stop').toBe(true);

		// It must actually be visible once focused, not merely present.
		// Polled, because it slides in over --speed: measuring at t=0 catches it
		// still at translateY(-200%) and says nothing about whether it arrives.
		await expect
			.poll(async () => (await page.locator('.skip-link').boundingBox())?.y ?? -999, {
				message: 'the focused skip link never came on screen',
			})
			.toBeGreaterThanOrEqual(0);

		await page.keyboard.press('Enter');

		const after = await page.evaluate(() => {
			const main = document.querySelector('main#main');
			return {
				focusMoved: document.activeElement === main,
				mainOutline: main ? getComputedStyle(main).outlineStyle : 'missing',
			};
		});

		expect(after.focusMoved, 'the skip link did not move focus to main').toBe(true);
		expect(after.mainOutline, 'main should not draw a page-sized focus ring').toBe('none');
	});

	test('real controls still show a focus ring', async ({ page }) => {
		await page.goto('/');
		// Suppressing the ring on the skip destination must not leak to anything
		// a user can actually operate.
		for (const selector of ['#work [data-block]', '#contact a']) {
			const style = await page
				.locator(selector)
				.first()
				.evaluate((el) => {
					(el as HTMLElement).focus();
					const cs = getComputedStyle(el);
					return { style: cs.outlineStyle, width: cs.outlineWidth };
				});
			expect(style.style, `${selector} lost its focus ring`).not.toBe('none');
			expect(parseFloat(style.width), `${selector} focus ring has no width`).toBeGreaterThan(0);
		}
	});
});

/**
 * A display title that does not fit its column does not overflow -- the reset
 * sets `overflow-wrap: break-word` on headings, which is right for prose and
 * silently splits a word in half at display sizes. It shipped as
 * "CHROMECA / ST" at 1715px wide and nothing failed, because nothing was
 * looking. This measures the longest word against the box it has to live in.
 */
test.describe('display titles fit their column', () => {
	const VIEWS = [
		{ w: 1920, h: 1080 },
		{ w: 1715, h: 1265 },
		{ w: 1440, h: 900 },
		{ w: 1280, h: 720 },
		{ w: 1024, h: 768 },
		{ w: 820, h: 1180 },
		{ w: 390, h: 844 },
	];

	const offenders = (page: Page, selector: string) =>
		page.evaluate((sel) => {
			const bad: string[] = [];
			for (const el of document.querySelectorAll<HTMLElement>(sel)) {
				const cs = getComputedStyle(el);
				const probe = document.createElement('span');
				probe.style.cssText =
					`position:absolute;visibility:hidden;white-space:nowrap;` +
					`font:${cs.font};letter-spacing:${cs.letterSpacing};text-transform:${cs.textTransform};`;
				document.body.append(probe);
				let widest = 0;
				let word = '';
				for (const w of (el.textContent ?? '').trim().split(/\s+/)) {
					probe.textContent = w;
					const ww = probe.getBoundingClientRect().width;
					if (ww > widest) {
						widest = ww;
						word = w;
					}
				}
				probe.remove();
				const box = el.getBoundingClientRect().width;
				// One pixel of slack: sub-pixel metrics differ between the probe
				// and the real line box.
				if (widest > box + 1) {
					bad.push(`"${word}" needs ${Math.round(widest)}px in a ${Math.round(box)}px box`);
				}
			}
			return bad;
		}, selector);

	for (const v of VIEWS) {
		test(`${v.w}x${v.h}: no title breaks mid-word`, async ({ page }) => {
			await page.setViewportSize({ width: v.w, height: v.h });

			await page.goto('/');
			expect(await offenders(page, '.guide__title'), `one-pager at ${v.w}px`).toEqual([]);

			for (const slug of ['nlziet', 'chromecast', 'vamp', 'kijk', 'nos', 'streamz-vtm-go']) {
				await page.goto(`/work/${slug}`);
				expect(await offenders(page, 'h1'), `/work/${slug} at ${v.w}px`).toEqual([]);
			}
		});
	}
});
