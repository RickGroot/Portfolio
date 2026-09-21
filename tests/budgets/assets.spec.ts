import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'dist';
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);
const TEXT_EXT = new Set(['.html', '.css', '.js', '.xml', '.json', '.webmanifest', '.txt']);

function walk(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, acc);
		else acc.push(p);
	}
	return acc;
}

/**
 * Regression guard for a real defect.
 *
 * `draft: true` stops a page rendering. It does NOT stop Astro emitting that
 * entry's `image()` asset -- the schema reference alone is enough. Three draft
 * covers, including a licensed press photograph, were being built into
 * dist/_astro/ and would have been deployed to the CDN: unreferenced by any
 * page, but publicly fetchable.
 *
 * Any image in the build that nothing links to is either that bug returning or
 * dead weight. Both are worth failing over.
 */
test('every shipped image is referenced by something', () => {
	const files = walk(DIST);

	const haystack = files
		.filter((f) => TEXT_EXT.has(extname(f).toLowerCase()))
		.map((f) => readFileSync(f, 'utf8'))
		.join('\n');

	const orphans = files
		.filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
		.map((f) => f.split(/[\\/]/).pop() as string)
		// Files served by URL rather than referenced from markup.
		.filter((name) => !/^(favicon|apple-touch-icon|android-chrome)/.test(name))
		.filter((name) => !haystack.includes(name));

	expect(
		orphans,
		`Unreferenced images in ${DIST}/. A draft entry carrying a cover: image() will ` +
			`emit its asset even though no page renders it. Remove the cover from the ` +
			`draft's frontmatter. Orphans: ${orphans.join(', ')}`,
	).toEqual([]);
});

test('no draft entry cover reaches the build', () => {
	// Named explicitly, because these three are the ones that already leaked and
	// one of them is a press photo we are not licensed to publish.
	const built = walk(DIST).map((f) => f.split(/[\\/]/).pop() as string);
	const leaked = ['nos', 'ajax', 'nhnieuws'].filter((slug) =>
		built.some((name) => name.toLowerCase().startsWith(`${slug}.`)),
	);

	expect(leaked, `Draft cover(s) emitted into the build: ${leaked.join(', ')}`).toEqual([]);
});
