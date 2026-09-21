import { getCollection, type CollectionEntry } from 'astro:content';

export type WorkEntry = CollectionEntry<'work'>;

/**
 * Renders the period honestly.
 *
 * Client work at Triple is project-based and runs intermittently, so a bare
 * range like "2022–2025" would imply continuous engagement that did not happen.
 * `ongoing` therefore reads as "Ongoing since 2022" rather than "2022–present".
 */
export function formatPeriod(entry: WorkEntry): string {
	const { period, status } = entry.data;
	return status === 'ongoing' ? `Ongoing since ${period}` : period;
}

/** Every publishable entry, in author-defined order. Drafts never escape this. */
export async function getPublishedWork(): Promise<WorkEntry[]> {
	const entries = await getCollection('work', ({ data }) => !data.draft);
	return entries.sort((a, b) => a.data.order - b.data.order);
}

/** The subset that earns a dedicated page at /work/<slug>. */
export async function getFeaturedWork(): Promise<WorkEntry[]> {
	return (await getPublishedWork()).filter((e) => e.data.featured);
}
