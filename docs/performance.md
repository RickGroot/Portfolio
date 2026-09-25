# Performance

## Budgets

| Budget                | Limit               | How it is measured                                             |
| --------------------- | ------------------- | -------------------------------------------------------------- |
| Initial JS, homepage  | ≤ 20 KB gzip        | `tests/budgets/payload.spec.ts`                                |
| Character field chunk | ≤ 8 KB gzip         | trip-wire; measured 3.6 KB (2026-09-25)                        |
| Total JS, homepage    | ≤ 45 KB gzip        | measured 12.1 KB, 1.0 KB of it inline (2026-09-25)             |
| LCP                   | < 2.5 s             | `tests/budgets/vitals.spec.ts`, 4× CPU, read before any scroll |
| CLS                   | < 0.1               | `tests/budgets/vitals.spec.ts`, 4× CPU, the whole page walked  |
| INP                   | < 200 ms            | **Field only** — see below                                     |
| Canvas elements       | **0**               | `tests/budgets/payload.spec.ts`                                |
| WebGL contexts        | **0**               | `tests/budgets/payload.spec.ts`                                |
| Animation loops       | 1, paused when idle | `tests/budgets/payload.spec.ts`                                |
| Character grid        | ≤ 6000 cells        | at 1440×900; scaled with screen area, 2.2× at most             |

### Two honesty notes

**INP cannot be measured in a lab.** It needs real interactions from real users. Lighthouse reports
Total Blocking Time; use TBT as the lab proxy and say so. Do not report a Lighthouse number as INP.

**Count renders, not `requestAnimationFrame` calls.** The loop must schedule a frame every display
refresh in order to sample time; it throttles the _work_, not the scheduling. Counting rAF would
measure the visitor's monitor rather than us — `tests/e2e/field.spec.ts` counts DOM mutations.

### Why there is no "deferred renderer" exemption any more

The original brief said "< 60 KB gzip initial, deferred renderer excluded". An _unbounded_ exclusion
is not a budget: it ignores main-thread cost, and metered connections pay for the bytes whenever
they arrive. So the plan replaced it with three bounded numbers.

Then the exemption stopped mattering. The signature treatment renders as **text in two `<pre>`
elements** — no canvas, no WebGL, no shader compile, no texture upload. The whole art system
measures **3.6 KB gzip**, against the 25 KB a GPU renderer would have taken on its own.

For calibration on what was avoided: the realistic tree-shaken OGL subset for a fullscreen textured
quad measures 25.5 KB gzip unminified, roughly 12–16 KB minified — plus a quality governor,
context-loss handling and build-time poster generation. All of it existed to serve an effect that a
string assignment produces.

## Baseline vs now

|                      | Old site (measured live)               | Now                                           |
| -------------------- | -------------------------------------- | --------------------------------------------- |
| Total JS             | 26 KB gzip                             | **10.7 KB gzip** (incl. the whole art system) |
| Homepage images      | **5.7 MB**                             | none — the hero is text                       |
| Fonts                | 1.1 MB of TTF, none of which loaded    | 45 KB of WOFF2                                |
| Third-party requests | 2 render-blocking Google Fonts imports | **0**                                         |
| Repo assets          | 6.9 MB                                 | ~1 MB                                         |
| `dist`               | —                                      | 0.49 MB                                       |

**The performance problem was never JavaScript.** It was 5.7 MB of unoptimised camera JPEGs on the
homepage and a font stack that silently fell back to a CDN. The homepage now has no hero image at
all: the portrait is a 0.62 KB luminance map rendered as characters.

## Image export spec

Source images in `src/assets` are re-exported to: **max 1920 px on the long edge, quality 82, all
metadata stripped.** Astro re-encodes to AVIF/WebP at build time, so the source only needs to be a
good-quality master, not a shipped asset.

Metadata stripping is not cosmetic. The old homepage images shipped EXIF containing camera body
(`Canon EOS 4000D`), Lightroom version, and capture timestamps to every visitor. A photo taken on a
client site would carry date and potentially GPS. **sharp drops metadata unless told to keep it**,
which is the behaviour we want. Phase 2 makes this a CI gate.

## Font pipeline

Three faces, self-hosted as WOFF2 in `public/fonts/`, Latin subset, `font-display: swap`, each with
its SIL OFL licence alongside (`OFL-<Family>.txt` — redistribution requires it):

| Role    | Face                          | File                               | Size    | Preloaded |
| ------- | ----------------------------- | ---------------------------------- | ------- | --------- |
| Display | Bricolage Grotesque 800, 96pt | `bricolage-grotesque-96-800.woff2` | 21.7 KB | yes       |
| Reading | Instrument Sans 400           | `instrument-sans-400.woff2`        | 16.9 KB | yes       |
| Reading | Instrument Sans 600           | `instrument-sans-600.woff2`        | 17.4 KB | no        |
| Labels  | JetBrains Mono 500            | `jetbrains-mono-500.woff2`         | 21.8 KB | no        |

Chosen by Rick on 2026-09-25 from full-size candidates on the real pages. They replace Martian Mono
(display) and Lato (reading); labels were a system monospace. The character field is not a label
and keeps its system face, `--font-field`: it needs a uniform advance, and a web font would also
make the LCP element wait on a download. The `check-assets` budget is 80 KB of WOFF2 — what a
visitor downloads; the licence texts are not counted — and the set is 76 KB of it.

These are Google's own WOFF2 builds, downloaded once and committed. **There is deliberately no font
build dependency.** To refresh one, or add a weight:

```bash
# 1. Get the face URL. The latin subset is the one with U+0000-00FF, so ask as a browser:
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0" \
  "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400&display=swap" \
  | awk '/\/\* latin \*\//{f=1} f && /src: url/{match($0,/https:[^)]*/); print substr($0,RSTART,RLENGTH); exit}'

# 2. Download it under a NEW name -- /fonts/** is cached immutable, so never overwrite a file.
# 3. Verify the magic bytes are "wOF2", and that its OFL is alongside, before committing:
#    https://raw.githubusercontent.com/google/fonts/main/ofl/<family>/OFL.txt
```

Each file is declared across a weight range (`font-weight: 700 800` for the 800), so a rule asking
for 700 gets the real face rather than a bold the browser fakes from a lighter one.

### Metric-matched fallbacks

Each face has a local fallback in `src/styles/typography.css` whose `size-adjust` and overrides make
the swap dimensionally neutral; the cold-cache test in `tests/budgets/vitals.spec.ts` holds the swap
to no layout shift. **Re-measure whenever a face changes.** Load the face from its own bytes with
`new FontFace()`, **await it**, then read `measureText()` on a canvas at 100px for the face and for
the local fallback:

```text
size-adjust      = face width  / fallback width     over strings the face actually sets
ascent-override  = face fontBoundingBoxAscent  / size-adjust
descent-override = face fontBoundingBoxDescent / size-adjust
```

For a monospaced pair (JetBrains Mono and Courier New, both 0.6em) one glyph is every glyph and
every string matches. For a proportional pair only the average can: Bricolage is matched to Arial
Bold across the site's own headings, Instrument Sans to Arial across its ledes and card bodies.

Measuring before the face has loaded silently measures the fallback: four different candidates once
all came out at an identical 6.61em.

The display face is proportional, which the headline decode used to rely on it not being: see
`src/lib/decode.ts`, which now holds every letter's measured width while it scrambles, and the
motion test that watches every frame of one for a word moving.

The previous setup declared `format('ttf')` — not a valid token, it is `truetype` — so the local
fonts never loaded and the page fell back to two render-blocking Google Fonts CDN imports,
duplicated into all 8 component stylesheets. That was both a performance bug and a GDPR one: the
CDN receives visitor IP addresses, which for an EU-facing `.nl` site with no consent banner is not
something to do by accident.

## Caching

`firebase.json` sets `immutable` year-long caching for `/_astro/**` and `/fonts/**`, `must-revalidate` for
HTML, and `no-store` for `/service-worker.js`. Astro content-hashes everything under `/_astro/`, so
that is safe, and without it every repeat visit re-validates the CSS.

**`/fonts/**` is NOT hashed** — those files come from `public/` and keep their names. A font
changed in place would stay stale for a year for anyone who has visited. A changed font gets a new
file name; never overwrite one.

## Renderer rules

The art renders as text. `src/lib/field/` owns it; see `docs/art-system.md`.

- **One `requestAnimationFrame` loop on the site**, in `src/lib/field/loop.ts`. Everything else
  subscribes. `eslint.config.js` restricts `requestAnimationFrame` everywhere else, so this is
  enforced rather than requested.
- **Throttled to 60fps.** It was 30, on the reasoning that character art has no sub-cell motion — a
  glyph either changes or it does not — so the gap to 60 would be small. On screen the field's roll
  and the face's shimmer stepped, and Rick asked for smooth (2026-09-24). The cap still matters on a
  120Hz display, which would otherwise double the work; `tests/e2e/field.spec.ts` drives
  `requestAnimationFrame` at 120Hz to hold it.
- **Never read layout inside the tick.** `textContent = s` alone is ~0.0 ms; adding a forced read
  like `offsetHeight` makes it 0.3–0.9 ms. Resolve progress comes from `IntersectionObserver`
  thresholds, never `getBoundingClientRect`.
- **Grid capped at 6000 cells** at 1440×900, scaled with the screen's area up to 2.2× (13,200)
  on a larger one, sized from the _measured_ advance width, never an assumed one.
  Cell aspect varies by font (0.55 Consolas, 0.60 Courier New) and a user's minimum-font-size
  setting can inflate it further. If the measured font is not actually monospace, the renderer
  bails to the static frame rather than shipping a sheared grid.
- **Stops when offscreen or hidden.** `IntersectionObserver` unsubscribes, which cancels the RAF —
  it does not idle. There is no permanent background loop on this site.
- **Dispose everything**: unsubscribe, `io.disconnect()`, `ro.disconnect()`, remove listeners,
  release the typed arrays. A generation counter guards the dynamic `import()`, which can resolve
  after teardown if someone scrolls past fast.
- **Two `<pre>` layers is the colour budget.** Measured 3× single-layer cost, not 2× — overlapping
  repaint is superlinear. A third layer colour is not affordable on mobile.
- **ASCII-only ramp, ligatures explicitly disabled.** A glyph missing from the user's font falls
  back per-glyph with an unconstrained advance and shears the line; `reset.css` sets
  `text-rendering: optimizeLegibility` on `body`, which _enables_ ligature processing, so the
  field must override it.
- The DOM owns content and accessibility. The field is decoration, `aria-hidden`, `contain: strict`,
  and not selectable. **If the renderer never starts, the hero still shows the portrait** — it is
  server-rendered into the markup at build time.
