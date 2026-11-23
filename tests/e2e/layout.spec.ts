import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

/**
 * Every section's content column is the page's. The hero bleeds the full
 * viewport width so the character field can fill it, and once made its copy
 * re-centre in the viewport, leaving the h1 221px right of every heading below
 * it -- obvious on screen, invisible to every other test we had. The masthead
 * is left out on purpose: since 2026-10-14 it is two columns either side of the
 * page's centre line, copy and screen, not a column of its own.
 */
test('the sections align to the same column as the rest of the page', async ({ page }) => {
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
	// The guide's content column.
	const work = await left('#work .guide__inner');
	// Also the content column: the section's '04' index marker sits before the
	// heading, so the h2 itself is inset by design.
	const contact = await left('#contact .section__inner');

	for (const [name, x] of [
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
 * The name is one line (Rick, 2026-09-25: "Please make my name over 1 line"),
 * now as the masthead's title. Its size is what holds it there, not `nowrap`,
 * which cut it off at 200% text: a size too big for its column wraps it, and
 * this looks for that, from a small phone to a large screen.
 */
test('the name sits on one line in its column, from a small phone to a large screen', async ({
	page,
}) => {
	for (const size of [
		{ width: 360, height: 640 },
		{ width: 390, height: 844 },
		// Two columns at their tightest: a tablet, upright and on its side.
		{ width: 800, height: 1280 },
		{ width: 1024, height: 768 },
		{ width: 1280, height: 720 },
		{ width: 1440, height: 900 },
		{ width: 2560, height: 1440 },
	]) {
		await page.setViewportSize(size);
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		// The landing decode holds each letter in a box its own width, and a
		// wider noise glyph spills out of it for a frame: 52px at 2560 wide.
		// Measure the name, not the noise; see the next test for the timing.
		await page.waitForTimeout(900);
		await expect(page.locator('#top h1 .decode-ch')).toHaveCount(0);
		const m = await page.evaluate(() => {
			const h1 = document.querySelector('#top h1')!;
			const range = document.createRange();
			range.selectNodeContents(h1);
			const rects = [...range.getClientRects()].filter((r) => r.width > 1);
			const text = range.getBoundingClientRect();
			const box = document.querySelector('.hero__copy')!.getBoundingClientRect();
			return {
				lines: new Set(rects.map((r) => Math.round(r.top))).size,
				inside: text.left >= box.left - 0.5 && text.right <= box.right + 0.5,
			};
		});
		expect(m.lines, `${size.width}x${size.height}: the name wrapped`).toBe(1);
		expect(m.inside, `${size.width}x${size.height}: the name runs out of its column`).toBe(true);
	}
});

/**
 * The section rail is fixed at the right edge, over everything. The other
 * sections keep their content in the page column, well inside it; the
 * masthead's screen runs to the gutter, and there the rail sat on its border
 * (1440x900, 2026-10-14), which no test could see.
 */
test('the section rail stands clear of the masthead', async ({ page }) => {
	for (const size of [
		{ width: 800, height: 600 },
		{ width: 1024, height: 768 },
		{ width: 1440, height: 900 },
		{ width: 2560, height: 1440 },
	]) {
		await page.setViewportSize(size);
		await page.goto('/');
		await expect(page.locator('.rail')).toBeVisible();
		const gap = await page.evaluate(() => {
			const rail = document.querySelector('.rail')!.getBoundingClientRect().left;
			const right = Math.max(
				...['.hero__screen', '.hero__track'].map(
					(s) => document.querySelector(s)!.getBoundingClientRect().right,
				),
			);
			return Math.round(rail - right);
		});
		expect(gap, `${size.width}x${size.height}: the rail is ${gap}px clear`).toBeGreaterThanOrEqual(
			8,
		);
	}
});

/**
 * WCAG 1.4.4: text resized to 200% loses nothing. The browser's text size
 * doubles the root font size, and so does this. The name may take a second
 * line there; what it may not do is run off the screen, as it did under
 * `nowrap` on a phone.
 *
 * Not under reduced motion: there every property change is a 0.01ms
 * transition, and headless Chromium sometimes draws no frame until the
 * pointer moves, so the new size never arrived and this passed on the bug.
 * The decode is let finish instead, since it holds each letter in a box
 * measured at the old size.
 */
test('at 200% text the whole name stays on the screen', async ({ page }) => {
	for (const size of [
		{ width: 360, height: 640 },
		{ width: 390, height: 844 },
		{ width: 1280, height: 720 },
		{ width: 1440, height: 900 },
	]) {
		await page.setViewportSize(size);
		await page.goto('/');
		await page.evaluate(() => document.fonts.ready);
		// The landing decode starts 160ms after the channel comes up and runs
		// 560ms; one that started after a check for it would still be running.
		await page.waitForTimeout(900);
		await expect(page.locator('#top h1 .decode-ch')).toHaveCount(0);
		await page.evaluate(() => {
			document.documentElement.style.fontSize = '200%';
		});
		await expect
			.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize))
			.toBe('32px');
		const onScreen = await page.evaluate(() => {
			const h1 = document.querySelector('#top h1')!;
			const range = document.createRange();
			range.selectNodeContents(h1);
			const text = range.getBoundingClientRect();
			return text.left >= 0 && text.right <= document.documentElement.clientWidth + 0.5;
		});
		expect(onScreen, `${size.width}x${size.height} at 200%: the name runs off the screen`).toBe(
			true,
		);
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
		// a user can actually operate. The ring is the control's own or drawn
		// inside it: a social link rings its plate (SocialLinks.astro).
		for (const selector of ['#work [data-block]', '#contact a']) {
			const style = await page
				.locator(selector)
				.first()
				.evaluate((el) => {
					(el as HTMLElement).focus();
					const cs = [el, ...el.querySelectorAll('*')]
						.map((n) => getComputedStyle(n))
						.find((s) => s.outlineStyle !== 'none');
					return { style: cs?.outlineStyle ?? 'none', width: cs?.outlineWidth ?? '0px' };
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
