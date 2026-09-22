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
> whole art system measures **2.6 KB gzip** against the 25 KB that renderer would have taken on its
> own. Later phases are renumbered accordingly.

---

## Phase 1 — Foundation ✅

Replaced SvelteKit 1 with Astro 7. Content collections with real work copy, deep-linkable routes,
CI quality gates, and the service-worker kill switch.

## Phase 2 — Design system, hero & asset pipeline — IN PROGRESS

**This phase must be shippable on its own.**

**Done:**

- Two-accent palette on a lifted ground (`#15181c`), five-step art ramp, motion tokens.
- `src/lib/accent.ts` — OKLCH lightness floor per work accent. Fixes a shipped bug where
  `::selection` used the raw accent and measured **1.34:1** on `/work/chromecast`. Every entry now
  clears AA, worst case 6.62:1.
- The character-field hero: two stacked `<pre>`, 30fps, decode-on-load, pointer-reactive. The
  portrait is a 0.62 KB build-time luminance map; the resolved frame is server-rendered, so no-JS
  and reduced-motion visitors get the real thing rather than an empty box.
- `reset.css` scroll-timeline exception — a time-valued `animation-duration` breaks scroll-linked
  animations rather than speeding them up.
- Draft entries no longer ship their cover images.
- Hero column alignment; skip-link focus behaviour.
- Cursor, trail and proximity — one script, no `requestAnimationFrame` of its own.
- Scroll-into-view reveals and the scroll-progress bar — both zero JS, `animation-timeline`.
- Nav: legibility, sticky, non-colour current-page cues, Email as a button. Nav, rail and pointer
  all take their colour from the section in view.
- Page transitions via CSS `@view-transition` (no `ClientRouter`, ever).
- Space Grotesk 700 (OFL) with a **measured** metric-matched fallback — closes the Archive Regular
  licence gap.
- `scripts/check-assets.mjs` as a CI gate. It has already caught two real regressions.
- **Restructured to a one-pager.** Eight full-height sections in one document, with the work detail
  routes kept: `/work/[slug]` still deep-links, shares and renders without JS. `Section.astro` is
  the shell `Chapter.astro` was going to be.
- Screen-filling work panels with scroll-driven parallax, and two art interludes between them.
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

**Gate:** a recorded trace per device class · the character grid holds 30fps or narrows its grid ·
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

1. **The hero portrait is a photograph of someone who is not Rick.** `PLACEHOLDER-portrait.jpg` is
   an Unsplash image, used so the Decode pipeline could be proved against real skin, real hair and
   real directional light — which the generated CG bust could not do. **It must not launch**: see
   `src/assets/PLACEHOLDERS.md` for why a stock face beside his name is a claim rather than
   decoration. Swap the file, then run `node scripts/build-portrait-map.mjs`.

   `src/assets/rick.jpg` still cannot be used: sunglasses (no eyes, the one feature that makes a
   low-resolution face legible), head at ~7% of frame height, foliage at the same luminance as the
   subject, and identifiable members of the public in the background. It is unreferenced and does
   not ship.

2. **NOS is held back on image rights.** Its cover was an ANP Kippa press photo. The entry is
   `draft: true` and carries no cover, so nothing ships. Needs an image Rick owns or is licensed to
   use. **Ajax and NH Nieuws covers need the same provenance check.**
3. **`nlziet.jpg` is 1200×675** — soft for a 2× hero if ever used at that size.
4. **Confirm the LinkedIn URL.** The README used `/in/rick-groot-469777193/`, the unreleased branch
   used `/in/r-groot/`. The vanity URL is assumed current but unverified.
5. **Ajax and NH Nieuws periods are inferred** and marked unconfirmed in their frontmatter.
6. **Stale remote branches** (`develop`, `first_site`, `sveltekit`) still to be pruned, which makes
   the old `icov` blobs and the 2021 "fix: remove public info" commit unreachable.
7. **Firebase console follow-ups** — see `README.md` § Security.
8. **The art interludes are Unsplash placeholders.** `art/PLACEHOLDER-signal.jpg` and
   `PLACEHOLDER-field.jpg` replace the generated fields, because the brief rules out generated
   imagery as the site's identity. `check-assets` warns about every `PLACEHOLDER-` asset on each
   run. Replacing them is a file swap plus the imports in `src/pages/index.astro`.
9. **`/design/*` are internal prototypes and must not launch.** They are noindex, disallowed in
   `robots.txt` and excluded from the sitemap, but they are still built. Delete the directory once a
   direction is chosen.
10. **`src/lib/practice.ts` is placeholder copy.** The three `How I work` cards are written in a
    plausible voice, not Rick's, and the claims are about this repo. They need his own words before
    launch — the file says so at the top.
