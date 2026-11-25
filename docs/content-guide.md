# Content guide

All public work content lives in `src/content/work/*.md`. **No content lives in `.ts` files.**

## Adding a work item

1. Copy `src/content/work/_template.md`.
2. Rename it — **the filename becomes the URL slug**.
3. Fill in every field. The build fails on anything missing or malformed, which is the point.

## The one rule that decides where copy appears

> **Every non-draft work entry is a card on the table. Its back is the case study.**

There are no sub-pages: `/work` and `/work/**` are 301 redirects to `/` in `firebase.json`. The
card's front is a short pitch (title, meta, one picture); its back is the other side of the object
(`built`, `stack`, `blurb`, `note` and its links; the `summary` is not rendered). Cards keep `order`, which also sets their catalogue number
(`RG 002`...). The deck is the work cards plus the player, How I work, the photographs (slides and polaroids,
woven between the work by their `order`) and the ticket (`src/lib/deck.ts`).

Other card content lives beside work: `src/content/player.yaml` (the masthead card),
`src/content/practice.yaml` (How I work, the liner notes), `src/content/slides/*.md` (the
photographs) and `src/content/articles.yaml` (my Medium articles, as clippings).

An article card only links out: nothing is loaded from Medium. Its `title` is the article's own;
the `standfirst` (≤ 140) and the three `points` (≤ 110 each) are short summaries in my own words,
never quotes. `minutes` is the read time Medium shows, and `order` works as it does for a slide.

## Fields

| Field      | Rule                                                 | Why the rule exists                                                              |
| ---------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `title`    | ≤ 60 chars                                           | Past 60 the card wraps and the search-result title truncates.                    |
| `role`     | ≤ 60 chars                                           | Rendered in the meta line, so the prose does not have to repeat it.              |
| `company`  | `Hypersolid` or `Independent`                        | An enum costs nothing and prevents `hypersolid` / `Hypersolid ` drift.           |
| `period`   | `2023` or `2022–2025` (en dash)                      | First-to-last year of involvement. **See the note below.**                       |
| `status`   | `ongoing` or `completed`                             | `ongoing` renders as "Ongoing since 2022". See below.                            |
| `summary`  | 50–180 chars                                         | Not rendered on the one-page site; the one-line pitch, kept for reuse.           |
| `tags`     | 1–4 items                                            | The card layout breaks past four.                                                |
| `format`   | `tape`, `listing`, `sleeve`, `cast`                  | Which card it is printed as. See `docs/card-system.md`.                          |
| `pigment`  | a palette name                                       | The card's flat colour. A name, not a hex: every pigment is contrast-solved.     |
| `cover`    | A cropped app screen, optional                       | Printed in the card's pigment (`.print`). A cast has none: it draws its own art. |
| `coverAlt` | Required with a cover, else none                     | **Describe what is actually in the image.** See below.                           |
| `built`    | 2–6 lines (a cast: 2–5), ≤ 48                        | The back's highlights: not everything, what I am proud of. Required.             |
| `stack`    | ≤ 6 label/value pairs, optional                      | Side B of a tape, a sleeve's credits. Falls back to `tags`.                      |
| `blurb`    | first person; listing ≤ 80, cast ≤ 160, sleeve ≤ 320 | The back's explanation. Required for a `listing`, a `cast` and a `sleeve`.       |
| `note`     | ≤ 160 chars, sleeves only                            | The honest note on the record's back cover. Required for a `sleeve`.             |
| `links`    | ≤ 3                                                  | More than three and nobody clicks any of them.                                   |
| `order`    | integer                                              | Hand ordering on the table; also the catalogue number.                           |
| `draft`    | boolean                                              | Use this to unpublish. **Never delete, never comment out.**                      |

### The back of a card

A back is the reverse of its object (see "Backs" in `docs/card-system.md`), so `built`, `stack`,
`blurb` and `note` are the lines printed on it. Write each only from facts the entry already
states, never numbers, platforms or clients it does not, and keep the `# COPY CHECK` comment above
a new field until the owner confirms it. The markdown body is working notes and is not rendered.

Write every back in the first person, as me. `built` is labelled as highlights ("Side A ·
highlights", "Highlights", or "Up next" on a cast), so write the few things worth showing, not a
full inventory.

Slides take optional `place`, `date` and `credit`: the label written on the mount's back. Only
what is known; a missing field is simply not printed. They also take:

| Field    | Rule                               | Meaning                                                               |
| -------- | ---------------------------------- | --------------------------------------------------------------------- |
| `format` | `slide` (default) or `polaroid`    | A 35mm slide, or a polaroid with a caption and a strip of tape.       |
| `note`   | ≤ 80 chars, optional, first person | A line on the back. On a polaroid it is the inscription.              |
| `order`  | positive integer                   | Position in the middle of the deck (1 = first card after the player). |

`player.yaml` has a required `bio` (≤ 200 chars, first person): the line on the masthead's back. `facts` print under the photograph; the first one (Status: Open to work) is the strip on the photo, so keep work and off-duty facts apart and update it when he is no longer looking.

### Dates: `period` + `status`, not a range

Client work at Hypersolid is project-based and runs **intermittently**. A bare range like `2022–2025`
would imply continuous engagement that did not happen, so `status: ongoing` renders as
_"Ongoing since 2022"_ rather than _"2022–present"_, and the card's back says engagements run intermittently.

Use the real first and last years. Do not invent dates to fill the field.

### Alt text must describe the image, not the project

Covers are crops of Rick's own screenshots, so describe the screen (what is on it), not the project.
A cover and its alt go together; a card with no cover has no alt.

### Image rights

Before setting `draft: false`, confirm you have the right to publish the cover.

**This has already caught one entry.** The NOS cover supplied with the original content is an ANP
Kippa press photograph carrying a visible credit line. A press-agency photo cannot be republished on
a portfolio without a licence, so NOS was held back on image rights until 2026-09-25, when it went
live with a cover made from Rick's own screenshot. Its copy was never the problem.
The NH Nieuws cover needs the same check.

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
