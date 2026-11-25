export interface SocialLink {
	label: string;
	href: string;
}

/**
 * NOTE: the read.cv link that shipped on the old site was removed, not replaced.
 * read.cv shut down -- https://read.cv/rg returns HTTP 402 -- so it was a dead
 * link in production. A /cv page built from the work collection is the sensible
 * replacement when someone wants one.
 *
 * LinkedIn is the vanity URL, the same one the GitHub profile links to
 * (confirmed 2026-11-25).
 */
export const socialLinks: readonly SocialLink[] = [
	{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/r-groot/' },
	{ label: 'GitHub', href: 'https://github.com/RickGroot' },
	{ label: 'Email', href: 'mailto:RickGroot41@gmail.com' },
];
