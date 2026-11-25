import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { AA, PALETTE, PIGMENTS, contrast, solve } from '../../src/lib/palette';

test('every pigment carries text at AA or better', () => {
	for (const p of PIGMENTS) {
		const { field, on, ratio } = solve(p);
		expect(ratio, `${p}`).toBeGreaterThanOrEqual(AA);
		expect(contrast(on, field)).toBeCloseTo(ratio, 5);
	}
});

test('the manifest is pinned to the palette', () => {
	const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
		background_color: string;
		theme_color: string;
	};
	expect(manifest.background_color.toLowerCase()).toBe(PALETTE.paper);
	expect(manifest.theme_color.toLowerCase()).toBe(PALETTE.paper);
});

test('the rendered cards use the solved colours', async ({ page }) => {
	await page.goto('/');
	const style = (await page.locator('[data-card="nlziet"]').getAttribute('style')) ?? '';
	expect(style.toLowerCase()).toContain(`--field:${solve('red').field}`);
});
