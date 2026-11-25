#!/usr/bin/env node
/*
 * Asset gate. Zero dependencies -- node:fs and node:zlib only.
 *
 * This is what makes the performance work stick rather than decay. The old site
 * shipped 5.7 MB of images on its homepage; nothing stopped that happening, and
 * nothing would stop it happening again.
 *
 * Run after `astro build`:  node scripts/check-assets.mjs
 * Flags: --warn-only (never exit non-zero), --json (machine-readable summary)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { userInfo } from 'node:os';

const DIST = 'dist';
const WARN_ONLY = process.argv.includes('--warn-only');
const AS_JSON = process.argv.includes('--json');

const LIMITS = {
	imageFail: 250 * 1024,
	imageWarn: 150 * 1024,
	svgFail: 20 * 1024,
	htmlGzip: 25 * 1024,
	cssGzip: 20 * 1024,
	jsGzipTotal: 45 * 1024,
	// Back to 80 KB: Archivo is a static 900 / 62% instance (12 KB) rather than
	// the 88 KB variable file. Four files, ~68 KB, each preloaded or loaded on use.
	fontsTotal: 80 * 1024,
};

const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const TEXT = new Set(['.html', '.css', '.js', '.xml', '.json', '.webmanifest', '.txt', '.svg']);

const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);
const warn = (msg) => warnings.push(msg);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function walk(dir, acc = []) {
	if (!existsSync(dir)) return acc;
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, acc);
		else acc.push(p);
	}
	return acc;
}

if (!existsSync(DIST)) {
	console.error(`check-assets: ${DIST}/ does not exist. Run the build first.`);
	process.exit(1);
}

const distFiles = walk(DIST);
const textBlob = distFiles
	.filter((f) => TEXT.has(extname(f).toLowerCase()))
	.map((f) => readFileSync(f, 'utf8'))
	.join('\n');

/* ---- 1. Per-image weight ------------------------------------------------- */

for (const f of distFiles) {
	const ext = extname(f).toLowerCase();
	const size = statSync(f).size;
	if (ext === '.svg') {
		if (size > LIMITS.svgFail) fail(`${f} is ${kb(size)} (SVG limit ${kb(LIMITS.svgFail)})`);
	} else if (IMAGE.has(ext)) {
		if (size > LIMITS.imageFail) fail(`${f} is ${kb(size)} (limit ${kb(LIMITS.imageFail)})`);
		else if (size > LIMITS.imageWarn) warn(`${f} is ${kb(size)}`);
	}
}

/* ---- 2. Orphaned assets -------------------------------------------------- */

/*
 * An image nothing links to is either dead weight or a leak. `draft: true`
 * stops a page rendering but NOT the `image()` asset being emitted, which is
 * how a licensed press photograph ended up built into dist/ once already.
 */
const SERVED_BY_URL = /^(favicon|apple-touch-icon|android-chrome|mstile)/;
for (const f of distFiles) {
	if (!IMAGE.has(extname(f).toLowerCase())) continue;
	const name = basename(f);
	if (SERVED_BY_URL.test(name)) continue;
	if (!textBlob.includes(name)) fail(`${f} is referenced by nothing (${kb(statSync(f).size)})`);
}

/* ---- 3. Per-route weight ------------------------------------------------- */

const routes = distFiles.filter((f) => f.endsWith('.html'));
for (const route of routes) {
	const html = readFileSync(route, 'utf8');
	const g = gzipSync(Buffer.from(html), { level: 9 }).length;
	if (g > LIMITS.htmlGzip) fail(`${route} HTML is ${kb(g)} gzip (limit ${kb(LIMITS.htmlGzip)})`);
}

const cssTotal = distFiles
	.filter((f) => f.endsWith('.css'))
	.reduce((s, f) => s + gzipSync(readFileSync(f), { level: 9 }).length, 0);
if (cssTotal > LIMITS.cssGzip) fail(`CSS is ${kb(cssTotal)} gzip (limit ${kb(LIMITS.cssGzip)})`);

// External JS plus anything inlined into the HTML -- an inline script is still
// JavaScript the visitor pays for. A JSON-LD block is not: it is data, and
// never runs.
const INLINE_SCRIPT =
	/<script(?![^>]*\b(?:src=|type="application\/ld\+json"))[^>]*>([\s\S]*?)<\/script>/g;
let jsTotal = distFiles
	.filter((f) => f.endsWith('.js') && !f.includes('service-worker'))
	.reduce((s, f) => s + gzipSync(readFileSync(f), { level: 9 }).length, 0);
for (const route of routes) {
	const html = readFileSync(route, 'utf8');
	const inline = [...html.matchAll(INLINE_SCRIPT)].map((m) => m[1]).join('');
	if (inline.trim()) jsTotal += gzipSync(Buffer.from(inline), { level: 9 }).length;
}
if (jsTotal > LIMITS.jsGzipTotal)
	fail(`JS is ${kb(jsTotal)} gzip (limit ${kb(LIMITS.jsGzipTotal)})`);

/* ---- 4. Metadata / EXIF -------------------------------------------------- */

/*
 * Checked on BOTH src/assets and dist: git history is the real leak vector, and
 * a stripped build does not un-commit a source master full of GPS.
 *
 * The old homepage shipped camera body, Lightroom version and capture
 * timestamps to every visitor.
 */
const META_MARKERS = [
	'Exif\0\0',
	'Photoshop 3.0',
	'http://ns.adobe.com/xap/1.0/',
	'GPSLatitude',
	'DateTimeOriginal',
	'CreatorTool',
	'Lightroom',
	'NIKON',
	'sodipodi:',
	'inkscape:',
];
for (const f of [...walk('src/assets'), ...distFiles]) {
	const ext = extname(f).toLowerCase();
	if (!IMAGE.has(ext) && ext !== '.svg') continue;
	const head = readFileSync(f).subarray(0, 65536).toString('latin1');
	for (const marker of META_MARKERS) {
		if (head.includes(marker)) {
			fail(`${f} carries metadata (${marker.replace(/\0/g, '')})`);
			break;
		}
	}
}

/* ---- 5. Sourcemap and build-path leakage --------------------------------- */

for (const f of distFiles) {
	if (f.endsWith('.map')) fail(`${f} is a sourcemap and must not ship`);
}
const username = userInfo().username;
for (const f of distFiles.filter((f) => /\.(js|css|html)$/.test(f))) {
	const s = readFileSync(f, 'utf8');
	if (s.includes('sourceMappingURL=')) fail(`${f} references a sourcemap`);
	if (/[A-Z]:\\\\?[Uu]sers\\/.test(s) || s.includes('/home/runner/'))
		fail(`${f} leaks an absolute build path`);
	// Public URLs legitimately carry the handle (rickgroot.nl, rickgroot.github.io);
	// strip them so a developer whose login is the site's name can still build.
	const bare = s.replace(/https?:\/\/[^\s"'<>)]*/g, '');
	if (username && username.length > 3 && bare.includes(username))
		fail(`${f} leaks the build machine's username`);
}

/* ---- 6. Third-party origins ---------------------------------------------- */

/*
 * Scoped to files a browser can actually make a request from. `textBlob`
 * includes .txt, and an OFL licence quotes the licence's own home page --
 * Departure Mono's cites https://openfontlicense.org, which failed the build
 * for a URL nothing will ever fetch. The pre-existing licences only escaped
 * because they spell it http:// and this pattern requires https.
 *
 * The check itself is unchanged and still covers every HTML, JS, CSS and JSON
 * file in the build; it just no longer reads legal boilerplate as a network
 * dependency.
 */
const REQUESTABLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.xml', '.webmanifest']);
const requestableBlob = distFiles
	.filter((f) => REQUESTABLE.has(extname(f).toLowerCase()))
	.map((f) => readFileSync(f, 'utf8'))
	.join('\n');

// Hosts the page only links out to (the article cards link to medium.com); none is fetched.
const ALLOWED = [
	'rickgroot.nl',
	'schema.org',
	'github.com',
	'linkedin.com',
	'rickgroot.github.io',
	'medium.com',
];
const origins = new Set();
for (const m of requestableBlob.matchAll(/https:\/\/([a-z0-9.-]+)/gi))
	origins.add(m[1].toLowerCase());
for (const host of origins) {
	if (!ALLOWED.some((a) => host === a || host.endsWith(`.${a}`)))
		fail(`third-party origin in the build: ${host}`);
}

/* ---- 7. Blocklist -------------------------------------------------------- */

/* A local, gitignored list of terms the build must not contain. */
const TERMS_FILE = 'scripts/blocklist.local.txt';
if (existsSync(TERMS_FILE)) {
	const terms = readFileSync(TERMS_FILE, 'utf8')
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('#'));
	const haystack = textBlob.toLowerCase();
	for (const term of terms) {
		if (haystack.includes(term.toLowerCase())) fail(`forbidden term present in the build`);
	}
} else {
	warn(`no ${TERMS_FILE} -- blocklist scan skipped`);
}

/* ---- 8. Fonts ------------------------------------------------------------ */

const fontDir = join(DIST, 'fonts');
if (existsSync(fontDir)) {
	/*
	 * `fonts/proto/` holds candidate faces served only to the internal /design
	 * routes. They are excluded from the production budget because no page a
	 * visitor can reach loads them -- but they are NOT ignored: shipping a
	 * comparison set to production is a 32 KB mistake nobody would notice, so
	 * the directory has to be empty before launch and says so on every run.
	 */
	const protoDir = join(fontDir, 'proto');
	if (existsSync(protoDir)) {
		const proto = readdirSync(protoDir).filter((f) => f.endsWith('.woff2'));
		let protoTotal = 0;
		for (const f of proto) protoTotal += statSync(join(protoDir, f)).size;
		if (proto.length > 0) {
			warn(
				`${proto.length} prototype font(s) present (${kb(protoTotal)}), excluded from the ` +
					`budget. public/fonts/proto/ must be empty before launch.`,
			);
		}
		if (proto.length > 0 && !readdirSync(protoDir).some((f) => /^OFL/i.test(f))) {
			fail('prototype fonts ship without a licence file');
		}
	}

	const fonts = readdirSync(fontDir).filter((f) => statSync(join(fontDir, f)).isFile());
	/*
	 * The budget is what a visitor downloads: the faces. It counted the licence
	 * texts too until the 2026-09-25 set, three faces with a licence each, went
	 * over on 13 KB of text no page ever requests. Their presence is still
	 * checked, below.
	 */
	let total = 0;
	for (const f of fonts) {
		const p = join(fontDir, f);
		if (f.endsWith('.woff2')) {
			total += statSync(p).size;
			const magic = readFileSync(p).subarray(0, 4).toString('latin1');
			if (magic !== 'wOF2') fail(`${p} is not a valid WOFF2`);
		}
	}
	if (total > LIMITS.fontsTotal) fail(`fonts total ${kb(total)} (limit ${kb(LIMITS.fontsTotal)})`);
	// Redistributing an OFL font without its licence is a real obligation.
	if (!fonts.some((f) => /^OFL/i.test(f))) fail('fonts ship without a licence file');
}

/* ---- 9. Undefined custom properties -------------------------------------- */

/*
 * An undefined `var(--x)` is not a CSS error. The declaration is simply
 * dropped, the layout quietly loses a rule, and nothing anywhere says so.
 * `--s-10` and `--s-5` were both used on the work detail page; neither is in
 * the scale, so the hero's bottom padding and the lede's rule offset silently
 * evaluated to nothing and the page shipped looking wrong.
 *
 * A property counts as defined if anything under src/ declares it -- in CSS, in
 * an inline style, via @property, or through setProperty() from a script.
 */
{
	const sources = walk('src').filter((f) => /\.(css|astro|ts)$/.test(f));
	const blob = sources.map((f) => readFileSync(f, 'utf8')).join('\n');

	const defined = new Set();
	// `--x:` in a stylesheet, an inline style attribute or a define:vars object.
	for (const m of blob.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)) defined.add(m[1]);
	// `@property --x`, which registers without a colon on the same token.
	for (const m of blob.matchAll(/@property\s+(--[a-zA-Z][\w-]*)/g)) defined.add(m[1]);
	// `setProperty('--x', ...)` from the interaction scripts.
	for (const m of blob.matchAll(/setProperty\(\s*['"`](--[a-zA-Z][\w-]*)/g)) defined.add(m[1]);

	// The palette is emitted as custom properties by src/lib/palette.ts.
	for (const m of readFileSync('src/lib/palette.ts', 'utf8')
		.match(/PALETTE = \{[\s\S]*?\} as const/)[0]
		.matchAll(/^\s*(\w+):/gm))
		defined.add(`--${m[1]}`);

	const missing = new Map();
	for (const f of sources) {
		for (const m of readFileSync(f, 'utf8').matchAll(/var\(\s*(--[a-zA-Z][\w-]*)\s*([,)])/g)) {
			// A fallback makes the reference safe by construction.
			if (m[2] === ',' || defined.has(m[1])) continue;
			if (!missing.has(m[1])) missing.set(m[1], new Set());
			missing.get(m[1]).add(f);
		}
	}
	for (const [name, where] of missing) {
		fail(`${name} is used but never defined (${[...where].join(', ')})`);
	}
}

/* ---- 10. Placeholder assets ---------------------------------------------- */

/*
 * Anything named PLACEHOLDER-* is temporary and must not launch. A warning
 * rather than a failure, because the site has to build while one is in use --
 * but a loud one on every run. The last set were Unsplash images, one of them a
 * stranger's face beside Rick's name; they are gone, and this stays so the next
 * placeholder cannot quietly become permanent.
 */
{
	const placeholders = distFiles.filter((f) => /placeholder-/i.test(basename(f)));
	if (placeholders.length > 0) {
		const total = placeholders.reduce((n, f) => n + statSync(f).size, 0);
		warn(
			`${placeholders.length} placeholder asset(s) in the build (${kb(total)}). ` +
				`See src/assets/IMAGES.md. ` +
				`Replace before launch.`,
		);
	}
}

/* ---- report -------------------------------------------------------------- */

if (AS_JSON) {
	console.log(JSON.stringify({ failures, warnings }, null, 2));
} else {
	for (const w of warnings) console.log(`  WARN  ${w}`);
	for (const f of failures) console.log(`  FAIL  ${f}`);
	console.log(
		failures.length
			? `\ncheck-assets: ${failures.length} failure(s), ${warnings.length} warning(s)`
			: `check-assets: ok (${warnings.length} warning(s))`,
	);
}

process.exit(failures.length && !WARN_ONLY ? 1 : 0);
