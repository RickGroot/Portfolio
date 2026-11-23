import js from '@eslint/js';
import globals from 'globals';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
	{
		ignores: [
			'dist/',
			'.astro/',
			'node_modules/',
			'playwright-report/',
			'test-results/',
			'design/',
		],
	},

	js.configs.recommended,
	...ts.configs.recommendedTypeChecked,
	...astro.configs.recommended,

	{
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
			globals: globals.browser,
		},
	},

	{
		/*
		 * astro-eslint-parser cannot resolve the types of JSX-like template
		 * expressions inside .astro files, so the type-aware `no-unsafe-*`
		 * family reports every `.map()` in a template as `type error`.
		 *
		 * These files ARE fully type-checked -- by `astro check`, which uses the
		 * Astro language server and understands the template. Turning these four
		 * rules off here removes false positives without losing coverage.
		 */
		files: ['**/*.astro'],
		languageOptions: { parserOptions: { project: true, projectService: false } },
		rules: {
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
		},
	},

	{
		// The kill-switch service worker runs in a worker scope and is not part
		// of the TS project, so type-aware rules cannot apply to it.
		...ts.configs.disableTypeChecked,
		files: ['public/service-worker.js'],
		languageOptions: { globals: globals.serviceworker },
	},

	{
		// Node scripts run outside the browser.
		...ts.configs.disableTypeChecked,
		files: ['scripts/**/*.mjs'],
		languageOptions: { globals: globals.node },
	},

	{
		/*
		 * Playwright addInitScript bodies are serialised and executed in the
		 * BROWSER, not in Node. Type-aware rules reason about them as if they
		 * ran here, which produces `unbound-method` on prototype captures that
		 * are correct in page context.
		 */
		files: ['tests/**/*.spec.ts'],
		rules: { '@typescript-eslint/unbound-method': 'off' },
	},

	{
		/*
		 * No requestAnimationFrame at all.
		 *
		 * Everything on the table moves by CSS animation, CSS transition or one
		 * WAAPI deal, so the page has no frame loop to keep honest. This is a
		 * real control -- a comment saying 'please do not add a loop' is not.
		 * A loop would have to be a deliberate edit to this block.
		 */
		files: ['src/**/*.ts', 'src/**/*.astro'],
		rules: {
			'no-restricted-globals': [
				'error',
				{
					name: 'requestAnimationFrame',
					message: 'The cards move with CSS and WAAPI. No rAF loop: see CLAUDE.md.',
				},
			],
			'no-restricted-properties': [
				'error',
				{
					object: 'window',
					property: 'requestAnimationFrame',
					message: 'The cards move with CSS and WAAPI. No rAF loop: see CLAUDE.md.',
				},
			],
		},
	},
];
