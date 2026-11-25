# Performance

> The card table (2026-11-23) has no canvas, no WebGL and no animation loop, so the print-chunk,
> canvas and loop rows below belong to the retired channel site; later sections that discuss the
> renderer are kept as history. See `docs/card-system.md` for what runs now.

## Budgets

| Budget               | Limit         | How it is measured                                             |
| -------------------- | ------------- | -------------------------------------------------------------- |
| Initial JS, homepage | <= 20 KB gzip | `tests/budgets/payload.spec.ts`; measured 2.6 KB (2026-11-23)  |
| Total JS, homepage   | <= 45 KB gzip | `scripts/check-assets.mjs`                                     |
| LCP                  | < 2.5 s       | `tests/budgets/vitals.spec.ts`, 4x CPU, read before any scroll |
| CLS                  | < 0.1         | `tests/budgets/vitals.spec.ts`, 4x CPU, the whole page walked  |
| INP                  | < 200 ms      | **Field only** - see below                                     |
| Canvas / WebGL / rAF | 0             | `tests/budgets/payload.spec.ts`                                |

### Two honesty notes

**INP cannot be measured in a lab.** It needs real interactions from real users. Lighthouse reports
Total Blocking Time; use TBT as the lab proxy and say so. Do not report a Lighthouse number as INP.

**Count renders, not `requestAnimationFrame` calls.** The loop must schedule a frame every display
refresh in order to sample time; it throttles the _work_, not the scheduling. Counting rAF would
measure the visitor's monitor rather than us — `tests/e2e/loop.spec.ts` counts the print's draws,
as the character field's DOM mutations were counted until it was retired.

### Why there is no "deferred renderer" exemption any more

The original brief said "< 60 KB gzip initial, deferred renderer excluded". An _unbounded_ exclusion
is not a budget: it ignores main-thread cost, and metered connections pay for the bytes whenever
they arrive. So the plan replaced it with three bounded numbers.

Then the exemption stopped mattering. The signature treatment renders as **text in `<pre>`
elements** — no canvas, no WebGL, no shader compile, no texture upload. The whole art system
measures **4.3 KB gzip** (2026-09-28), against the 25 KB a GPU renderer would have taken on its own.

For calibration on what was avoided: the realistic tree-shaken OGL subset for a fullscreen textured
quad measures 25.5 KB gzip unminified, roughly 12–16 KB minified — plus a quality governor,
context-loss handling and build-time poster generation. All of it existed to serve an effect that a
string assignment produces.

The photographs are the one GPU path, since 2026-10-13, and they show what that estimate was made
of: a full-screen dither is one fragment shader over one triangle, so the whole renderer is
**3.2 KB gzip** of raw WebGL2 with context-loss handling included, no library, and nothing drawn at
rest. See `docs/art-system.md`, "The print".

## Baseline vs now

|                      | Old site (measured live)               | Now                                           |
| -------------------- | -------------------------------------- | --------------------------------------------- |
| Total JS             | 26 KB gzip                             | **13.4 KB gzip** (incl. the whole art system) |
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

| Role    | Face                       | File                         | Size    | Preloaded |
| ------- | -------------------------- | ---------------------------- | ------- | --------- |
| Display | Archivo 900 / 62% (static) | `archivo-900-62-latin.woff2` | 11.8 KB | yes       |
| Reading | Instrument Sans 400        | `instrument-sans-400.woff2`  | 16.9 KB | yes       |
| Reading | Instrument Sans 600        | `instrument-sans-600.woff2`  | 17.4 KB | no        |
| Labels  | JetBrains Mono 500         | `jetbrains-mono-500.woff2`   | 21.8 KB | no        |

Archivo replaced Bricolage Grotesque with the card redesign (2026-11-23): it is VAMP's sleeve face,
set at weight 900 and 62% width, and nothing else. The file is a static instance at exactly that
style, cut once from the variable font (90.1 KB → 11.8 KB), so the `check-assets` budget is 80 KB of
WOFF2 (what a visitor downloads; the licence texts are not counted). The set is 68 KB. It keeps the
whole Latin subset and every layout feature (kerning, ligatures, accents), so it is not capitals-only
even though the site only sets capitals. Checked against the variable font at 900 / 62% in Chromium
and WebKit: under 0.02% of pixels differ, all anti-aliasing.

To cut a different weight or width, with fonttools in a throwaway virtualenv (it is not a project
dependency):

```bash
python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools brotli
# Pin the axes. --update-name-table fails at wdth=62 (no named instance), so leave it off.
/tmp/ft/bin/fonttools varLib.instancer archivo-variable.woff2 wght=900 wdth=62 -o inst.ttf
/tmp/ft/bin/pyftsubset inst.ttf --flavor=woff2 --layout-features='*' \
  --unicodes='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' \
  --output-file=archivo-<weight>-<width>-latin.woff2
```

The variable source is VAMP's `archivo-var-latin.woff2`, which this site shipped until the static
instance replaced it. It is still in git history:
`git log --diff-filter=D -- public/fonts/archivo-var-latin.woff2` names the commit that removed it,
and `git show <that commit>^:public/fonts/archivo-var-latin.woff2 > archivo-variable.woff2` restores it.

The reading and label faces are Google's own WOFF2 builds, downloaded once and committed. **There is deliberately no font
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

What moves: the 1-bit print (`src/lib/dither/`, see `docs/art-system.md`, "The print") and the
masthead's tracker (`src/lib/hero/`). The character field these rules were first written for is
retired; its own rules are in `docs/retired/character-field.md`.

- **One `requestAnimationFrame` loop on the site**, in `src/lib/field/loop.ts` (named for the field
  it was written for). Everything else subscribes. `eslint.config.js` restricts
  `requestAnimationFrame` everywhere else, so this is enforced rather than requested.
- **Throttled to 60fps**, and ambient work steps down from there when its frames run long: to 30,
  then 20. The print's ambient life caps itself at 30. A 120Hz display must not double the work;
  `tests/e2e/loop.spec.ts` drives `requestAnimationFrame` at 120Hz to hold it.
- **Never read layout inside the tick.** `textContent = s` alone is ~0.0 ms; adding a forced read
  like `offsetHeight` makes it 0.3–0.9 ms. Positions are read in a `ResizeObserver`, how much of a
  section is on screen from `IntersectionObserver` thresholds.
- **Stops when offscreen or hidden.** `IntersectionObserver` unsubscribes, which cancels the RAF —
  it does not idle. There is no permanent background loop on this site.
- **Dispose everything**: unsubscribe, `io.disconnect()`, `ro.disconnect()`, remove listeners, lose
  the WebGL context.
- **Text that relies on columns turns ligatures off**, both ways a font can make them (`liga`,
  `calt`): `reset.css` sets `text-rendering: optimizeLegibility` on `body`, which _enables_
  ligature processing, and JetBrains Mono would fuse the tracker's `---`.
- The DOM owns content and accessibility. Art is decoration, `aria-hidden`, and complete without its
  script: the masthead's tracker is server-rendered at its first row, and a photograph is `.duo`
  until the print takes it over.
