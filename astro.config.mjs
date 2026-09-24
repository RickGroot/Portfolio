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

	// esbuild, not Lightning CSS, minifies the CSS. Lightning CSS folds
	// `animation-timeline` into the `animation` shorthand
	// (`animation: linear both reveal view()`), which no browser accepts: the
	// declaration is dropped and every scroll-driven animation on the site --
	// reveals, section arrivals, the progress bar, the parallax -- silently
	// never ran in a production build while working in `astro dev`, which does
	// not minify. tests/e2e/motion.spec.ts runs against the build and fails if
	// it comes back.
	vite: { build: { cssMinify: 'esbuild' } },
});
