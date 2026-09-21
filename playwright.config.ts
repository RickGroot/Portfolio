import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// PREVIEW_URL lets the same suite run against the deployed Firebase preview
// channel instead of a local build.
const PREVIEW_URL = process.env.PREVIEW_URL;
const BASE = PREVIEW_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
	testDir: 'tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	...(process.env.CI ? { workers: 2 } : {}),
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: { baseURL: BASE, trace: 'on-first-retry' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

	// Spread rather than assign `undefined`: tsconfig `strictest` sets
	// exactOptionalPropertyTypes, under which `webServer: undefined` is a type
	// error even though the key is optional.
	//
	// `preview` only -- the old config ran `build && preview` inside the test
	// run, rebuilding what CI had just built. `url` (not `port`) makes
	// Playwright wait for a real 200 rather than just an open socket.
	...(PREVIEW_URL
		? {}
		: {
				webServer: {
					command: 'node node_modules/astro/bin/astro.mjs preview --port 4173 --host 127.0.0.1',
					url: BASE,
					reuseExistingServer: !process.env.CI,
					timeout: 60_000,
				},
			}),
});
