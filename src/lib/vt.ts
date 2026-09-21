/**
 * view-transition-name builder.
 *
 * A SINGLE duplicated name in a document makes the browser skip the entire
 * transition, silently. Names are therefore always derived from an entry id and
 * sanitised into a valid CSS ident -- today's ids are safe, but a future
 * `nos-2024.md` or `foo.bar.md` would not be.
 */
export const vt = (prefix: string, id: string): string =>
	`${prefix}-${id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
