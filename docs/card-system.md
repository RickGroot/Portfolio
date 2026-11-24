# The card system

The site is one page: a table with loose cards on it. Each card is a physical object (a tape, a
record sleeve, a slide), one flat pigment, a hard shadow. Click or press Enter and it turns over;
the back is the case study. A quiet corner mark (`.turn .corner`) and the pointer cursor say a card
turns; the page prints no instruction. Decided by Rick, 2026-11-23, layout "A, the table". The old site
(TV channels) is commit 97ef1ec.

## Tokens

- **Ground:** light paper only. No dark theme, no switch.
- **Palette** (`src/lib/palette.ts`, the one source): paper, card, ink, and five pigments: yellow,
  orange, red, blue, green. Emitted as custom properties on `<html>`. No hex in CSS; tints are
  `color-mix` on these.
- **Pigment:** each card sets `--field` and `--on-field`. `solve()` picks ink or card paper, whichever
  has the better contrast, and **throws below 4.5:1**, so a bad pigment stops the build.
  `tests/a11y/palette.spec.ts` also pins `manifest.webmanifest` and `favicon.svg` to the palette.
- **Shape:** radius 0 (only records, reels and dots are round), one 2px ink rule, a hard 6px offset
  shadow on its own element that never flips, paper grain.
- **Type:** Archivo (wide-condensed 900, capitals) for titles, sized in `cqw` so a title fits its card;
  Instrument Sans for reading; JetBrains Mono for catalogue numbers and labels. All self-hosted.

## Formats

| Format   | Used for               | Idle motion             |
| -------- | ---------------------- | ----------------------- |
| player   | Rick (the masthead)    | the record light blinks |
| tape     | NLZIET, KIJK, Streamz  | the reels spin          |
| listing  | NOS, Sleeve            | the progress bar fills  |
| cast     | Chromecast             | the cast arcs send      |
| sleeve   | VAMP (a record behind) | the record turns        |
| liner    | How I work             | notes type in           |
| slide    | a 35mm photograph      | a small wobble          |
| polaroid | a snapshot (Prague)    | none                    |
| article  | a Medium article       | none                    |
| ticket   | Get in touch, 404      | the stub kicks out      |

`src/lib/deck.ts` builds the deck from content (the work entries carry `format` and `pigment`);
`src/components/Card.astro` renders any card; `formats.css` holds the format art, `card.css` the
frame, flip and back, `table.css` the layout.

## Structure of one card

`.slot` (aspect-ratio, perspective, a size container) holds `.shadow`, `.tilt` and `.flip`, which holds
the `.front` and `.back` faces. Everything inside is sized in `cqw`. Each card leans a little through
`--rot`, `--ox`, `--oy` (individual `rotate` and `translate`, so the deal's WAAPI `transform`
composes with them) and `--dx`, `--dy` from dragging.

Layout is CSS multi-column, so DOM order is both reading order and tab order. Below 820px it is one
tidy column: the lean stays, drag goes.

## Covers

A work card's cover is the app's own screen, a crop of Rick's screenshot, printed in the card's
pigment: `.print` in `formats.css` greyscales it, multiplies it over `--field` and lays a halftone of
ink dots on top. Tape, listing and sleeve fronts all use it. A listing with no cover (Chromecast)
has none: the `cast` format draws its own art (below). Provenance is in `src/assets/IMAGES.md`.

## Backs

Every back is the reverse of its object, in the same flat print, so it adds something the front
does not. The frame is shared (`.card.back > .bh.meta` with the "Turn back" button and number,
then the `.bb` body; `h2` is the title, `h3` the sub-sections, links stay `a.go`). The body differs
by kind, laid out in `card.css` ("the backs"):

| Kind     | The back is                                                                                                                                            | Fed by                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| tape     | a cassette J-card: spine with the catalogue number, Side A (tracks), Side B (stack, or the topics when there is no `stack`), fold line                 | `built`, `stack` (else `tags`), company    |
| listing  | a programme-guide entry: a channel and slot band, blurb, then episodes in time-slot cells                                                              | `blurb`, `built`                           |
| sleeve   | a record's back cover: a first-person `blurb` paragraph, the highlights as a compact list, credits, the honest note, links                             | `blurb`, `built`, `stack`, `note`, `links` |
| slide    | a cardboard mount: a pigment plate with the title, and a hand-written label of what is known (place, date, photo credit, else the caption)             | `place`, `date`, `credit` (all optional)   |
| player   | a trading card: bio, the facts as stats, a track record of the work cards                                                                              | `site.description`, `player.yaml`, deck    |
| cast     | a TV running the receiver: a splash that resolves into a now-playing screen (title, blurb, the highlights as the up-next queue, a progress bar, links) | `blurb`, `built`, `links`                  |
| polaroid | the back of a print: where, when, who took it, a note                                                                                                  | `place`, `date`, `credit`, `note`          |
| liner    | the full principles, in a scrolling region (unchanged)                                                                                                 | `practice.yaml`                            |
| article  | a newspaper clipping: a byline strip (date, read time), the headline, "In short" with three points, and one link out to Medium                         | `articles.yaml`                            |
| ticket   | none: it carries its links on its front (see Ticket)                                                                                                   |                                            |

The back lines of a work card are drafted from that entry's own notes and carry a
`# COPY CHECK` comment until Rick confirms them. Keep each list to 3-5 short items: a back has a
fixed height and must not scroll. Back body text is at least 10.5px and mono labels at least 9px
(`max(10.5px, Ncqw)`); only the liner scrolls. A listing is 5:4, and in the narrow column a tape is
4:3, so the text still fits; at 360px and below a tape is 6:5, a listing 10:9 and the sleeve takes
the full column. Without JavaScript every back lies
under its front, in full.

The `built` list is labelled as highlights, never "what I built": "Side A · highlights" on a tape,
"Highlights" on a listing and a sleeve, "Up next" on a cast. All hardcoded back copy is first person.

## Cast

The front is the sender: a drawn phone with the cast mark, its arcs sending. Turning the card is the
cast. The back is the TV: `.splash` (the receiver's cast screen) shows for about 2s after the flip,
then `.np` (now playing) arrives and `.played` fills like a progress bar. All CSS, started by
`.is-flipped`, none under reduced motion (the global rule), none while the card is off screen or the
table is still (`.still` removes the splash and holds the finished screen).

## Ticket

"Get in touch" is a ticket marked "Good for one conversation". Its stub is a real button
(`.tear`, "Tear off the stub to see how to reach me"). With JavaScript the actions (Email, a "Copy
address" button, LinkedIn, GitHub) are sealed until it is torn off; `table.ts` adds `.is-torn` and
moves focus to the first action. Copying writes to the clipboard and says "Copied" on the button and
in `.copied` (`role=status`, `aria-live=polite`); with no clipboard it prints the address to copy by
hand. Every control is at least 44px tall with 12px text. Without JavaScript the links are simply
there and the stub is hidden. The 404's ticket has no stub to tear and keeps its links on its face.

## The bar

Above the table: Email, LinkedIn, GitHub (from `src/lib/social.ts`) as real links, and "Pause
motion", in one chip style (40px; 44px below 820px). The links work without JavaScript.

On a card back, the links and "Turn back" stay at their printed size; on touch and below 600px an
invisible `::after` round each one makes the touch target 44px tall. That keeps a full back, like
VAMP's sleeve, from scrolling just because its buttons grew.

## Deck order

Work cards are ordered by `order`. Slides, polaroids and article clippings are woven in by their
`order`, which is a position in the middle of the deck (1 = the first card after the player). How I work trails the
work; the ticket is last.

## Motion

- **Deal** on load: WAAPI, 520ms, 70ms stagger, only for cards above the fold.
- **Tilt** with the pointer, at most 7 degrees, with a gloss. Mouse only.
- **Flip** 620ms. **Drag** after 5px; a drag never counts as a click.
- **Idle loops** are CSS and pause when the card is offscreen (`IntersectionObserver` toggles
  `.is-off`).
- **Reduced motion:** everything still, no deal, an instant flip. `tests/a11y/a11y.spec.ts` asserts
  no animation is running.
- There is no `requestAnimationFrame` anywhere in `src` (ESLint enforces it) and no canvas.
  Colour changes are cuts, not fades.

## Accessibility pattern

Nothing interactive is nested in anything interactive.

- The front is covered by one `<button class="turn" aria-pressed>` with visually-hidden text
  "Turn over: <label>".
- The back has a "Turn back" button and real links. Whichever face is turned away is `inert`
  (`src/scripts/table.ts` keeps it in step; without JavaScript the back stays inert and the front
  stays readable).
- Turning moves focus: to the back's button when opening, to the front button when closing. Escape
  turns a card back.
- A visible 3px blue focus ring, a real `<h1>` (the player's name), a skip link, alt text from
  content.
- The liner's back is a scrollable focusable region (`tabindex=0`, labelled), so keyboard users can
  scroll it.

## Adding a card

Add the content (see `docs/content-guide.md`), pick a `format` and `pigment`, run `pnpm build`. A
new format means a front and a back in `Card.astro`, art in `formats.css`, an aspect ratio in the `AR`
map and a width in `formats.css`.
