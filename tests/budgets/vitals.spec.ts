import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * LCP and CLS on built output.
 *
 * These were in the Phase 2 gate from the beginning and had never actually been
 * measured, which made the gate a claim rather than a check.
 *
 * `@lhci/cli` is deliberately not used. It pulls in Lighthouse and a second
 * Chrome to measure two numbers this file gets from the browser's own
 * PerformanceObserver, using the Chromium Playwright already installs. The two
 * metrics in the budget are the two measured here; the rest of a Lighthouse
 * report is not a gate anyone was going to act on.
 *
 * WHAT THIS IS NOT: a field measurement. A headless browser on a developer
 * machine is not a visitor on a train. Real LCP is a field metric and this is a
 * lab one, so it is a regression guard, not a promise about real users.
 *
 * To make it mean something anyway, the numbers that gate the build are taken
 * with the CPU throttled 4x. This is a portfolio about software that has to run
 * on hardware you do not get to choose; measuring it only on a fast desktop
 * would be the wrong joke to make.
 */

interface Vitals {
	lcp: number;
	cls: number;
	lcpElement: string;
}

/** Install the observers before any page script runs, and before navigation. */
async function observe(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as unknown as { __lcp: number; __cls: number; __lcpEl: string };
		w.__lcp = 0;
		w.__cls = 0;
		w.__lcpEl = '';

		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				// LCP is reported repeatedly as bigger candidates paint; the last
				// one before interaction is the real value.
				if (e.startTime > w.__lcp) {
					w.__lcp = e.startTime;
					const el = (e as PerformanceEntry & { element?: Element }).element;
					w.__lcpEl = el ? `${el.tagName.toLowerCase()}.${el.className || '-'}` : 'unknown';
				}
			}
		}).observe({ type: 'largest-contentful-paint', buffered: true });

		new PerformanceObserver((list) => {
			for (const e of list.getEntries()) {
				const shift = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
				// Shifts within 500ms of a real input are the user's own doing.
				if (!shift.hadRecentInput) w.__cls += shift.value;
			}
		}).observe({ type: 'layout-shift', buffered: true });
	});
}

/**
 * Walk the whole document. A font that swaps late, an image without intrinsic
 * dimensions, or a lazy image below the fold all shift layout only once they
 * are reached -- so a CLS number taken at load is the flattering half.
 */
async function walk(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const step = window.innerHeight;
		const end = document.documentElement.scrollHeight;
		for (let y = 0; y < end; y += step) {
			window.scrollTo({ top: y, behavior: 'instant' });
			await new Promise((r) => setTimeout(r, 160));
		}
		window.scrollTo({ top: 0, behavior: 'instant' });
		await new Promise((r) => setTimeout(r, 200));
	});
}

async function measure(page: Page, path: string, cpuThrottle: number): Promise<Vitals> {
	await observe(page);

	const cdp = await page.context().newCDPSession(page);
	if (cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });

	await page.goto(path, { waitUntil: 'load' });
	await page.waitForTimeout(600);
	await walk(page);

	const v = await page.evaluate(() => {
		const w = window as unknown as { __lcp: number; __cls: number; __lcpEl: string };
		return { lcp: Math.round(w.__lcp), cls: Number(w.__cls.toFixed(4)), lcpElement: w.__lcpEl };
	});

	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
	await cdp.detach();
	return v;
}

/**
 * Median of several samples, each in a fresh context.
 *
 * A single sample is not a measurement here. Repeated back to back on an idle
 * machine the homepage produced 784, 840 and 1132ms, and 1788ms immediately
 * after the parallel suite -- a 2.3x spread on identical bytes. A threshold set
 * against one sample would fail for reasons that have nothing to do with the
 * code, and a gate that cries wolf gets switched off, which is worse than not
 * having one.
 */
async function median(browser: Browser, path: string, samples = 3): Promise<Vitals> {
	const runs: Vitals[] = [];
	for (let i = 0; i < samples; i++) {
		const context = await browser.newContext();
		const page = await context.newPage();
		runs.push(await measure(page, path, 4));
		await context.close();
	}
	const mid = Math.floor(samples / 2);
	const lcp = [...runs].sort((a, b) => a.lcp - b.lcp)[mid]!.lcp;
	const cls = [...runs].sort((a, b) => a.cls - b.cls)[mid]!.cls;
	// CLS must be clean in EVERY run, not just the median one.
	const worstCls = Math.max(...runs.map((r) => r.cls));
	return { lcp, cls: Math.max(cls, worstCls), lcpElement: runs[0]!.lcpElement };
}

const ROUTES = ['/', '/work/chromecast'];

// CLAUDE.md budget. Held against the throttled run, which is the harder one.
const LCP_BUDGET = 2500;
const CLS_BUDGET = 0.1;

/*
 * A trip-wire well under the allowance, so the budget has teeth rather than
 * being decoration -- the same reasoning as the 8 KB field-chunk gate. The
 * Set from observed data: the median at 4x throttle is ~840ms, so this leaves
 * roughly 1.8x of headroom over normal variance while still failing long
 * before the 2500ms budget does.
 */
const LCP_TRIPWIRE = 1500;

/*
 * Tagged @vitals and EXCLUDED from `pnpm test`, which runs 8 workers in
 * parallel. A CPU-throttled measurement taken while seven other browsers
 * fight for the same cores is not a measurement of this site -- it measured
 * over the 2500ms budget in the parallel run and 788ms on its own. Run it
 * with `pnpm test:vitals`, which forces a single worker.
 */
test.describe('core web vitals on built output @vitals', () => {
	for (const path of ROUTES) {
		test(`${path} — 4x CPU throttle, median of 3`, async ({ browser }) => {
			const v = await median(browser, path);
			// Printed, not only asserted: the number is the point of the test.
			console.log(`  ${path} @4x  LCP ${v.lcp}ms  CLS ${v.cls}  (LCP element: ${v.lcpElement})`);

			expect(v.lcp, `${path}: LCP ${v.lcp}ms exceeds the ${LCP_BUDGET}ms budget`).toBeLessThan(
				LCP_BUDGET,
			);
			expect(
				v.lcp,
				`${path}: LCP ${v.lcp}ms is over the ${LCP_TRIPWIRE}ms trip-wire. Still inside budget, ` +
					`but something got materially slower -- find out what before raising this.`,
			).toBeLessThan(LCP_TRIPWIRE);
			expect(v.cls, `${path}: CLS ${v.cls} exceeds ${CLS_BUDGET}`).toBeLessThan(CLS_BUDGET);
		});
	}

	/*
	 * CLS specifically under a cold font cache. The display face ships with a
	 * measured metric-matched fallback; if those overrides drift, the swap
	 * shifts the LCP heading and this is what notices.
	 */
	test('no layout shift from the font swap, on a cold cache', async ({ browser }) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await observe(page);
		await page.goto('/', { waitUntil: 'load' });
		await page.waitForTimeout(1200);
		await walk(page);

		const cls = await page.evaluate(() =>
			Number((window as unknown as { __cls: number }).__cls.toFixed(4)),
		);
		// Printed, not only asserted: the number is the point of the test.
		console.log(`  / cold cache  CLS ${cls}`);
		expect(cls, `cold-cache CLS ${cls} exceeds ${CLS_BUDGET}`).toBeLessThan(CLS_BUDGET);
		await context.close();
	});
});
