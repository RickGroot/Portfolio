/**
 * Counts the site's beacon events from Firebase Hosting's request log.
 *
 * Reads Cloud Logging entries as JSON on stdin (see docs/analytics.md):
 *
 *   gcloud logging read 'resource.type="firebase_domain" AND httpRequest.requestUrl:"/e?c="' \
 *     --project portfolio-rick-groot --freshness 30d --limit 100000 --format json | pnpm -s stats
 *
 * Prints totals only. Addresses are used in memory to tell visitors apart for
 * a day and are never written out.
 */

import { createHash } from 'node:crypto';

const BOT = /bot|crawl|spider|headless|lighthouse|preview|monitor|curl|wget|python|playwright/i;
const EVENT = /^[a-z0-9.-]{1,80}$/;

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let entries;
try {
	entries = JSON.parse(raw || '[]');
} catch (err) {
	console.error(`stats: stdin is not JSON (${err instanceof Error ? err.message : err})`);
	process.exit(1);
}
if (!Array.isArray(entries)) {
	console.error('stats: expected a JSON array of log entries');
	process.exit(1);
}

/** @type {Map<string, number>} */ const events = new Map();
/** @type {Map<string, number>} */ const referrers = new Map();
/** @type {Map<string, { views: number, visitors: Set<string> }>} */ const days = new Map();
let skipped = 0;

const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

for (const entry of entries) {
	const req = entry?.httpRequest;
	if (!req?.requestUrl) continue;
	let url;
	try {
		url = new URL(req.requestUrl);
	} catch {
		continue;
	}
	const event = url.searchParams.get('c') ?? '';
	// Anyone can request /e with any query: count only well-formed events from
	// what looks like a browser.
	if (url.pathname !== '/e' || !EVENT.test(event) || BOT.test(req.userAgent ?? '')) {
		skipped++;
		continue;
	}
	bump(events, event);
	if (event !== 'view') continue;

	const day = String(entry.timestamp ?? '').slice(0, 10) || 'unknown';
	const bucket = days.get(day) ?? { views: 0, visitors: new Set() };
	bucket.views++;
	bucket.visitors.add(
		createHash('sha256')
			.update(`${day}|${req.remoteIp ?? ''}|${req.userAgent ?? ''}`)
			.digest('hex'),
	);
	days.set(day, bucket);
	bump(referrers, url.searchParams.get('r') || '(direct)');
}

const table = (title, rows) => {
	console.log(`\n${title}`);
	if (rows.length === 0) console.log('  (none)');
	const width = Math.max(0, ...rows.map(([name]) => name.length));
	for (const [name, ...counts] of rows)
		console.log(`  ${name.padEnd(width)}  ${counts.join('  ')}`);
};
const byCount = (map) => [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

table(
	'Per day (views, visitors)',
	[...days].sort().map(([day, d]) => [day, d.views, d.visitors.size]),
);
table('Came from', byCount(referrers));
table('Events', byCount(events));
console.log(`\n${entries.length} log entries read, ${skipped} skipped (bots or malformed).`);
