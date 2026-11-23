import { test, expect, type Page } from '@playwright/test';
import { AA } from '../../src/lib/channels';
import { CPU_THROTTLE, LCP_BUDGET } from '../support/budgets';

/**
 * How I work says every claim the site makes has a check behind it that can
 * fail. This is that check for the section's own claims: each number it quotes
 * is the number the suite enforces, and it quotes no count that grows with the
 * work -- "37 commits" and "105 tests" were stale within a week of being
 * written (src/content/practice.yaml).
 */

/** Text as written, not as styled: innerText would apply text-transform. */
const practiceText = async (page: Page): Promise<string> =>
	((await page.locator('#practice').textContent()) ?? '').replace(/\s+/g, ' ');

const TIMES: Record<number, string> = {
	2: 'twice',
	3: 'three times',
	4: 'four times',
	5: 'five times',
	6: 'six times',
};

test('the numbers How I work quotes are the ones the checks enforce', async ({ page }) => {
	await page.goto('/');
	const text = await practiceText(page);
	expect(text, 'the load budget').toContain(`${LCP_BUDGET / 1000}-second load budget`);
	expect(text, 'the CPU slowdown').toContain(`slowed ${TIMES[CPU_THROTTLE]}`);
	expect(text, 'the contrast floor').toContain(`below ${AA}:1`);
});

test('How I work quotes no count that grows with the work', async ({ page }) => {
	await page.goto('/');
	expect(await practiceText(page)).not.toMatch(/\b\d+\s+(tests?|commits?|changes?)\b/i);
});
