import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * Security headers live in firebase.json, on a `**` block that Firebase merges
 * with every other matching block. `astro preview` does not read firebase.json,
 * so locally the headers are applied to each response here; against a deployed
 * preview channel (PREVIEW_URL) the real response headers are checked instead.
 */
type Header = { key: string; value: string };
const config = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
	hosting: { headers: { source: string; headers: Header[] }[] };
};
const all = config.hosting.headers.find((h) => h.source === '**')?.headers ?? [];
const header = (key: string) => all.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;
const csp = header('Content-Security-Policy') ?? '';
const directive = (name: string) =>
	csp
		.split(';')
		.map((d) => d.trim().split(/\s+/))
		.find(([n]) => n === name)
		?.slice(1) ?? [];

const PREVIEW = !!process.env.PREVIEW_URL;

test.describe('security headers: the config', () => {
	test('firebase.json sends the full set on every path', () => {
		expect(csp, 'no Content-Security-Policy').not.toBe('');
		expect(header('X-Content-Type-Options')).toBe('nosniff');
		expect(header('X-Frame-Options')).toBe('DENY');
		expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
		expect(header('Cross-Origin-Opener-Policy')).toBe('same-origin');
		expect(header('Permissions-Policy')).toMatch(/camera=\(\)/);
		// "Copy address" writes to the clipboard; the policy must leave it alone.
		expect(header('Permissions-Policy')).not.toMatch(/clipboard/);
		for (const d of ['default-src', 'object-src', 'base-uri', 'frame-ancestors', 'form-action']) {
			expect(directive(d), `${d} missing`).not.toEqual([]);
		}
		expect(directive('object-src')).toEqual(["'none'"]);
		expect(directive('frame-ancestors')).toEqual(["'none'"]);
		// No third-party origin may run (CLAUDE.md), so nothing but self, hashes,
		// data: images and the CSP1 fallback.
		expect(csp).not.toMatch(/https?:|\*|'unsafe-eval'|'strict-dynamic'/);
	});

	// Firebase merges every matching block; a narrower one setting the same key
	// would quietly override the `**` value on its paths.
	test('only the ** block sets the security headers', () => {
		const keys = new Set(all.map((h) => h.key.toLowerCase()));
		const clashes = config.hosting.headers
			.filter((b) => b.source !== '**')
			.flatMap((b) =>
				b.headers.filter((h) => keys.has(h.key.toLowerCase())).map((h) => `${b.source}: ${h.key}`),
			);
		expect(clashes).toEqual([]);
	});

	// The bootstrap script in BaseLayout.astro is allowed by its hash. Change a
	// byte of it and this fails with the hash to paste into firebase.json.
	test('every inline script in the build is allowed by its sha256', () => {
		const pages = readdirSync('dist').filter((f) => f.endsWith('.html'));
		expect(pages.length).toBeGreaterThan(0);
		const allowed = directive('script-src');
		const missing = new Set<string>();
		let inline = 0;
		for (const page of pages) {
			const html = readFileSync(`dist/${page}`, 'utf8');
			for (const [, attrs = '', body = ''] of html.matchAll(
				/<script\b([^>]*)>([\s\S]*?)<\/script>/g,
			)) {
				// Anchored on whitespace, so `data-src=` is not mistaken for `src=`.
				if (/(?:^|\s)src=/.test(attrs)) continue;
				// Data blocks (JSON-LD) are never executed, so CSP ignores them.
				const type = /(?:^|\s)type="?([^"\s>]+)/.exec(attrs)?.[1];
				if (type && type !== 'module' && !/javascript/.test(type)) continue;
				inline++;
				const hash = `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
				if (!allowed.includes(hash)) missing.add(`${page}: ${hash}`);
			}
			// A hash never covers an event-handler attribute.
			expect(html, `${page} has an inline event handler`).not.toMatch(/\son[a-z]+=/i);
		}
		expect(inline, 'the bootstrap script went missing').toBeGreaterThan(0);
		expect([...missing], 'add these to script-src in firebase.json').toEqual([]);
	});
});

async function watch(page: Page) {
	const problems: string[] = [];
	page.on('console', (m) => {
		if (m.type() !== 'error') return;
		// The 404 page's own status is reported as a failed load; that is the point.
		if (/status of 404/.test(m.text()) && m.location().url.includes('not-a-page')) return;
		problems.push(`console: ${m.text()}`);
	});
	page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (e) => {
			console.error(`CSP ${e.effectiveDirective} blocked ${e.blockedURI || 'inline'}`);
		});
	});
	if (!PREVIEW) {
		await page.route('**/*', async (route) => {
			const response = await route.fetch();
			const headers = { ...response.headers() };
			for (const h of all) headers[h.key.toLowerCase()] = h.value;
			await route.fulfill({ response, headers });
		});
	}
	return problems;
}

test.describe('security headers: the page under them', () => {
	test('the table works with nothing blocked', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		const problems = await watch(page);
		const response = await page.goto('/');
		if (PREVIEW) {
			const got = await response!.allHeaders();
			for (const h of all) expect(got[h.key.toLowerCase()], h.key).toBe(h.value);
		}
		await page.waitForTimeout(900); // the deal
		// The bootstrap ran (it is the inline script the hash allows).
		await expect(page.locator('html')).toHaveClass(/\bjs\b/);

		const vamp = page.locator('[data-card="vamp"]');
		await vamp.locator('.turn').click();
		await expect(vamp.locator('.turn-back')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Escape');

		await page.locator('.stub.fr.tear').click();
		await page.getByRole('button', { name: /copy address/i }).click();
		await expect(page.locator('.copied')).toHaveText(/copied/i);

		// Pause motion writes localStorage, which the bootstrap reads on the next load.
		await page.getByRole('button', { name: /pause motion/i }).click();
		await page.reload();
		await expect(page.locator('html')).toHaveClass(/\bstill\b/);
		expect(problems).toEqual([]);
	});

	test('the 404 renders with nothing blocked', async ({ page }) => {
		const problems = await watch(page);
		const response = await page.goto('/definitely-not-a-page');
		expect(response!.status()).toBe(404);
		if (PREVIEW) {
			const got = await response!.allHeaders();
			expect(got['content-security-policy']).toBe(csp);
		}
		await expect(page.locator('h1')).toHaveText(/Lost: page 404/i);
		// Hovering the way back prefetches it (fetch, so connect-src).
		await page.locator('main a[href="/"]').first().hover();
		await page.waitForTimeout(300);
		expect(problems).toEqual([]);
	});
});
