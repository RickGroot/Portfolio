// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// NOTE: no ClientRouter, deliberately (CLAUDE.md, prohibition 4).
// Static output means every navigation is a fresh document, so the table
// script's listeners and observers can never outlive their page.
export default defineConfig({
	site: 'https://rickgroot.nl',

	// `format: 'file'` emits dist/404.html, which Firebase serves for a missing
	// page; with `cleanUrls: true` and trailingSlash 'never' every URL is
	// canonical with ZERO redirects on the happy path. Changing either one
	// without the other costs a 301 on every page load.
	trailingSlash: 'never',
	build: { format: 'file', inlineStylesheets: 'auto' },

	// The 404 and any /design/* prototype stay out of the sitemap.
	integrations: [
		sitemap({ filter: (page) => !page.includes('/404') && !page.includes('/design/') }),
	],

	image: { responsiveStyles: true },

	prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

	// esbuild, not Lightning CSS, minifies the CSS. Lightning CSS folds
	// `animation-timeline` into the `animation` shorthand
	// (`animation: linear both reveal view()`), which no browser accepts: the
	// declaration is dropped, so a scroll-driven animation silently never runs
	// in a production build while working in `astro dev`, which does not
	// minify. The card site has none today; this keeps the trap shut.
	vite: { build: { cssMinify: 'esbuild' } },
});
