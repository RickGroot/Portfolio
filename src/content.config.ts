import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { CHANNELS } from './lib/channels';

/**
 * Work collection.
 *
 * Only fields that rendering or editing actually needs are encoded here.
 * Before adding a field, ask whether the page can render without it --
 * it usually can. See docs/content-guide.md for the list of fields we
 * deliberately do not have.
 */
const work = defineCollection({
	// `[^_]*` keeps _template.md out of the collection.
	loader: glob({ base: './src/content/work', pattern: '**/[^_]*.md' }),

	schema: ({ image }) =>
		z
			.object({
				title: z.string().min(1).max(60),
				role: z.string().min(1).max(60),
				company: z.enum(['Triple', 'Independent']),

				/**
				 * First-to-last year of involvement -- NOT a claim of continuous work.
				 * Agency projects run intermittently, so `status` carries the nuance:
				 * `ongoing` renders as "Ongoing since 2022", `completed` renders the
				 * period verbatim. See docs/content-guide.md.
				 */
				period: z.string().regex(/^\d{4}(–\d{4})?$/, 'Use "2023" or "2022–2025" (en dash)'),
				status: z.enum(['ongoing', 'completed']),

				// 180 is the practical <meta name="description"> ceiling.
				summary: z.string().min(50).max(180),

				// The card layout breaks past four.
				tags: z.array(z.string().min(1)).min(1).max(4),

				/**
				 * Which channel the entry is broadcast on: the flat colour field of
				 * its panel on the one-pager and of its case study's hero. A name
				 * from the palette, never a hex value -- every channel's text colour
				 * is solved and contrast-checked in src/lib/channels.ts, and a
				 * free-form colour would bypass that.
				 */
				channel: z.enum(CHANNELS),

				/**
				 * image() emits intrinsic width/height on the <img>, which is what
				 * makes CLS < 0.1 achievable rather than aspirational.
				 *
				 * OPTIONAL IN THE SCHEMA, REQUIRED IN PRACTICE -- see the superRefine
				 * below, which rejects any non-draft entry without one.
				 *
				 * It has to be optional because `image()` creates a build-time
				 * reference: Astro emits the asset for EVERY entry carrying one,
				 * whether or not a page renders it. A draft entry with a cover
				 * therefore ships its image to the CDN, unreferenced by any page but
				 * publicly fetchable. Letting drafts omit it is what keeps them off
				 * the wire. `scripts/check-assets.mjs` gates the regression.
				 */
				cover: image().optional(),
				// An unlabelled image is a build failure, not something the a11y
				// test should be first to notice.
				coverAlt: z.string().min(1).optional(),

				/**
				 * Whether the cover is mostly light or mostly dark. Covers are
				 * printed in their channel's two colours, and a cover whose tone
				 * is the opposite of its field prints as a negative so it comes
				 * out mostly as the field -- a white screenshot on a deep ground
				 * would otherwise be a bright block. This field says what the
				 * picture IS; coverPrint() in src/lib/channels.ts decides what to
				 * do about it, so changing an entry's channel cannot leave a
				 * stale flag behind.
				 */
				coverTone: z.enum(['light', 'dark']).default('dark'),

				links: z
					.array(z.object({ label: z.string().min(1), href: z.url() }))
					.max(3)
					.default([]),

				// The order programmes take on the guide, and their channel numbers.
				order: z.number().int().nonnegative(),

				// Replaces commenting entries out. Filtered from every getCollection.
				draft: z.boolean().default(false),
			})
			.superRefine((data, ctx) => {
				// The guarantee lives here rather than on the field, so a draft can
				// stay imageless (and therefore un-shipped) while anything that
				// actually renders still cannot go out without a labelled cover.
				if (data.draft) return;

				if (!data.cover) {
					ctx.addIssue({
						code: 'custom',
						path: ['cover'],
						message:
							'A published entry needs a cover. Add one, or set `draft: true` while it has none.',
					});
				}
				if (!data.coverAlt) {
					ctx.addIssue({
						code: 'custom',
						path: ['coverAlt'],
						message: 'A published entry needs coverAlt describing what is actually in the image.',
					});
				}
			}),
});

export const collections = { work };
