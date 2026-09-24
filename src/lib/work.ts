import { getCollection, type CollectionEntry } from 'astro:content';

export type WorkEntry = CollectionEntry<'work'>;

/**
 * An entry that is actually rendered.
 *
 * `cover`/`coverAlt` are optional on the raw schema so that drafts can omit them
 * -- a draft carrying an `image()` reference would ship that asset to the CDN
 * even though no page renders it. The schema's superRefine guarantees both are
 * present on anything not marked draft, so every consumer downstream of
 * getPublishedWork() can rely on them.
 */
export type PublishedWorkEntry = WorkEntry & {
	data: WorkEntry['data'] & {
		cover: NonNullable<WorkEntry['data']['cover']>;
		coverAlt: string;
	};
};

/**
 * Renders the period honestly.
 *
 * Client work at Hypersolid is project-based and runs intermittently, so a bare
 * range like "2022–2025" would imply continuous engagement that did not happen.
 * `ongoing` therefore reads as "Ongoing since 2022" rather than "2022–present".
 */
export function formatPeriod(entry: WorkEntry): string {
	const { period, status } = entry.data;
	return status === 'ongoing' ? `Ongoing since ${period}` : period;
}

/** Every publishable entry, in author-defined order. Drafts never escape this. */
export async function getPublishedWork(): Promise<PublishedWorkEntry[]> {
	const entries = await getCollection('work', ({ data }) => !data.draft);

	// Backstop, not the primary gate -- the schema's superRefine should already
	// have failed the build. If this ever throws, the schema has been loosened.
	for (const entry of entries) {
		if (!entry.data.cover || !entry.data.coverAlt) {
			throw new Error(
				`Published work entry "${entry.id}" has no cover or coverAlt. ` +
					`The schema in src/content.config.ts should have rejected this.`,
			);
		}
	}

	return (entries as PublishedWorkEntry[]).sort((a, b) => a.data.order - b.data.order);
}
