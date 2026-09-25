import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

// Document order. The rail is built from the same list in index.astro, so a
// mismatch here means a rail dot points at an id that moved.
const SECTIONS = ['top', 'work', 'interlude-signal', 'practice', 'interlude-field', 'contact'];

test.describe('one-page sections', () => {
	test('every section fills the viewport', async ({ page }) => {
		await page.goto('/');
		const heights = await page.evaluate(() =>
			[...document.querySelectorAll('[data-section]')].map((s) =>
				Math.round(s.getBoundingClientRect().height),
			),
		);
		expect(heights).toHaveLength(SECTIONS.length);
		for (const h of heights) {
			expect(h, `a section is ${h}px against an 800px viewport`).toBeGreaterThanOrEqual(798);
		}
	});

	test('sections are in narrative order with stable ids', async ({ page }) => {
		await page.goto('/');
		const ids = await page.evaluate(() =>
			[...document.querySelectorAll('[data-section]')].map((s) => s.id),
		);
		// The ids are the deep-link targets and the rail hrefs. Renaming one
		// silently breaks both.
		expect(ids).toEqual(SECTIONS);
	});

	/**
	 * The advance is scroll-jacking, which the brief rules out. It was chosen
	 * anyway, so these tests exist to prove it cannot trap anyone.
	 */
	test.describe('cannot trap the user', () => {
		test('reduced motion disables it entirely', async ({ browser }) => {
			const context = await browser.newContext({
				reducedMotion: 'reduce',
				viewport: { width: 1280, height: 800 },
			});
			const page = await context.newPage();
			await page.goto('/');

			const state = await page.evaluate(() => ({
				booted: document.documentElement.dataset.sections ?? 'off',
				behavior: getComputedStyle(document.documentElement).scrollBehavior,
			}));

			expect(state.booted, 'section jacking must not run under reduced motion').toBe('off');
			expect(state.behavior, 'smooth scrolling must not be forced').toBe('auto');

			// And the page must still be a normal, fully scrollable document.
			await page.evaluate(() => window.scrollTo(0, 99999));
			const atBottom = await page.evaluate(
				() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4,
			);
			expect(atBottom, 'the page could not be scrolled to the bottom').toBe(true);
			await context.close();
		});

		test('the whole page is still reachable by keyboard', async ({ page }) => {
			await page.goto('/');
			// End must reach the last section, whatever the advance is doing.
			await page.keyboard.press('End');
			await expect
				.poll(
					async () =>
						page.evaluate(() => {
							const el = document.getElementById('contact');
							return el ? Math.abs(Math.round(el.getBoundingClientRect().top)) : 99999;
						}),
					{ message: 'End did not land on the last section', timeout: 6000 },
				)
				.toBeLessThan(120);

			await page.keyboard.press('Home');
			await expect
				.poll(async () => page.evaluate(() => window.scrollY), {
					message: 'Home did not return to the top',
					timeout: 6000,
				})
				.toBeLessThan(120);
		});

		test('every section and every programme is reachable one press at a time', async ({ page }) => {
			await page.goto('/');

			// A fixed wait per press raced the advance script's own 620ms settle:
			// under parallel load one press landed mid-scroll, was swallowed, and
			// the walk finished a section short. Wait for the page to actually
			// stop moving instead.
			const settle = async (): Promise<void> => {
				let last = -1;
				await expect
					.poll(
						async () => {
							const y = await page.evaluate(() => Math.round(window.scrollY));
							const stable = y === last;
							last = y;
							return stable;
						},
						{ message: 'the page never stopped scrolling', timeout: 8000 },
					)
					.toBe(true);
			};

			// Where the page is: the section at the top, and on the guide, the
			// programme in focus -- the guide takes one press per programme before
			// the page moves on.
			const where = (): Promise<string> =>
				page.evaluate(() => {
					const top =
						[...document.querySelectorAll<HTMLElement>('[data-section]')]
							.map((el) => ({ id: el.id, d: Math.abs(el.getBoundingClientRect().top) }))
							.sort((a, b) => a.d - b.d)[0]?.id ?? '';
					if (top !== 'work') return top;
					const on = document.querySelector<HTMLElement>('#work [data-preview][data-active]');
					return `work:${on?.dataset.preview ?? '?'}`;
				});

			// The guide steps through the three programmes it shows; KIJK waits
			// behind Load more and is not a step until it is loaded.
			const expected = ['top', 'work:nlziet', 'work:chromecast', 'work:vamp', ...SECTIONS.slice(2)];

			await settle();
			const visited = [await where()];
			for (let i = 1; i < expected.length; i++) {
				const from = await where();
				await page.keyboard.press('PageDown');
				// The smooth scroll starts a frame or two after the key press, and
				// later under load -- so "two equal readings" alone cannot tell "has
				// not started" from "has finished", and under parallel load it
				// recorded the same section five times running. Wait for the page to
				// leave where it was first. A press that changes nothing is exactly
				// the failure this test exists to catch, so that times out loudly.
				await expect
					.poll(where, { message: `PageDown ${i} changed nothing`, timeout: 8000 })
					.not.toBe(from);
				await settle();
				visited.push(await where());
				// A step through the guide settles sooner than a scroll; wait it out
				// so the next press is not swallowed by the lock.
				await page.waitForTimeout(450);
			}

			// Stronger than "did we get to the end": one press must advance exactly
			// one step, so the walk has to name every section and every programme
			// in order.
			expect(visited, 'one press did not advance exactly one step').toEqual(expected);
		});

		// There is no footer: it only repeated the contact channel's links (Rick,
		// 2026-09-25). So the contact channel is the end of the page, and the
		// end of the page must not be a trap either way.
		test('the contact channel is the end of the page, and not a trap', async ({ page }) => {
			await page.goto('/#contact');
			await page.mouse.move(640, 400);
			expect(
				await page.evaluate(
					() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
				),
				'something is below the last channel',
			).toBe(true);

			// Down from the end is left to the browser, not taken.
			const prevented = await page.evaluate(() => {
				const ev = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true });
				document.body.dispatchEvent(ev);
				return ev.defaultPrevented;
			});
			expect(prevented, 'the wheel past the last channel was taken').toBe(false);

			// Up from it is the channel before.
			await page.mouse.wheel(0, -120);
			await expect
				.poll(
					() =>
						page.evaluate(() =>
							Math.round(
								document.getElementById('interlude-field')?.getBoundingClientRect().top ?? 9999,
							),
						),
					{ message: 'up from the last channel did not reach the one before', timeout: 6000 },
				)
				.toBe(0);
		});

		test('Ctrl + wheel is left to the browser, to zoom', async ({ page }) => {
			await page.goto('/');
			const prevented = await page.evaluate(() => {
				const ev = new WheelEvent('wheel', {
					deltaY: 120,
					ctrlKey: true,
					bubbles: true,
					cancelable: true,
				});
				document.body.dispatchEvent(ev);
				return ev.defaultPrevented;
			});
			expect(prevented, 'Ctrl + wheel was taken as a channel change').toBe(false);
		});

		test('typing in a field is never hijacked', async ({ page }) => {
			await page.goto('/');
			// There is no form on the page yet, so synthesise one: the guard must
			// hold for any future input, not just the ones that exist today.
			await page.evaluate(() => {
				const input = document.createElement('input');
				input.id = 'probe';
				document.body.append(input);
				input.focus();
			});
			// focus() scrolls the new input into view, and scroll-behavior is
			// smooth, so let that finish before sampling -- otherwise the tail of
			// the focus scroll is misread as the key press moving the page.
			// Polled rather than fixed: the document grew and a fixed wait no
			// longer covers the travel. And first until the input is actually on
			// screen: under load the focus scroll starts late, and two equal
			// readings taken before it starts looked exactly like it had finished.
			await expect
				.poll(
					() =>
						page.evaluate(() => {
							const r = document.getElementById('probe')?.getBoundingClientRect();
							return !!r && r.top >= 0 && r.bottom <= window.innerHeight;
						}),
					{ message: 'the focused input never scrolled into view', timeout: 8000 },
				)
				.toBe(true);
			let settled = -1;
			await expect
				.poll(
					async () => {
						const y = await page.evaluate(() => Math.round(window.scrollY));
						const stable = y === settled;
						settled = y;
						return stable;
					},
					{ message: 'the focus scroll never settled', timeout: 8000 },
				)
				.toBe(true);
			const before = await page.evaluate(() => window.scrollY);
			await page.keyboard.press('ArrowDown');
			await page.waitForTimeout(600);
			const after = await page.evaluate(() => window.scrollY);
			// A small native scroll is the browser's own behaviour and fine. What
			// must never happen is the script advancing a whole section while
			// someone is typing.
			expect(
				Math.abs(after - before),
				'an arrow key inside an input advanced a section',
			).toBeLessThan(200);
		});
	});

	/**
	 * Every scroll over a channel changes channel or does nothing -- it never
	 * moves the page a little. A slow trackpad scroll is a stream of tiny
	 * deltas; each was let through as drift, and the page crept past the edge.
	 */
	test.describe('the advance takes every scroll', () => {
		/** How far the nearest section's top is from the top of the screen. */
		const offBy = (page: import('@playwright/test').Page): Promise<number> =>
			page.evaluate(() =>
				Math.min(
					...[...document.querySelectorAll('[data-section]')].map((s) =>
						Math.abs(Math.round(s.getBoundingClientRect().top)),
					),
				),
			);

		test('a slow scroll changes channel rather than creeping', async ({ page }) => {
			await page.goto('/');
			await page.mouse.move(640, 400);
			for (let i = 0; i < 40; i++) {
				await page.mouse.wheel(0, 2);
				await page.waitForTimeout(16);
			}
			await page.waitForTimeout(900);
			expect(await offBy(page), 'the page stopped between two channels').toBeLessThan(2);
			expect(
				await page.evaluate(() =>
					Math.round(document.getElementById('work')?.getBoundingClientRect().top ?? 9999),
				),
				'a slow scroll did not change channel',
			).toBe(0);
		});

		test('Space pages from channel to channel, and Shift+Space back', async ({ page }) => {
			await page.goto('/');
			await page.keyboard.press('Space');
			await expect
				.poll(() =>
					page.evaluate(() =>
						Math.round(document.getElementById('work')?.getBoundingClientRect().top ?? 9999),
					),
				)
				.toBe(0);
			await page.waitForTimeout(700);
			await page.keyboard.press('Shift+Space');
			await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(0);
		});
	});

	test('the rail is real navigation, not decoration', async ({ page }) => {
		await page.goto('/');
		const hrefs = await page.evaluate(() =>
			[...document.querySelectorAll('[data-rail] a')].map((a) => a.getAttribute('href')),
		);
		expect(hrefs).toEqual(SECTIONS.map((id) => `#${id}`));

		// Each target must exist, or the rail is a set of dead links.
		for (const id of SECTIONS) {
			await expect(page.locator(`#${id}`)).toHaveCount(1);
		}

		// Every dot needs an accessible name.
		const unnamed = await page.evaluate(
			() =>
				[...document.querySelectorAll('[data-rail] a')].filter(
					(a) => !(a.textContent ?? '').trim() && !a.getAttribute('aria-label'),
				).length,
		);
		expect(unnamed, 'rail dots without an accessible name').toBe(0);
	});

	// Instantly, not eventually: the page used to glide to the fragment from the
	// top, because smooth scrolling was switched on before the browser jumped.
	// A case study's Guide link rolled the whole hero past on the way back.
	test('deep links land on the right section, instantly', async ({ page }) => {
		for (const id of ['practice', 'work']) {
			// A fresh load each time: a goto that only changes the hash is an
			// in-page jump, which is meant to be smooth.
			await page.goto('about:blank');
			await page.goto(`/#${id}`);
			const top = await page.evaluate(
				(target) =>
					Math.abs(
						Math.round(document.getElementById(target)?.getBoundingClientRect().top ?? 99999),
					),
				id,
			);
			expect(top, `/#${id} did not land on its section at load`).toBeLessThan(140);
		}
	});
});

/**
 * The programme guide: every piece of work as a programme on a TV guide.
 * Focus follows the pointer and the keyboard, the screen retunes to the
 * programme in focus, and the arrow keys move through it like a remote.
 */
test.describe('programme guide', () => {
	const active = (page: import('@playwright/test').Page) =>
		page.evaluate(() => ({
			preview: document.querySelector<HTMLElement>('#work [data-preview][data-active]')?.dataset
				.preview,
			channel: document.getElementById('work')?.dataset.channel,
			focus: document.querySelector<HTMLElement>('#work [data-block][data-focus]')?.dataset.block,
		}));

	test('lists every published programme, each linking to its own case study', async ({ page }) => {
		await page.goto('/');
		const hrefs = await page
			.locator('#work [data-block]')
			.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
		// KIJK never had a panel and still gets a programme: the guide is the
		// complete record, which the old one-pager needed a separate list for.
		expect(hrefs).toEqual(['/work/nlziet', '/work/chromecast', '/work/vamp', '/work/kijk']);
	});

	test('the preview and the channel follow the pointer and the keyboard', async ({ page }) => {
		await page.goto('/#work');
		expect(await active(page)).toEqual({ preview: 'nlziet', channel: 'crimson', focus: 'nlziet' });

		await page.locator('#work [data-block="chromecast"]').hover();
		expect(await active(page)).toEqual({
			preview: 'chromecast',
			channel: 'ultramarine',
			focus: 'chromecast',
		});

		// Keyboard parity: focus does exactly what hover does.
		await page.mouse.move(0, 0);
		await page.locator('#work [data-block="vamp"]').focus();
		expect(await active(page)).toEqual({ preview: 'vamp', channel: 'navy', focus: 'vamp' });
	});

	// Rick: "load the first 3 projects by default, and add a load more button
	// for other projects so navigation is better".
	test.describe('load more', () => {
		const shownBlocks = (page: import('@playwright/test').Page) =>
			page.evaluate(() =>
				[...document.querySelectorAll<HTMLElement>('#work [data-block]')]
					.filter((b) => b.checkVisibility())
					.map((b) => b.dataset.block),
			);

		test('the guide opens on three programmes, and loads the rest on request', async ({ page }) => {
			await page.goto('/#work');
			expect(await shownBlocks(page)).toEqual(['nlziet', 'chromecast', 'vamp']);

			const load = page.locator('#work summary', { hasText: 'Load more' });
			await expect(load).toHaveAccessibleName(/1 more programme/);
			await load.click();

			expect(await shownBlocks(page)).toEqual(['nlziet', 'chromecast', 'vamp', 'kijk']);
			// The button has done its job and goes, and focus is not left on
			// nothing: it is on the first new programme, which is previewed.
			await expect(load).toBeHidden();
			await expect
				.poll(() => page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.block))
				.toBe('kijk');
			expect(await active(page)).toEqual({ preview: 'kijk', channel: 'ink', focus: 'kijk' });
		});

		test('the arrow keys stop on Load more, and Enter loads', async ({ page }) => {
			await page.goto('/#work');
			await page.locator('#work [data-block="vamp"]').focus();
			await page.keyboard.press('ArrowDown');
			expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('SUMMARY');
			await page.keyboard.press('ArrowUp');
			expect(
				await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.block),
			).toBe('vamp');

			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('Enter');
			await expect
				.poll(() => page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.block))
				.toBe('kijk');
			// And the page did not move: loading more is not leaving the guide.
			expect(
				await page.evaluate(() =>
					Math.abs(Math.round(document.getElementById('work')?.getBoundingClientRect().top ?? 999)),
				),
			).toBeLessThan(4);
		});

		test('without JavaScript it still loads more', async ({ browser }) => {
			const context = await browser.newContext({ javaScriptEnabled: false });
			const page = await context.newPage();
			await page.goto('/#work');
			const kijk = page.locator('#work [data-block="kijk"]');
			await expect(kijk).toBeHidden();
			await page.locator('#work summary', { hasText: 'Load more' }).click();
			await expect(kijk).toBeVisible();
			await expect(kijk).toHaveAttribute('href', '/work/kijk');
			await context.close();
		});
	});

	test('arrow keys move between programmes like a remote', async ({ page }) => {
		await page.goto('/#work');
		await page.locator('#work [data-block="nlziet"]').focus();
		const focused = () =>
			page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.block);

		await page.keyboard.press('ArrowDown');
		expect(await focused()).toBe('chromecast');
		await page.keyboard.press('ArrowDown');
		expect(await focused()).toBe('vamp');
		await page.keyboard.press('ArrowUp');
		expect(await focused()).toBe('chromecast');
		// Moving through the guide is not advancing the page.
		expect(
			await page.evaluate(() =>
				Math.abs(Math.round(document.getElementById('work')?.getBoundingClientRect().top ?? 999)),
			),
		).toBeLessThan(140);
	});

	test('scrolling steps through the programmes before the page moves on', async ({ page }) => {
		await page.goto('/#work');
		await page.mouse.move(640, 60);
		const top = () =>
			page.evaluate(() =>
				Math.round(document.getElementById('work')?.getBoundingClientRect().top ?? 9999),
			);

		for (const id of ['chromecast', 'vamp']) {
			await page.mouse.wheel(0, 120);
			await expect.poll(async () => (await active(page)).preview).toBe(id);
			expect(await top(), `the page moved while stepping to ${id}`).toBe(0);
			await page.waitForTimeout(500);
		}

		// Past the last programme on screen the page moves on to the next
		// section: KIJK, behind Load more, is not a step.
		await page.mouse.wheel(0, 120);
		await expect.poll(top, { timeout: 6000 }).toBeLessThan(-400);
	});

	test('coming back up from below starts at the last programme', async ({ page }) => {
		await page.goto('/#interlude-signal');
		await page.mouse.move(640, 60);
		await page.mouse.wheel(0, -120);
		await expect
			.poll(() =>
				page.evaluate(() =>
					Math.abs(
						Math.round(document.getElementById('work')?.getBoundingClientRect().top ?? 9999),
					),
				),
			)
			.toBeLessThan(4);
		// The last programme on screen: KIJK waits behind Load more.
		expect((await active(page)).preview).toBe('vamp');

		await page.waitForTimeout(800);
		await page.mouse.wheel(0, -120);
		await expect.poll(async () => (await active(page)).preview).toBe('chromecast');
	});

	// Rick: "for NLZIET with the image now also having this color overlay it's
	// just all pink now". Key art is not printed in its channel's colours --
	// on the guide or on the case study the view transition carries it to.
	test('the key art is shown in its own colours', async ({ page }) => {
		const unprinted = (selector: string) =>
			page.locator(selector).evaluate((el) => ({
				overlay: getComputedStyle(el, '::before').content,
				filter: getComputedStyle(el.querySelector('img') as Element).filter,
			}));

		await page.goto('/#work');
		const guide = await unprinted('#work [data-preview][data-active] .guide__screen');
		expect(guide.overlay, 'guide: a print is laid over the key art').toBe('none');
		expect(guide.filter, 'guide: the key art is filtered').toBe('none');

		await page.goto('/work/nlziet');
		const study = await unprinted('.info__screen');
		expect(study.overlay, 'case study: a print is laid over the key art').toBe('none');
		expect(study.filter, 'case study: the key art is filtered').toBe('none');
	});

	// The overflow flag can be stale for a moment after a resize. On the old
	// work panels a stale flag collapsed the picture to nothing.
	test('the preview keeps its picture even while flagged as overflowing', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/#work');
		const height = await page.evaluate(() => {
			const section = document.getElementById('work');
			if (!section) return 0;
			section.dataset.overflows = '';
			return (
				section.querySelector('[data-preview][data-active] .guide__screen')?.getBoundingClientRect()
					.height ?? 0
			);
		});
		expect(height, 'the preview picture collapsed under a stale overflow flag').toBeGreaterThan(
			250,
		);
	});

	test('the decorative picture link is hidden from assistive technology', async ({ page }) => {
		await page.goto('/#work');
		// Two links to one destination is noise for a screen reader; the block
		// on the guide, and the Case study button, are the real ones.
		for (const screen of await page.locator('#work .guide__screen').all()) {
			await expect(screen).toHaveAttribute('aria-hidden', 'true');
			await expect(screen).toHaveAttribute('tabindex', '-1');
		}
	});

	test('NOW is today, not the day the site was built', async ({ page }) => {
		await page.clock.setFixedTime(new Date('2027-01-01T12:00:00Z'));
		await page.goto('/#work');
		const now = await page.evaluate(() =>
			Number(
				getComputedStyle(document.getElementById('work') as HTMLElement).getPropertyValue('--now'),
			),
		);
		// Built in 2026: by 2027 the line has moved on, and it never leaves the axis.
		const built = await page.evaluate(() => {
			const el = document.getElementById('work') as HTMLElement;
			const start = Number(el.dataset.guideStart);
			const end = Number(el.dataset.guideEnd);
			return { start, end };
		});
		expect(now).toBeGreaterThan((2026.7 - built.start) / (built.end - built.start));
		expect(now).toBeLessThanOrEqual(1);
	});
});
