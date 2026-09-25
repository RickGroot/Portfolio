import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/work/nlziet', '/work/chromecast', '/work/vamp', '/work/kijk', '/404-x'];

/**
 * A SINGLE duplicated `view-transition-name` in a document makes the browser
 * skip the entire transition, with no error and nothing in the console. The
 * one-pager renders a name per project, so this is the guard that survives
 * someone adding another section later.
 */
test('no duplicate view-transition-name on any route', async ({ page }) => {
	for (const path of ROUTES) {
		await page.goto(path);
		const dupes = await page.evaluate(() => {
			const names = [...document.querySelectorAll<HTMLElement>('*')]
				.map((el) => getComputedStyle(el).viewTransitionName)
				.filter((n) => n && n !== 'none');
			return names.filter((n, i) => names.indexOf(n) !== i);
		});
		expect(dupes, `${path} has duplicate view-transition-name: ${dupes.join(', ')}`).toEqual([]);
	}
});

test('the names actually pair up between the one-pager and each detail page', async ({ page }) => {
	const names = () =>
		page.evaluate(() =>
			[...document.querySelectorAll<HTMLElement>('*')]
				.map((el) => getComputedStyle(el).viewTransitionName)
				.filter((n) => n && n !== 'none'),
		);

	for (const id of ['nlziet', 'chromecast', 'vamp', 'kijk']) {
		// Only the programme in focus carries names -- one set per document,
		// or the browser skips the whole transition -- and it is the one you
		// click, because focus follows the pointer. So focus it first.
		await page.goto('/');
		const block = page.locator(`#work [data-block="${id}"]`);
		// Past the first three, a programme waits behind Load more.
		if (!(await block.isVisible()))
			await page.locator('#work summary', { hasText: 'Load more' }).click();
		await block.hover();
		const onHome = await names();
		// A morph only happens if BOTH documents carry the same name. Naming one
		// side only is the other silent failure mode.
		expect(onHome, `the one-pager is missing cover-${id}`).toContain(`cover-${id}`);
		expect(onHome, `the one-pager is missing title-${id}`).toContain(`title-${id}`);

		await page.goto(`/work/${id}`);
		const onDetail = await page.evaluate(() =>
			[...document.querySelectorAll<HTMLElement>('*')]
				.map((el) => getComputedStyle(el).viewTransitionName)
				.filter((n) => n && n !== 'none'),
		);
		expect(onDetail, `/work/${id} is missing cover-${id}`).toContain(`cover-${id}`);
		expect(onDetail, `/work/${id} is missing title-${id}`).toContain(`title-${id}`);
	}
});

test('names are valid CSS idents', async ({ page }) => {
	await page.goto('/');
	const names = await page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('*')]
			.map((el) => getComputedStyle(el).viewTransitionName)
			.filter((n) => n && n !== 'none'),
	);
	expect(names.length).toBeGreaterThan(0);
	for (const n of names) {
		// A dot or a space silently invalidates the declaration, so the name is
		// never applied and the morph never happens.
		expect(n, `"${n}" is not a valid ident`).toMatch(/^[a-zA-Z][a-zA-Z0-9-]*$/);
	}
});

test('transitions are opted out under reduced motion', async ({ browser }) => {
	const context = await browser.newContext({ reducedMotion: 'reduce' });
	const page = await context.newPage();
	await page.goto('/');

	// The at-rule sits inside @media (prefers-reduced-motion: no-preference), so
	// under reduce it must not be in the matching rules at all.
	const optedIn = await page.evaluate(() => {
		for (const sheet of [...document.styleSheets]) {
			let rules: CSSRuleList;
			try {
				rules = sheet.cssRules;
			} catch {
				continue; // cross-origin sheet
			}
			for (const rule of [...rules]) {
				if (rule instanceof CSSMediaRule && !window.matchMedia(rule.conditionText).matches) {
					continue;
				}
				if (rule.cssText.includes('@view-transition')) return true;
			}
		}
		return false;
	});
	expect(optedIn, 'cross-document transitions are active under reduced motion').toBe(false);
	await context.close();
});

/**
 * Changing page is changing channel: the section advance's static comes with
 * it, on a layer of its own at the top of the transition (src/styles/zap.css).
 * It exists only while a transition runs, so it can never be left on the page
 * afterwards.
 *
 * A cross-document transition is the browser's to skip, and under a loaded
 * parallel run Chrome skipped seven navigations in eight. The static does not
 * care what started the transition -- it hangs off :active-view-transition --
 * so this starts a same-document one, which always runs, on a case study.
 * That the pages opt in and their names pair up is tested above.
 */
test('a page transition brings the static, above everything, and leaves nothing behind', async ({
	page,
}) => {
	await page.goto('/work/chromecast');
	const seen = await page.evaluate(async () => {
		const vt = document.startViewTransition(() => {});
		await vt.ready;
		const group = '::view-transition-group(vt-static)';
		const style = getComputedStyle(document.documentElement, group);
		const out = {
			layers: document
				.getAnimations()
				.filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === group).length,
			z: style.zIndex,
			image: style.backgroundImage,
		};
		await vt.finished;
		return out;
	});

	expect(seen.layers, 'the static never ran').toBeGreaterThan(0);
	// Above the picture (1), the gradient (2), and the title and chrome (3).
	expect(Number(seen.z), 'the static ran under the page').toBeGreaterThan(3);
	expect(seen.image, 'the static layer carried no noise').toContain('data:image/svg+xml');
	await expect(page.locator('.vt-static'), 'the static outlived the transition').toBeHidden();
});
