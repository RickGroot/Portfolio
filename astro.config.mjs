// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// NOTE: no ClientRouter / view transitions, deliberately.
// Static output means every navigation is a fresh document, so a canvas can
// never leak a WebGL context across navigations. Adding ClientRouter later
// re-introduces that whole class of bug -- see docs/performance.md.
export default defineConfig({
	site: 'https://rickgroot.nl',

	// `format: 'file'` emits dist/work/nlziet.html, which Firebase serves at
	// /work/nlziet thanks to `cleanUrls: true`. Together with trailingSlash
	// 'never' this gives canonical URLs with ZERO redirects on the happy path.
	// Changing either one without the other costs a 301 on every page load.
	trailingSlash: 'never',
	build: { format: 'file', inlineStylesheets: 'auto' },

	// /design/* are internal prototypes: noindex, disallowed in robots.txt and
	// kept out of the sitemap. They are tracked for deletion before launch.
	integrations: [
		sitemap({ filter: (page) => !page.includes('/404') && !page.includes('/design/') }),
	],

	image: { responsiveStyles: true },

	prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});
