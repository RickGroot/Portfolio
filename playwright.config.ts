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
	//
	// `--ignore-lock` keeps the server in the foreground, where Playwright can
	// own it. Astro 7.3 backgrounds `astro preview` when it detects that an AI
	// agent is running it, and the command then returns at once -- which
	// Playwright reports as "Process from config.webServer exited early", with
	// an orphaned server left holding the port. Harmless everywhere else: it
	// only skips the lock file, and a test run's server has no use for one.
	...(PREVIEW_URL
		? {}
		: {
				webServer: {
					command:
						'node node_modules/astro/bin/astro.mjs preview --port 4173 --host 127.0.0.1 --ignore-lock',
					url: BASE,
					reuseExistingServer: !process.env.CI,
					timeout: 60_000,
				},
			}),
});
