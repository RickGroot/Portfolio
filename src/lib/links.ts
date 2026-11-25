/**
 * Where a link goes. A page on another site opens in a new tab, and from the
 * installed app (the manifest is `standalone`, scope `/`) a `target="_blank"`
 * link out of scope opens in the browser rather than inside the app window.
 * mailto: and links on this site stay as they are.
 *
 * Every link that opens a tab says so to a screen reader through
 * `aria-describedby`, pointing at the one hidden note in BaseLayout, so its
 * accessible name stays the label printed on it.
 */
const SITE = new URL(import.meta.env.SITE ?? 'https://rickgroot.nl');

/** The id of the hidden "Opens in a new tab" note in BaseLayout. */
export const NEW_TAB = 'new-tab';

export function isExternal(href: string): boolean {
	if (!/^https?:\/\//i.test(href)) return false;
	return new URL(href).host !== SITE.host;
}

/** The attributes an anchor to `href` needs: none for one that stays on the site. */
export function linkProps(href: string): {
	target?: '_blank';
	rel?: 'noopener';
	'aria-describedby'?: string;
} {
	return isExternal(href) ? { target: '_blank', rel: 'noopener', 'aria-describedby': NEW_TAB } : {};
}
