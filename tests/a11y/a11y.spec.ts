import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = ['/', '/definitely-not-a-page'];

for (const path of ROUTES) {
	test(`${path} has no detectable accessibility violations`, async ({ page }) => {
		await page.goto(path);
		// The deal animates cards in; axe must judge them where they land.
		await page.waitForFunction(
			() => !document.documentElement.classList.contains('will-deal'),
			null,
			{
				timeout: 5000,
			},
		);
		await page.waitForTimeout(1200); // the last card's 520ms deal, after its stagger
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.analyze();

		const summary = results.violations.map(
			(v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`,
		);
		expect(summary, summary.join('\n')).toEqual([]);
	});
}

test('the skip link is the first thing keyboard focus reaches', async ({ page }) => {
	await page.goto('/');
	await page.keyboard.press('Tab');
	await expect(page.locator(':focus')).toHaveText(/Skip to content/i);
});

test('every link has an accessible name', async ({ page }) => {
	await page.goto('/');
	// Links on a turned-away face are inert; read them all by turning nothing.
	const unnamed = await page.locator('a').evaluateAll((links) =>
		links
			.filter((a) => a.getAttribute('aria-hidden') !== 'true')
			.filter((a) => !(a.textContent ?? '').trim() && !a.getAttribute('aria-label'))
			.map((a) => a.getAttribute('href') ?? '(no href)'),
	);
	expect(unnamed).toEqual([]);
});

test('a card turns from the keyboard, and the hidden face is inert', async ({ page }) => {
	await page.goto('/');
	await page.waitForFunction(() => !document.documentElement.classList.contains('will-deal'));
	const slot = page.locator('[data-card="nlziet"]');
	const turn = slot.locator('.turn');
	await expect(slot.locator('.back')).toHaveAttribute('inert', '');
	await expect(slot.locator('.front')).not.toHaveAttribute('inert', '');

	await turn.focus();
	await page.keyboard.press('Enter');

	await expect(turn).toHaveAttribute('aria-pressed', 'true');
	await expect(slot.locator('.front')).toHaveAttribute('inert', '');
	await expect(slot.locator('.back')).not.toHaveAttribute('inert', '');
	await expect(slot.locator('.turn-back')).toBeFocused();

	await page.keyboard.press('Enter');
	await expect(turn).toHaveAttribute('aria-pressed', 'false');
	await expect(slot.locator('.back')).toHaveAttribute('inert', '');
	await expect(turn).toBeFocused();
});

test('focus is visibly outlined', async ({ page }) => {
	await page.goto('/');
	await page.locator('[data-card="nlziet"] .turn').focus();
	const outline = await page
		.locator('[data-card="nlziet"]')
		.evaluate((el) => getComputedStyle(el).outlineWidth);
	expect(outline).toBe('3px');
});

test('under reduced motion nothing runs, and a card turns at once', async ({ browser }) => {
	const context = await browser.newContext({ reducedMotion: 'reduce' });
	const page = await context.newPage();
	await page.goto('/');
	await page.waitForTimeout(300);
	const running = await page.evaluate(() =>
		document
			.getAnimations()
			.filter((a) => a.playState === 'running')
			.map((a) => (a as CSSAnimation).animationName ?? a.id ?? 'waapi'),
	);
	expect(running, `running animations: ${running.join(', ')}`).toEqual([]);

	// A card turns at once: no transition on the flip, and it is turned now.
	const slot = page.locator('[data-card="nlziet"]');
	await slot.locator('.turn').click();
	await expect(slot).toHaveClass(/is-flipped/);
	const flip = await slot.locator('.flip').evaluate((el) => ({
		duration: getComputedStyle(el).transitionDuration,
		transform: getComputedStyle(el).transform,
	}));
	expect(flip.duration).toBe('0s');
	expect(flip.transform).not.toBe('none');
	await context.close();
});

test('"Pause motion" stops every animation and is remembered', async ({ page }) => {
	await page.goto('/');
	const toggle = page.getByRole('button', { name: 'Pause motion' });
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	const running = (): Promise<number> =>
		page.evaluate(
			() =>
				document
					.getAnimations()
					.filter((a) => a.playState === 'running' && a instanceof CSSAnimation).length,
		);
	expect(await running()).toBe(0);

	await page.reload();
	await expect(page.getByRole('button', { name: 'Pause motion' })).toHaveAttribute(
		'aria-pressed',
		'true',
	);
	expect(await running()).toBe(0);
});

test('without JavaScript every back and its links are on the page', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/');
	const back = page.locator('[data-card="nlziet"] .back');
	await expect(back).toBeVisible();
	await expect(back).not.toHaveAttribute('inert', '');
	await expect(page.locator('.turn').first()).toBeHidden();
	await expect(page.locator('[data-card="contact"] a.go').first()).toBeVisible();
	await context.close();
});

test('375px: no sideways scroll, one column', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
	const page = await context.newPage();
	await page.goto('/');
	await page.waitForTimeout(900);
	const m = await page.evaluate(() => ({
		sw: document.documentElement.scrollWidth,
		cw: document.documentElement.clientWidth,
	}));
	expect(m.sw).toBeLessThanOrEqual(m.cw);
	await context.close();
});
