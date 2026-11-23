export const site = {
	name: 'Rick Groot',
	url: 'https://rickgroot.nl',
	tagline: 'Connected TV developer',
	description:
		'Rick Groot, a Connected TV developer, is open to work. TV apps, Chromecast receivers and video players that run well on constrained hardware.',
	locale: 'en',
} as const;

/** A link preview's picture: 1200x630, the shape every card crops to. */
export interface ShareImage {
	/** Absolute or root-relative URL. */
	src: string;
	width: number;
	height: number;
	alt: string;
}

/**
 * A page's public path, as a visitor sees it.
 *
 * `build.format: 'file'` (astro.config) emits dist/work/nlziet.html, and during
 * the build Astro reports THAT as the page's pathname -- '/work/nlziet.html',
 * and '/index.html' for the homepage. Firebase serves them at /work/nlziet and
 * / (cleanUrls), so the raw pathname was wrong everywhere it was used: every
 * canonical URL ended in .html and disagreed with the sitemap, and the nav
 * never recognised the homepage, so it offered an "Overview" link to the page
 * you were already on. Only the build showed it; the dev server reports '/'.
 */
export function publicPath(pathname: string): string {
	const clean = pathname.replace(/\.html$/, '').replace(/\/index$/, '');
	return clean === '' ? '/' : clean;
}
