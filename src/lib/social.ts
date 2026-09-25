import type { Channel } from './channels';

export interface SocialLink {
	label: string;
	href: string;
	/** The channel the link lights up in under the pointer: one each. */
	channel: Channel;
}

/**
 * NOTE: the read.cv link that shipped on the old site was removed, not replaced.
 * read.cv shut down -- https://read.cv/rg returns HTTP 402 -- so it was a dead
 * link in production. A /cv page built from the work collection is the sensible
 * replacement when someone wants one.
 *
 * TODO(rick): confirm the LinkedIn URL. The old README used
 * /in/rick-groot-469777193/ (LinkedIn's auto-generated form) and the unreleased
 * branch used /in/r-groot/ (a chosen vanity URL). The vanity URL is assumed
 * current here because it supersedes the generated one, but it is unverified.
 */
export const socialLinks: readonly SocialLink[] = [
	{ label: 'LinkedIn', href: 'https://www.linkedin.com/in/r-groot/', channel: 'ultramarine' },
	{ label: 'GitHub', href: 'https://github.com/RickGroot', channel: 'ink' },
	{ label: 'Email', href: 'mailto:RickGroot41@gmail.com', channel: 'yellow' },
];
