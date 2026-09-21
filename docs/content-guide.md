# Content guide

All public work content lives in `src/content/work/*.md`. **No content lives in `.ts` files.**

## Adding a work item

1. Copy `src/content/work/_template.md`.
2. Rename it — **the filename becomes the URL slug**.
3. Fill in every field. The build fails on anything missing or malformed, which is the point.

## The one rule that decides where copy appears

> **`/work` is the complete record: every non-draft entry renders its full body there.
> `featured: true` additionally earns a dedicated page at `/work/<slug>`.**

So an entry that is not featured is not hidden — its full case study still renders inline on
`/work`. Nothing you write is wasted by not being featured.

**Adding a featured page also requires editing the guard in `src/pages/work/[id].astro`.** That
friction is deliberate: a work page should be an explicit, reviewed decision, not something that
happens because a boolean got flipped.

## Fields

| Field      | Rule                            | Why the rule exists                                                           |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `title`    | ≤ 60 chars                      | Past 60 the card wraps and the search-result title truncates.                 |
| `role`     | ≤ 60 chars                      | Rendered in the meta line, so the prose does not have to repeat it.           |
| `company`  | `Triple` or `Independent`       | An enum costs nothing and prevents `triple` / `Triple ` drift.                |
| `period`   | `2023` or `2022–2025` (en dash) | First-to-last year of involvement. **See the note below.**                    |
| `status`   | `ongoing` or `completed`        | `ongoing` renders as "Ongoing since 2022". See below.                         |
| `summary`  | 50–180 chars                    | This becomes the `<meta name="description">`. Write it for a search result.   |
| `tags`     | 1–4 items                       | The card layout breaks past four.                                             |
| `accent`   | 6-digit hex                     | Becomes a CSS custom property, so it must be a real colour.                   |
| `cover`    | ≥ 1600 px wide ideally          | Goes through `astro:assets`, which stamps intrinsic dimensions → CLS control. |
| `coverAlt` | Required, non-empty             | **Describe what is actually in the image.** See below.                        |
| `links`    | ≤ 3                             | More than three and nobody clicks any of them.                                |
| `order`    | integer                         | Deterministic hand ordering.                                                  |
| `draft`    | boolean                         | Use this to unpublish. **Never delete, never comment out.**                   |

### Dates: `period` + `status`, not a range

Client work at Triple is project-based and runs **intermittently**. A bare range like `2022–2025`
would imply continuous engagement that did not happen, so `status: ongoing` renders as
_"Ongoing since 2022"_ rather than _"2022–present"_, and `/work` carries one clarifying line saying
engagements run intermittently.

Use the real first and last years. Do not invent dates to fill the field.

### Alt text must describe the image, not the project

Several covers are **brand logos or stock photography**, not screenshots of the work. Describing
`nlziet.jpg` as "the NLZIET app running on a television" would simply be false — it is a wordmark on
a dark background. Write what a person who cannot see it would need to know.

### Image rights

Before setting `draft: false`, confirm you have the right to publish the cover.

**This has already caught one entry.** The NOS cover supplied with the original content is an ANP
Kippa press photograph carrying a visible credit line. A press-agency photo cannot be republished on
a portfolio without a licence, so NOS is held back on image rights — its copy is fine and unchanged.
The Ajax and NH Nieuws covers need the same check.

Using a client's logo to identify work you did for that client is ordinarily defensible. Republishing
a photographer's press image is not. They are different questions.

## Fields we deliberately do not have

`seo: {}` · `ogImage` (derived from `cover`) · `author` · `category` · `relatedWork` · `gallery` ·
`clientLogo` · `testimonial` · `metrics` · `teamSize` · `duration`.

Content Collections are a schema, not an excuse to recreate a headless CMS badly.

> Before adding a field, ask whether the page can render without it. It usually can.

## What must never appear

Only work cleared for publication appears, anywhere: content, image EXIF and commit messages
included. No placeholders or teases for work that is not here.

Prefer qualitative description over numbers you have not had cleared. A metric can fingerprint a
project even when the project is not named.
