import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { file, glob } from 'astro/loaders';
import { PIGMENTS } from './lib/palette';

/** The card formats a piece of work can take. The rest of the deck's formats are fixed to one use each. */
export const WORK_FORMATS = ['tape', 'listing', 'sleeve', 'cast'] as const;

/** How long a `blurb` may run, by format: a listing's one line, a cast screen, a sleeve's paragraph. */
export const BLURB_MAX = { listing: 80, cast: 160, sleeve: 320 } as const;

/**
 * Work collection: one card each.
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
				company: z.enum(['Hypersolid', 'Independent']),

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
				 * The shape of its card: a tape, a TV listing, a record sleeve or a cast
				 * (the phone is the front, the TV that receives it is the back). See
				 * docs/card-system.md for what each one prints.
				 */
				format: z.enum(WORK_FORMATS),

				/**
				 * The flat field its card is printed on. A name from the palette, never
				 * a hex value: every pigment's text colour is solved and contrast-checked
				 * in src/lib/palette.ts, and a free-form colour would bypass that.
				 */
				pigment: z.enum(PIGMENTS),

				/**
				 * The app's own screen, cropped, printed in the card's pigment (see
				 * src/styles/formats.css). image() emits intrinsic width/height on the
				 * <img>, which is what makes CLS < 0.1 achievable rather than aspirational.
				 *
				 * OPTIONAL: a card with no screen to show (Chromecast, a receiver with
				 * no interface) draws its art in CSS instead, and then has no alt text,
				 * because there is no image. A cover and its coverAlt go together: the
				 * superRefine below rejects one without the other.
				 *
				 * It is also what keeps a draft's image off the wire: `image()` creates
				 * a build-time reference, so Astro emits the asset for EVERY entry
				 * carrying one, rendered or not. `scripts/check-assets.mjs` gates that.
				 */
				cover: image().optional(),
				// An unlabelled image is a build failure, not something the a11y
				// test should be first to notice.
				coverAlt: z.string().min(1).optional(),

				/**
				 * The back of the card is the reverse of its object (docs/card-system.md,
				 * "Backs"), and these are its lines. Each is drafted from the entry's own
				 * notes and carries a COPY CHECK comment until Rick confirms it.
				 *
				 * built: 2-6 short lines (a cast: 2-5) of highlights: what I am proud of, in
				 *   the first person where it is a sentence. Printed as "Side A · highlights",
				 *   "Highlights" or the cast's "Up next". Required on a published entry.
				 * stack: label/value pairs for Side B and the sleeve's credits. Optional;
				 *   the back falls back to `tags`.
				 * blurb: first person, what it is. A listing's one line (<= 80), a cast's
				 *   now-playing text (<= 160), a sleeve's explanation paragraph (<= 320).
				 *   Required for a listing, a cast and a sleeve.
				 * note: the sleeve's honest note. Required for a sleeve.
				 */
				built: z.array(z.string().min(1).max(48)).min(2).max(6).optional(),
				stack: z
					.array(z.object({ label: z.string().min(1).max(12), value: z.string().min(1).max(40) }))
					.min(1)
					.max(6)
					.optional(),
				blurb: z.string().min(1).max(320).optional(),
				note: z.string().min(1).max(160).optional(),

				links: z
					.array(z.object({ label: z.string().min(1), href: z.url() }))
					.max(3)
					.default([]),

				// The order work takes in the deck, and so its catalogue numbers.
				order: z.number().int().nonnegative(),

				// Replaces commenting entries out. Filtered from every getCollection.
				draft: z.boolean().default(false),
			})
			.superRefine((data, ctx) => {
				if (!data.draft) {
					const need = (ok: unknown, path: string, why: string) => {
						if (!ok) ctx.addIssue({ code: 'custom', path: [path], message: why });
					};
					need(
						data.built,
						'built',
						'A published entry needs `built`: the lines on the back of its card.',
					);
					need(
						!['listing', 'cast', 'sleeve'].includes(data.format) || data.blurb,
						'blurb',
						'A listing, a cast and a sleeve need a `blurb`.',
					);
					if (data.blurb && data.format in BLURB_MAX) {
						const max = BLURB_MAX[data.format as keyof typeof BLURB_MAX];
						need(
							data.blurb.length <= max,
							'blurb',
							`A ${data.format}'s blurb is at most ${max} characters; this one is ${data.blurb.length}.`,
						);
					}
					need(
						data.format !== 'cast' || (data.built?.length ?? 0) <= 5,
						'built',
						'A cast shows its highlights as an up-next queue: at most 5.',
					);
					need(data.format !== 'sleeve' || data.note, 'note', 'A sleeve needs its honest `note`.');
				}
				if (data.cover && !data.coverAlt) {
					ctx.addIssue({
						code: 'custom',
						path: ['coverAlt'],
						message: 'A cover needs coverAlt describing what is actually in the image.',
					});
				}
				if (!data.cover && data.coverAlt) {
					ctx.addIssue({
						code: 'custom',
						path: ['coverAlt'],
						message: 'coverAlt without a cover: there is no image to describe. Remove it.',
					});
				}
			}),
});

/**
 * How I work: the principles on the one-pager, one file, in `order`.
 *
 * A proof is required: it is the concrete, checkable detail that stops a
 * principle being a slogan. The copy's own notes are at the top of the file.
 */
const practice = defineCollection({
	loader: file('./src/content/practice.yaml'),
	schema: z.object({
		order: z.number().int().positive(),
		title: z.string().min(1).max(60),
		body: z.string().min(1),
		proof: z.string().min(1),
	}),
});

/**
 * Slides: photographs, one card each. An unlabelled image is a build failure.
 */
const slides = defineCollection({
	loader: glob({ base: './src/content/slides', pattern: '**/[^_]*.md' }),
	schema: ({ image }) =>
		z.object({
			title: z.string().min(1).max(40),
			image: image(),
			alt: z.string().min(1),
			/** A 35mm `slide` in a cardboard mount, or a `polaroid` (white border, caption on the bottom margin). */
			format: z.enum(['slide', 'polaroid']).default('slide'),
			caption: z.string().min(1).max(40),
			/** The handwriting on the back of the mount or the photo. Only what is known: each is optional. */
			place: z.string().min(1).max(40).optional(),
			date: z.string().min(1).max(40).optional(),
			/** First person on a polaroid: "Me". */
			credit: z.string().min(1).max(40).optional(),
			/** A polaroid's one handwritten line on the back, in the first person. */
			note: z.string().min(1).max(80).optional(),
			pigment: z.enum(PIGMENTS),
			/**
			 * Where the photograph lies in the middle of the deck (1 = first card after
			 * the player). The work cards and How I work fill the other places in their
			 * own order, so photographs sit between work instead of in a heap.
			 */
			order: z.number().int().positive(),
		}),
});

/** The player card: Rick, the first card of the deck. */
const player = defineCollection({
	loader: file('./src/content/player.yaml'),
	schema: z.object({
		name: z.string().min(1),
		/** The back of the trading card: first person, one or two sentences. */
		bio: z.string().min(1).max(200),
		facts: z
			.array(z.object({ label: z.string().min(1).max(8), value: z.string().min(1).max(40) }))
			.min(1)
			.max(4),
	}),
});

export const collections = { work, practice, slides, player };
