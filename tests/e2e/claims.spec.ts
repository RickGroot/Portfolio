import { test, expect, type Page } from '@playwright/test';

/**
 * How I work quotes no count that grows with the work: "37 commits" and "105
 * tests" were stale within a week of being written (src/content/practice.yaml).
 * It lives on the liner-notes card, whose back holds all three principles in
 * full; textContent reads it though it is inert.
 */

/** Text as written, not as styled: innerText would apply text-transform. */
const practiceText = async (page: Page): Promise<string> =>
	((await page.locator('[data-card="how-i-work"]').textContent()) ?? '').replace(/\s+/g, ' ');

test('How I work quotes no count that grows with the work', async ({ page }) => {
	await page.goto('/');
	expect(await practiceText(page)).not.toMatch(/\b\d+\s+(tests?|commits?|changes?)\b/i);
});
