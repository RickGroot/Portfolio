# Roadmap

Direction, not scripture. Each phase ends with a gate you can _run_, not an opinion.

## Status

| Phase                                        | State           |
| -------------------------------------------- | --------------- |
| 1. Foundation                                | **Complete**    |
| 2. Design system, hero & asset pipeline      | **In progress** |
| 3. Chapters & case studies                   | Outline only    |
| 4. Transitions, PWA, SEO, a11y completion    | Outline only    |
| 5. Easter eggs, 404 treatment, cross-browser | Outline only    |
| 6. Real-hardware validation & launch         | Outline only    |

Later phases are deliberately outlines. They get expanded against the real repository state when
their turn arrives — not guessed at today.

> **The WebGL renderer phase is gone.** It was Phase 3 and no longer exists. The signature "Decode"
> treatment renders as text in two `<pre>` elements, so `ogl`, `motion`, the shared GL context, the
> quality governor, the `potato`/`thin`/`steady`/`full` tiers, context-loss handling and build-time
> poster generation were all cut. They existed to serve an effect a string assignment produces. The
> whole art system measures **2.9 KB gzip** against the 25 KB that renderer would have taken on its
> own. Later phases are renumbered accordingly.

---

## Phase 1 — Foundation ✅

Replaced SvelteKit 1 with Astro 7. Content collections with real work copy, deep-linkable routes,
CI quality gates, and the service-worker kill switch.

## Phase 2 — Design system, hero & asset pipeline — IN PROGRESS

**This phase must be shippable on its own.**

### The Channels redesign (2026-09-24)

Rick: _"the app feels too static and too dark."_ The visual layer is being replaced with one idea:
the one-pager is a television, and each full-screen section is a **channel** — its own flat colour
field, its own number. Delivered in stages, each ending with Rick's review.

| Stage                                                                    | State                     |
| ------------------------------------------------------------------------ | ------------------------- |
| 1. Colour and type — channels, duotone photos, Martian Mono, hard edges  | **Done**                  |
| 1b. The programme guide — work, case studies, no header, deep grounds    | **Done**                  |
| 2. Channels on the DOM — readout, static, decode, depth; number keys     | **Part done — in review** |
| 3. Renderer core, proven on one image (canvas rule 0 → ≤ 1, same commit) | —                         |
| 4. The ASCII hero — colour portrait, lens, velocity scatter              | —                         |
| 5. Generalise — every panel, interludes, VAMP pulse, GPU wipe            | —                         |
| 6. Polish and clean-up — delete `/design/type` and `fonts/proto/`        | —                         |

**Stage 2, part one: motion (2026-09-24).** Rick: _"Can you add more parallax scrolling effects and
animations when switching channels?"_

- **Depth** (`src/styles/depth.css`): every section's layers ride a scroll-driven view timeline at
  their own depth — the name in two planes, the picture behind, the copy in front. Every depth is
  0 at rest, so a settled channel is exactly its layout. Phones move the pictures only; reduced
  motion moves nothing. A case study sinks away in layers as it scrolls.
- **Changing channel** (`src/scripts/zap.ts`): a burst of static with a roll bar, the on-screen
  readout (`02 GUIDE`), and the headline decoding in (`src/lib/decode.ts`, on the one loop). A step
  through the guide wipes the next channel's ground in, rolls the picture and decodes the title;
  a page transition zaps.
- Still to do in this stage: number keys, and the planned instant cut behind a full-cover wipe.
- Found on the way: **Lightning CSS folded `animation-timeline` into the `animation` shorthand**,
  which is invalid, so every scroll-driven animation in the production build — the reveals, the
  arrivals, the progress bar — was silently dead. CSS is now minified by esbuild. And `measure()`
  read `scrollHeight`, which counts transformed overflow, so with the parallax every section
  measured as overflowing and PageDown skipped one.

**Rick's review of it:** _"There is a slight margin left and right, and the scrolling in the
channels doesn't fully take over, on desktop I can still slowly scroll past."_

- **The margin was a scrollbar.** Full-bleed bands escaped a column-wide `<main>` with
  `calc(50% - 50vw)`, and vw counts a classic scrollbar: in Chrome on Windows every band was 15px
  wider than the page, and the page scrolled sideways. Every test passed, because Playwright hides
  scrollbars. A page of bands now has a full-width `<main>` (`BaseLayout`'s `bleed`), and
  `tests/e2e/scrollbars.spec.ts` runs with real ones.
- **Slow scrolling crept.** Wheel deltas under 12px were let through as trackpad drift, and a slow
  scroll is nothing but those. They now add up to a channel change; no wheel event over a channel
  moves the page. That leak had also been the only way to reach the footer with a wheel, so past
  the last section the wheel now scrolls normally on purpose. Ctrl + wheel zooms again (it was
  being taken as a channel change), and Space pages like Page Down.
- **Short laptop screens scrolled instead of changing channel.** 1366×768 and 1280×720 leave 657
  and 630px under the browser's chrome, and the hero, guide, practice and contact were 20–140px
  taller: they scrolled natively, and a native Page Down overshot into the next channel, which then
  took over misaligned. Every section now fits from 630px tall, and a section that still overflows
  pages by at most what is left of it.
- Found on the way: the interludes' statements crossed their photographs bare, over the
  lighthouse's tower. They sit on plates of the field now, line by line.
- Homepage LCP at 4× throttle measured 1968 ms in `pnpm test:vitals`, over the 1800 ms trip-wire,
  with the machine at 50% load from other work. Built against HEAD and served from one server,
  interleaved: **960 ms** against **976 ms** (medians of 8). No regression; the trip-wire stays.
- **The vitals test had been measuring its own scroll.** It read LCP after walking the page, and
  a programmatic scroll does not end LCP the way a visitor's does, so the homepage's "LCP element"
  was often an interlude photograph halfway down — `img` on a route whose first screen has no
  image. LCP is now read before the walk, once the first screen stops producing candidates; CLS
  still walks everything. Corrected: `/` **1484 ms** (the live field layer, the slow mode of the
  race in open item 11), `/work/chromecast` **444 ms**, CLS 0.

**Then:**

- Rick: _"does there have to be like this empty square before I show up?"_ No. The portrait's box
  counted its own dark background as portrait, which resolved to spaces, so the face sat in an
  empty rectangle cut out of the field. The darkest level now belongs to the field, and a test
  holds the corners of the face to it.
- Triple is now called **Hypersolid**. Every mention on the site and in the docs has changed, the
  content schema's `company` enum with it. The longer name cost the hero's lede a sixth line at
  1280 wide, which took the hero past a 720px screen again, so its measure went from 38 to 41vw.
- Rick: _"Can't we somehow let the blue background seep into the art of my picture?"_ Of three
  candidates (Tint, Swell, Scanline) he chose **Tint**: the portrait in a tint of the field's own
  blue instead of yellow, developing out of the field rather than swapping in, with the field's
  motion running through the face. And **60fps** instead of 30, for smooth motion; the cap stays,
  so a 120Hz display does not double the work, and a test drives the loop at 120Hz to hold it.
- What 60fps costs, measured on the same code at both rates: at full speed the idle hero keeps the
  main thread **33%** busy against **22%** at 30fps. On a 4× slowed CPU both are saturated — about 28
  renders a second, the main thread 100% busy — so there it costs nothing, but that saturation was
  already there at 30fps: open item 12.
- LCP against HEAD, interleaved on one server: **1836 ms** against **1980 ms**, medians of 8, with the
  machine at 35–55% load from other work. The vitals run's 2308 ms was that load; the trip-wire stays.

**2026-09-25:**

- Rick: _"The footer at the bottom is double so not needed."_ It repeated the contact channel's links,
  and it is gone from every page: the one-pager ends on the contact channel, a case study on its
  guide strip, the 404 on its own links. The 404's content now declares its channel itself — the
  footer had been its only channel region — and the body's flex column, which only kept the footer
  at the bottom of a short page, is gone with it.
- Rick: _"load the first 3 projects by default, and add a load more button for other projects so
  navigation is better."_ The guide shows the first three and holds the rest behind **Load more**, a
  native `<details>`, so it opens without JavaScript and find-in-page still reaches it. Scrolling and
  the arrow keys step through what is on screen — three steps, not all of them — the arrow keys stop
  on Load more, and opening it hands focus to the first new programme. The strip under a case study
  still lists everything, so the page you are on is always lit on it.
- Found on the way: a case study's screen, sinking as the page scrolls (the depth above), slid over
  the facts and hid them, because a transform lifts an element above in-flow content. The reading
  area is an opaque layer now, and the screen slides under it.
- Rick: _"The work cards with the images have too much color … for NLZIET … it's just all pink
  now."_ Of three candidates (own colours, black and white, a light wash) he chose **own colours**:
  key art, on the guide and on its case study, is shown as it is, and only photographs print in
  their channel's colours. `coverTone` and `coverPrint()`, which existed to print a cover as a
  negative, are gone with the print.
- Rick: _"Don't think we need the previous/next buttons on the detail pages when we have the EPG
  underneath."_ Gone; the guide strip is the way to every other programme.
- Rick: _"the image can be full size with more paralax effect."_ Of three candidates (a backdrop,
  the full column, a pinned stage) he chose the **backdrop**: a case study opens on its key art
  edge to edge across 84% of the first screen, the way a streaming app opens a programme, with the
  way back, the channel and the title standing on it on plates of the field. As the head leaves,
  the picture falls behind the page to half its speed and zooms in, and the title lifts away. The
  title's plate goes line by line, cut to Martian Mono's cap height, because a wrapped block's plate
  is as wide as its column.

**Rick's desktop run (2026-09-25):**

- **The hero is a title card.** _"The art can maybe be full-screen ... focus lies on the text now
  more."_ Of three candidates (a title card, a poster, the name behind the portrait) he chose the
  title card: the character field fills the screen with the face in the middle, and the name, at
  about half its old size, stands at the foot with one caption. The skills list and the Scroll cue
  are gone, and nothing stands on a plate: the field runs out into its own ground at the foot. The
  ground has a floor in rem as well as its share of the screen, because on a short screen the copy
  climbs higher than any fixed share: as a share alone it left the eyebrow at 3.4:1 on a 360×640
  phone. `tests/a11y/hero-contrast.spec.ts` measures the copy over the live field, with the pointer
  away and over the name, on two laptops and two phones.
- **Case studies.** The back button sits level with the channel, on the column's edge rather than
  the screen's corner. The title, its status and the synopsis share one left edge — title first,
  as a programme page reads — and they stand on a gradient where the picture runs out into the
  field, not on plates. axe cannot judge text over a photograph, so
  `tests/a11y/stage-contrast.spec.ts` measures each block against the brightest pixel behind it;
  the worst today is the title at 4.4:1 over Chromecast's white photograph. The channel keeps a
  chip: a fade thin enough to keep the picture left it at 1:1 there.
- _"When going to the case study there is no animation."_ There was one, over in 320 ms — and the
  picture flew as a layer of its own that hid the title and the gradient until it ended. Now the
  picture grows out of the guide's screen into the stage over 720 ms, the title flies above it,
  and the gradient and the chrome fade in on layers of their own, stacked explicitly: left alone,
  the layers took the old page's paint order, which put the title under the picture.
- **The guide.** The picture takes the larger share of the preview under a higher cap, and reacts
  to the pointer: it pushes in, scanlines come up, static crackles once, and a Case study cue rises.
- **Contact.** Each link lights up in a channel of its own: LinkedIn ultramarine, GitHub ink, Email
  yellow.
- **How I work** is rewritten around Rick's three themes — AI-first, keeping responsibility,
  expertise built into the tooling — each with a proof that can be checked in this repository.
  Drafts, for Rick to put in his own voice.
- The Signal and Field interludes stay; Rick will replace their pictures and their text.
- **Streamz & VTM GO** (DPG Media, 2022–2024) is in as a draft with the facts Rick gave. It waits
  on a cover and on the case study itself.

**Stage 1b, the programme guide (2026-09-24).** Rick on stage 1: the project sections did not work
at all, the case studies did not look good, full-screen red and blue were too bright, and there
should be no header — it should feel like an app. Of three candidates rendered at full size (a
lower third per project, a programme guide, a TV home screen) he chose the guide.

- **The work is a TV programme guide** (`src/components/Guide.astro`): one row per channel, one
  block per programme spanning its time on air, a NOW line at today and a live clock. The programme
  in focus is previewed above the grid and the whole screen retunes to its channel; arrow keys move
  through it like a remote. It replaces the three project sections, and it lists every published
  entry — KIJK included — so the "Also shipped" list and the `featured` flag are gone.
- **Scrolling steps through the guide first** (Rick's follow-up): each scroll, swipe or Page Down
  moves to the next programme, and only a scroll past the last one moves the page on; arriving from
  below starts at the last programme. The section advance asks a section first with a cancelable
  `section:step` event, so any section can have steps; one trackpad flick is one step. Off under
  reduced motion and wherever the guide is taller than the screen, where scrolling just scrolls.
- Deep links land instantly. They used to glide from the top, because smooth scrolling was on
  before the browser jumped to the fragment, so a case study's Guide link rolled the hero past.
- **Case studies are programme-information screens** (`WorkLayout.astro`): the key art on a
  screen, the facts as a labelled block, the story beside them, channel up/down, and the guide
  strip along the bottom with the current programme lit. Escape or Backspace goes back.
- **No site header.** The one-pager opens on the hero; a case study carries a Guide button.
- **Deep grounds.** Full-screen red and blue became crimson and ultramarine; the primaries are signal
  colours that print the key art's highlights and mark the interface. Photos print as a two-tone,
  shadows in the ground and highlights in the signal. The yellow interlude and the paper sections
  stay as they are.
- Found on the way: the field's IntersectionObserver read `entries[0]`, so under load a fast scroll
  left the animation loop running offscreen; it now reads the latest entry.

**Stage 1, what changed:**

- **`src/lib/channels.ts` is the only source of colour.** Six channels on the Broadcast primaries
  palette (since stage 1b: ink, paper, yellow, crimson, ultramarine, navy). Each channel's mark — ink or paper, whichever reads —
  its dimmed mark and its accent are solved at build time, and the build fails below 4.5:1. Mint and
  amber are gone. `src/lib/accent.ts` is deleted.
- **Everything that darkened the page is deleted**: the grain overlay, per-section washes and
  vignettes, the alternating darker ground, drop shadows, text shadows, and every
  `brightness(0.42–0.68)` on a photograph.
- **Photos print in their channel's two colours** (`.duo`, CSS `mix-blend-mode`) and come back in
  their own colours under the pointer. A cover can be printed as a negative where a positive print
  would come out as a block of the wrong colour (`coverTone`, since stage 1b).
- **Text that crosses a picture sits on a plate of the field** — a broadcast lower third — instead
  of a scrim or a shadow.
- **Martian Mono 700** is the display face, with a measured monospace fallback. Space Grotesk is gone.
- **Hard edges**: no radius, no pills (tags are mono text with slashes), no glows (the proximity
  glow and the cursor's difference blend are gone).
- The page chrome — rail, cursor, progress bar and the browser's own theme colour — follows the
  channel in view (`src/scripts/channel.ts`), including under reduced motion.
- Found on the way: every canonical URL ended in `.html` and the homepage nav linked to itself, both
  build-only (`build.format: 'file'`); the contact photo shifted layout by 238px when its lazy image
  loaded; a stale "overflowing" flag could collapse a work panel's picture to nothing; and Astro 7.3
  backgrounds `astro preview` when an AI agent runs it, which broke the test server. All fixed, and
  the first three are now tested.
- Homepage LCP under 4× throttle: **552 ms** at the end of stage 1 (was bimodal, 840–1470 ms). CLS 0.
  After stage 1b it measured 1236–1332 ms: inside the 1800 ms trip-wire, in the slow mode of the race
  in open item 11. The canvas renderer in stage 3 is expected to settle it.

**Done:**

- ~~Two-accent palette on a lifted ground (`#15181c`)~~ — replaced by channels (above). Five-step art
  ramp, motion tokens.
- ~~`src/lib/accent.ts` — OKLCH lightness floor per work accent.~~ Replaced by `src/lib/channels.ts`. Fixes a shipped bug where
  `::selection` used the raw accent and measured **1.34:1** on `/work/chromecast`. Every entry now
  clears AA, worst case 6.62:1.
- The character-field hero: two stacked `<pre>`, 60fps (30 until stage 2), decode-on-load, pointer-reactive. The
  portrait is a 0.62 KB build-time luminance map; the resolved frame is server-rendered, so no-JS
  and reduced-motion visitors get the real thing rather than an empty box.
- `reset.css` scroll-timeline exception — a time-valued `animation-duration` breaks scroll-linked
  animations rather than speeding them up.
- Draft entries no longer ship their cover images.
- Hero column alignment; skip-link focus behaviour.
- Cursor and trail — one script, no `requestAnimationFrame` of its own. (The proximity glow went in
  the Channels redesign.)
- Scroll-into-view reveals and the scroll-progress bar — both zero JS, `animation-timeline`.
- Nav: legibility, sticky, non-colour current-page cues, Email as a button. Nav, rail and pointer
  all take their colour from the section in view.
- Page transitions via CSS `@view-transition` (no `ClientRouter`, ever).
- ~~Space Grotesk 700~~ → **Martian Mono 700** (OFL) with a **measured** metric-matched fallback —
  closes the Archive Regular licence gap.
- `scripts/check-assets.mjs` as a CI gate. It has already caught two real regressions.
- **Restructured to a one-pager.** Eight full-height sections in one document, with the work detail
  routes kept: `/work/[slug]` still deep-links, shares and renders without JS. `Section.astro` is
  the shell `Chapter.astro` was going to be.
- ~~Screen-filling work panels with scroll-driven parallax~~ (replaced by the programme guide in stage
  1b), and two art interludes between them.
- `How I work` — a three-item grid on AI-driven development.
- Work detail pages rebuilt in the one-pager's language. They were still the Phase 1 layout: an
  untreated colour cover, a sentence-case heading and no accent, so the view transition morphed a
  dithered monochrome thumbnail into a raw photograph and the page read as a different site. They
  now carry the same dither, brackets, parallax, display title and per-entry accent, the chrome
  answers to the entry via `--c-section-ink`, and each one links to the previous and next case
  study instead of dead-ending.
- Display titles are sized against their own column with a container query. `overflow-wrap:
break-word` from the reset is right for prose and splits a word in half at display sizes --
  "CHROMECAST" shipped as "CHROMECA / ST" at 1715px wide.
- `check-assets` gained a ninth check: **`var(--x)` with no definition anywhere in `src/`**. An
  undefined custom property is not a CSS error; the declaration is silently dropped. `--s-10` and
  `--s-5` were both in the new detail page and neither is in the scale.

**Remaining:**

- Contact section design. It is the one section that has had no design attention.
- Contact section copy (see the copy note below).

**Gate:** `pnpm check:assets` exits 0 · LCP < 2.5 s and CLS < 0.1 on built output · no shipped image
over 250 KB · zero EXIF · keyboard traversal and axe clean **with JavaScript disabled**.

## Phase 3 — Chapters & case studies

The nine planned chapters as real content. Write the three featured case studies properly.

**Gate:** `astro check` clean · blocklist scan passes · no unpublished metric without recorded sign-off.

## Phase 4 — Transitions, PWA, SEO, a11y completion

**Gate:** installable · offline fallback matches the design · no stale HTML · sitemap and canonicals
agree.

## Phase 5 — Easter eggs, 404 treatment, cross-browser QA

**Gate:** typing `jazz` inside an `<input>` does nothing · Escape dismisses · zero timers and zero
listeners survive dismissal · reduced motion yields a static frame.

## Phase 6 — Real-hardware validation & launch

Where the Connected-TV thesis is actually earned; it cannot be faked in a lab. Real Smart TV
browser, an old Android device, a throttled connection.

**Gate:** a recorded trace per device class · the character grid holds 60fps or narrows its grid ·
a browser profile carrying the **old** service worker receives the new site.

---

## Deferred dependencies

Nothing on this list may be installed without moving it off the list first.

| Package           | Phase | Why deferred                                                                                                                                                               |
| ----------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@astrojs/mdx`    | 3     | Built-in `.md` is enough for prose. MDX earns its place when a page needs a component _inside_ prose.                                                                      |
| `@astrojs/rss`    | 3     | No writing section exists. A feed of five static items is noise.                                                                                                           |
| `@lhci/cli`       | —     | **Dropped, not deferred.** It pulls in Lighthouse and a second Chrome to measure two numbers `tests/budgets/vitals.spec.ts` gets from the browser own PerformanceObserver. |
| `vite-plugin-pwa` | 4     | **`@vite-pwa/astro@1.2.0` peers `astro ^1–^5` and does NOT support Astro 7.** Wire `vite-plugin-pwa@1.3.0` through `astro.config`'s `vite.plugins` instead.                |

`ogl` and `motion` were on this list. They are not deferred — they are **cancelled**.

## Open items

1. **The hero portrait is interim.** `portrait.jpg` is a matted face crop from a photo of Rick giving
   a talk — real, but not taken for this. A purpose-shot portrait is pending; what it needs is in
   `docs/art-system.md` § Changing the portrait.

2. **NOS is held back on image rights.** Its cover was an ANP Kippa press photo. The entry is
   `draft: true` and carries no cover, so nothing ships. Needs an image Rick owns or is licensed to
   use. **Ajax and NH Nieuws covers need the same provenance check.** Rick is making screenshots
   of his own work for mockup key art (2026-09-25), which would clear NOS: the scene is generated
   with a flat green screen and the real screenshot composited in locally, so the UI stays
   pixel-exact and no client screen goes to an image model.
3. **`nlziet.jpg` is 1200×675** — soft for a 2× hero if ever used at that size.
4. **Confirm the LinkedIn URL.** The README used `/in/rick-groot-469777193/`, the unreleased branch
   used `/in/r-groot/`. The vanity URL is assumed current but unverified.
5. **Ajax and NH Nieuws periods are inferred** and marked unconfirmed in their frontmatter.
6. **Stale remote branches** (`develop`, `first_site`, `sveltekit`) still to be pruned, which makes
   the old `icov` blobs and the 2021 "fix: remove public info" commit unreachable.
7. **Firebase console follow-ups** — see `README.md` § Security.
8. **A trumpet photo is pending** for the music beat the brief asks for. None of the supplied
   photographs has one. Rick's own instrument on a dark surface under one lamp; a generated one is
   the fallback, not the plan.
9. **`/design/*` are internal prototypes and must not launch.** They are noindex, disallowed in
   `robots.txt` and excluded from the sitemap, but they are still built. Delete the directory once a
   direction is chosen.
10. **`src/lib/practice.ts` is placeholder copy.** The three `How I work` cards are written in a
    plausible voice, not Rick's, and the claims are about this repo. They need his own words before
    launch — the file says so at the top.
11. **Homepage LCP is decided by a race.** The LCP element is the character field, and which layer
    counts varies run to run: the server-rendered frame (layer a) paints early, but the live field's
    first render (layer b) can cover a larger area and replace it as the LCP candidate once
    JavaScript has booted. Under 4x throttle that makes LCP bimodal — ~840–1030ms or ~1240–1470ms on
    identical bytes. The trip-wire sits above the slow mode so the gate is honest, but the real fix
    is to stop the live render registering as a new, later LCP: keep its painted box no larger than
    the static frame's.
12. **On a slow CPU the character field fills the main thread.** At 4× throttle the idle hero keeps
    it 100% busy and manages about 28 renders a second, at 30fps or 60. Most of that is the
    browser laying out and painting two full-screen `<pre>` of up to 6000 characters, not the
    script (about a fifth). Worth an adaptive step: the loop measures its own frames and narrows
    the grid, or halves its rate, when they run long. Phase 6's gate already says "holds 60fps or
    narrows its grid".
13. **Streamz & VTM GO is a draft** (`src/content/work/streamz-vtm-go.md`). It needs a cover, the
    TV platforms, the stack and what Rick built. Its screenshots should come from 2022–2024, the
    years he worked on it.
