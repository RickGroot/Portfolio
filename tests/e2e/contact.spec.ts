import { test, expect } from '@playwright/test';

/**
 * The ways to reach me: a bar above the table, and the contact ticket whose
 * stub tears off. Every control is a real link or button, and on a phone at
 * least 44px tall.
 */

const MOBILE = { width: 390, height: 844 };

test('the table has no "turn over" instruction, only a quiet corner mark', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText(/to turn it over/i)).toHaveCount(0);
	await expect(page.locator('[data-card="nlziet"] .turn .corner')).toHaveCount(1);
	// The button still says what it does, to a screen reader.
	await expect(page.locator('[data-card="nlziet"] .turn')).toContainText('Turn over');
});

test('the contact bar sits by "Pause motion" and links out', async ({ page }) => {
	await page.goto('/');
	const bar = page.locator('.bar');
	await expect(bar.getByRole('link', { name: 'Email' })).toHaveAttribute('href', /^mailto:/);
	await expect(bar.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
		'href',
		/linkedin\.com/,
	);
	await expect(bar.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /github\.com/);
	await expect(bar.getByRole('button', { name: 'Pause motion' })).toBeVisible();
});

test('on a phone the bar and the ticket are thumb-sized', async ({ browser }) => {
	const context = await browser.newContext({ viewport: MOBILE });
	const page = await context.newPage();
	await page.goto('/');
	for (const chip of await page.locator('.bar .chip').all()) {
		const box = await chip.boundingBox();
		expect(box?.height ?? 0, await chip.innerText()).toBeGreaterThanOrEqual(44);
	}
	const ticket = page.locator('.slot.ticket');
	await ticket.scrollIntoViewIfNeeded();
	await ticket.locator('.tear').click();
	for (const control of await ticket.locator('.actions .go').all()) {
		const box = await control.boundingBox();
		expect(box?.height ?? 0, await control.innerText()).toBeGreaterThanOrEqual(44);
		const size = await control.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
		expect(size).toBeGreaterThanOrEqual(12);
	}
	await context.close();
});

test('the stub tears off, turns over to the actions, and puts back', async ({ page }) => {
	await page.goto('/');
	const ticket = page.locator('.slot.ticket');
	await expect(ticket).toContainText('Good for one conversation');
	await expect(ticket).not.toContainText('Admit one');
	await expect(ticket.locator('.stub.bk')).toHaveJSProperty('inert', true);

	const tear = ticket.getByRole('button', { name: /Tear off the stub/ });
	await expect(tear).toHaveAttribute('aria-expanded', 'false');
	await tear.focus();
	await page.keyboard.press('Enter');

	await expect(ticket).toHaveClass(/is-torn/);
	// The body is not left empty, and I say I am open to work.
	await expect(ticket.locator('.after')).toBeVisible();
	await expect(ticket.locator('.stub.bk')).toContainText('Open to work');
	await expect(ticket.locator('.stub.bk')).toHaveJSProperty('inert', false);
	await expect(ticket.locator('.stub.fr')).toHaveJSProperty('inert', true);
	await expect(ticket.getByRole('link', { name: 'Email' })).toBeFocused();
	await expect(ticket.getByRole('link', { name: 'LinkedIn' })).toBeVisible();
	await expect(ticket.getByRole('link', { name: 'GitHub' })).toBeVisible();

	// Put it back: the stub turns round, focus returns to it.
	await ticket.getByRole('button', { name: 'Put it back' }).click();
	await expect(ticket).not.toHaveClass(/is-torn/);
	await expect(tear).toBeFocused();
	await expect(tear).toHaveAttribute('aria-expanded', 'false');
	await expect(ticket.locator('.stub.bk')).toHaveJSProperty('inert', true);
	await expect(ticket.locator('.stub.fr')).toHaveJSProperty('inert', false);

	// Escape also puts it back.
	await tear.click();
	await expect(ticket).toHaveClass(/is-torn/);
	await page.keyboard.press('Escape');
	await expect(ticket).not.toHaveClass(/is-torn/);
	await expect(tear).toBeFocused();
});

// The back of the stub is drawn in px (44px targets, 12px type) on a card
// drawn in cqw, so it ran out of room on every width (2026-11-24).
for (const width of [320, 375, 821, 1366]) {
	test(`${width}px: the torn stub holds every action without overflowing`, async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width, height: 900 },
			reducedMotion: 'reduce',
		});
		const page = await context.newPage();
		await page.goto('/');
		const ticket = page.locator('.slot.ticket');
		await ticket.scrollIntoViewIfNeeded();
		await ticket.locator('.tear').click();
		await expect(ticket).toHaveClass(/is-torn/);
		const back = await ticket.locator('.stub.bk').evaluate((el) => ({
			over: el.scrollHeight - el.clientHeight,
			wide: el.scrollWidth - el.clientWidth,
		}));
		expect(back.over, 'the stub back overflows downwards').toBeLessThanOrEqual(0);
		expect(back.wide, 'the stub back overflows sideways').toBeLessThanOrEqual(0);
		await context.close();
	});
}

// Hover lifts a card and the pointer tilts it away, which carried a corner out
// from under the pointer: hover dropped, the card fell back, and it flickered.
test('a pointer resting on the ticket corner keeps it hovered', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
	const page = await context.newPage();
	await page.goto('/');
	const ticket = page.locator('.slot.ticket');
	await ticket.scrollIntoViewIfNeeded();
	await page.waitForTimeout(900); // the deal
	const box = await ticket.boundingBox();
	if (!box) throw new Error('no ticket');
	await page.mouse.move(box.x + box.width * 0.99, box.y + box.height * 0.01);
	const states: boolean[] = [];
	for (let i = 0; i < 20; i++) {
		await page.waitForTimeout(30);
		states.push(await ticket.evaluate((el) => el.matches(':hover')));
	}
	expect(states.every(Boolean), states.map((s) => (s ? 'H' : '-')).join('')).toBe(true);
	await context.close();
});

test('with reduced motion the stub just swaps state', async ({ browser }) => {
	const context = await browser.newContext({ reducedMotion: 'reduce' });
	const page = await context.newPage();
	await page.goto('/');
	const ticket = page.locator('.slot.ticket');
	await ticket.locator('.tear').click();
	await expect(ticket).toHaveClass(/is-torn/);
	const t = await ticket
		.locator('.stubflip')
		.evaluate((el) => getComputedStyle(el).transitionDuration);
	expect(t).toBe('0s');
	await context.close();
});

test('copying the address says "Copied" in a live region', async ({ browser }) => {
	const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	const page = await context.newPage();
	await page.goto('/');
	const ticket = page.locator('.slot.ticket');
	await ticket.locator('.tear').click();
	await expect(ticket.locator('.copied')).toHaveAttribute('aria-live', 'polite');

	const copy = ticket.locator('.copy');
	const address = await copy.getAttribute('data-copy');
	await copy.click();
	await expect(ticket.locator('.copied')).toContainText('Copied');
	await expect(copy).toHaveText('Copied');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
	await context.close();
});

test('without JavaScript the ticket shows its links and offers no stub to tear', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/');
	const ticket = page.locator('.slot.ticket');
	await expect(ticket.getByRole('link', { name: 'Email' })).toBeVisible();
	await expect(ticket.locator('.tear')).toBeHidden();
	await expect(ticket.getByRole('link', { name: 'GitHub' })).toBeVisible();
	await context.close();
});

test('the chromecast card is the sender, and its back is the TV', async ({ page }) => {
	await page.goto('/');
	const slot = page.locator('[data-card="chromecast"]');
	await expect(slot).toHaveClass(/cast/);
	await slot.locator('.turn').click();
	await expect(slot.locator('.back .queue li').first()).toBeVisible();
	await expect(slot.locator('.back .splash')).toHaveCount(1);
});

test('a polaroid sits between the work, with its note on the back', async ({ page }) => {
	await page.goto('/');
	const kinds = await page
		.locator('.slot')
		.evaluateAll((els): string[] => els.map((e) => e.classList[1] ?? ''));
	const first = kinds.indexOf('polaroid');
	expect(first).toBeGreaterThan(0);
	expect(kinds.slice(0, first)).toContain('player');
	expect(kinds.slice(first)).toEqual(expect.arrayContaining(['tape']));
});
