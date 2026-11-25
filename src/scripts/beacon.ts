/*
 * The beacon: how the site counts what a visitor does, with no service behind it.
 *
 * Each event is one GET to `/e`, an empty file on this origin, with the event
 * in the query string. Firebase Hosting writes every request to its log, so
 * the log is the whole store: no cookie, no id, nothing kept in the browser
 * and no third-party origin. `docs/analytics.md` says how to read it.
 *
 * An event is sent once per page load, and never for a visitor whose browser
 * sends Global Privacy Control or Do Not Track.
 */

const sent = new Set<string>();

const optedOut = (): boolean =>
	(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
	navigator.doNotTrack === '1';

/** Event names are lower-case words joined by dots; anything else is dropped. */
const clean = (part: string): string => part.toLowerCase().replace(/[^a-z0-9.-]/g, '');

export function mark(event: string, from = ''): void {
	const name = clean(event);
	if (!name || sent.has(name) || optedOut()) return;
	sent.add(name);
	const query = from ? `${name}&r=${clean(from)}` : name;
	// `keepalive` lets the request outlive the page when a link is leaving it.
	void fetch(`/e?c=${query}`, { keepalive: true, cache: 'no-store' }).catch(() => {
		// Offline or blocked: a lost count is not worth a word to the visitor.
	});
}

/** A page view, with the host the visitor came from (never the full address). */
export function view(): void {
	let from = '';
	try {
		const host = new URL(document.referrer).hostname;
		if (host !== location.hostname) from = host;
	} catch {
		// No referrer: a typed address, a bookmark, or a browser that hides it.
	}
	mark('view', from);
}

/** A link that leaves the site: `out.<card or bar>.<host>`, or `.mail`. */
export function leaving(e: Event): void {
	const target = e.target;
	if (!(target instanceof Element)) return;
	const link = target.closest<HTMLAnchorElement>('a[href]');
	if (!link) return;
	let to: string;
	try {
		const url = new URL(link.href);
		if (url.protocol === 'mailto:') to = 'mail';
		else if (url.hostname === location.hostname) return;
		else to = url.hostname.replace(/^www\./, '');
	} catch {
		return;
	}
	const where = link.closest<HTMLElement>('.slot')?.dataset.card ?? 'bar';
	mark(`out.${where}.${to}`);
}
