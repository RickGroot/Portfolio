import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { getPublishedWork, formatPeriod, type WorkEntry } from './work';
import type { Pigment } from './palette';
import { site } from './site';
import gallery from '../assets/gallery.jpg';
import { socialLinks } from './social';

/**
 * The deck: every card on the page, in order.
 *
 * The order is the DOM order, so it is the reading order and the tab order.
 * Catalogue numbers (RG 001...) come from the index, never from a file: move a
 * card and the numbers follow.
 */

/** A back is the reverse of its object, so each kind has its own shape (see Card.astro). */
export type Link = { label: string; href: string };
export type Pair = { label: string; value: string };

interface Base {
	id: string;
	/** "RG 001". */
	number: string;
	/** The accessible name of the card: what is on it. */
	label: string;
	pigment: Pigment;
}

export type WorkCard = Base & {
	kind: 'tape' | 'listing' | 'sleeve' | 'cast';
	title: string;
	role: string;
	period: string;
	/** Still in service: its listing says "On air" rather than "Rerun". */
	ongoing: boolean;
	tags: string[];
	/** The back: a J-card, a listing's entry, a record's back cover or a TV running the receiver, by kind. */
	back: {
		/** "Hypersolid · 2022". */
		credit: string;
		/** What it is, first person: a listing's line, the cast screen's text, the sleeve's paragraph. */
		blurb?: string | undefined;
		/** The highlights: Side A, the episodes, the queue or the features. */
		built: string[];
		/** Side B or the credits: the stack. Empty when the entry names none. */
		stack: Pair[];
		/** The sleeve's honest note. */
		note?: string | undefined;
		links: Link[];
	};
	/** Absent when the card draws its art in CSS (Chromecast): then there is no alt either. */
	cover?: ImageMetadata | undefined;
	coverAlt?: string | undefined;
};
export type PlayerCard = Base & {
	kind: 'player';
	name: string;
	facts: { label: string; value: string }[];
	photo: ImageMetadata;
	photoAlt: string;
	tagline: string;
	/** The trading card's back. */
	back: { bio: string; stats: Pair[]; record: { title: string; years: string }[] };
};
export type SlideCard = Base & {
	/** A 35mm slide in its mount, or a polaroid. */
	kind: 'slide' | 'polaroid';
	title: string;
	caption: string;
	image: ImageMetadata;
	alt: string;
	/** The mount's label: only what is known. `note` is the caption, used when nothing else is known. */
	back: {
		place?: string | undefined;
		date?: string | undefined;
		credit?: string | undefined;
		/** A slide: the caption, used when nothing else is known. A polaroid: its handwritten line. */
		note?: string | undefined;
	};
};
export type LinerCard = Base & {
	kind: 'liner';
	title: string;
	items: { number: string; title: string; body: string }[];
};
export type TicketCard = Base & {
	kind: 'ticket';
	title: string;
	links: Link[];
};
export type ArticleCard = Base & {
	/** A clipping: an article I wrote, linked, never embedded. */
	kind: 'article';
	title: string;
	topic: string;
	standfirst: string;
	/** "Oct 2026", on the front. */
	month: string;
	/** "23 Oct 2026", on the back. */
	date: string;
	minutes: number;
	points: string[];
	url: string;
};
export type Card = WorkCard | PlayerCard | SlideCard | LinerCard | ArticleCard | TicketCard;

/** Omit that distributes over the union, so each card keeps its own fields. */
type Unnumbered<T> = T extends unknown ? Omit<T, 'number'> : never;

const pad = (n: number): string => String(n).padStart(3, '0');

function workCard(e: WorkEntry): Omit<WorkCard, 'number'> {
	const d = e.data;
	const period = formatPeriod(e);
	return {
		id: e.id,
		kind: d.format,
		label: d.title,
		pigment: d.pigment,
		title: d.title,
		role: d.role,
		period,
		ongoing: d.status === 'ongoing',
		tags: d.tags,
		cover: d.cover,
		coverAlt: d.coverAlt,
		back: {
			credit: `${d.company} · ${period}`,
			blurb: d.blurb,
			built: d.built ?? [],
			stack: d.stack ?? [],
			note: d.note,
			links: d.links,
		},
	};
}

function slideCard(s: CollectionEntry<'slides'>): Omit<SlideCard, 'number'> {
	const d = s.data;
	const polaroid = d.format === 'polaroid';
	return {
		id: s.id,
		kind: d.format,
		label: `${polaroid ? 'Polaroid' : 'Slide'}: ${d.title}`,
		pigment: d.pigment,
		title: d.title,
		caption: d.caption,
		image: d.image,
		alt: d.alt,
		back: {
			// "Where: Prague" under the title "Prague" says nothing twice.
			place: !polaroid && d.place === d.title ? undefined : d.place,
			date: d.date,
			credit: d.credit,
			// A slide with no place or date has only its caption to say; a polaroid its own line.
			note: polaroid ? d.note : d.place || d.date ? undefined : d.caption,
		},
	};
}

// In UTC: the date is a calendar day, and the build machine's zone must not move it.
const day = (d: Date, opts: Intl.DateTimeFormatOptions): string =>
	d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

function articleCard(a: CollectionEntry<'articles'>): Omit<ArticleCard, 'number'> {
	const d = a.data;
	return {
		id: a.id,
		kind: 'article',
		label: `Article: ${d.title}`,
		pigment: d.pigment,
		title: d.title,
		topic: d.topic,
		standfirst: d.standfirst,
		month: day(d.date, { month: 'short', year: 'numeric' }),
		date: day(d.date, { day: 'numeric', month: 'short', year: 'numeric' }),
		minutes: d.minutes,
		points: d.points,
		url: d.url,
	};
}

export async function getDeck(): Promise<Card[]> {
	const [work, slides, articles, practice, players] = await Promise.all([
		getPublishedWork(),
		getCollection('slides'),
		getCollection('articles'),
		getCollection('practice'),
		getCollection('player'),
	]);
	const rick = players[0];
	if (!rick) throw new Error('deck: src/content/player.yaml has no player card.');

	// The middle of the deck: work, then How I work, with the photographs and
	// the article clippings woven in at the places their `order` names (1 =
	// right after the player). A place past the end just goes last; the work
	// keeps its own order.
	const fillers: Unnumbered<Card>[] = [
		...work.map(workCard),
		{
			id: 'how-i-work',
			kind: 'liner',
			label: 'How I work',
			pigment: 'green',
			title: 'How I work',
			items: practice
				.sort((a, b) => a.data.order - b.data.order)
				.map((p) => ({
					number: String(p.data.order).padStart(2, '0'),
					title: p.data.title,
					body: p.data.body,
				})),
		},
	];
	const middle: Unnumbered<Card>[] = [];
	const placed = [
		...slides.map((s) => ({ order: s.data.order, card: slideCard(s) })),
		...articles.map((a) => ({ order: a.data.order, card: articleCard(a) })),
	].sort((a, b) => a.order - b.order);
	for (const { order, card } of placed) {
		// Fill the places before this one from the work, then put the card down.
		while (middle.length < order - 1 && fillers.length > 0) middle.push(fillers.shift()!);
		middle.push(card);
	}
	middle.push(...fillers);

	const cards: Unnumbered<Card>[] = [
		{
			id: 'rick',
			kind: 'player',
			label: rick.data.name,
			pigment: 'orange',
			name: rick.data.name,
			facts: rick.data.facts,
			photo: gallery,
			photoAlt:
				'Rick, smiling in a cap and glasses, in front of an artist’s work in a white-walled gallery in Prague.',
			tagline: site.tagline,
			back: {
				bio: rick.data.bio,
				stats: rick.data.facts,
				// Generated from the deck, so a new work card appears here by itself.
				record: work.map((e) => ({
					title: e.data.title,
					years: e.data.status === 'ongoing' ? `since ${e.data.period}` : e.data.period,
				})),
			},
		},
		...middle,
		{
			id: 'contact',
			kind: 'ticket',
			label: 'Contact',
			pigment: 'yellow',
			title: 'Get in touch',
			links: socialLinks.map(({ label, href }) => ({ label, href })),
		},
	];

	return cards.map((c, i) => ({ ...c, number: `RG ${pad(i + 1)}` }));
}
