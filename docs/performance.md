# Performance

## Budgets

| Budget                | Limit               | How it is measured                                             |
| --------------------- | ------------------- | -------------------------------------------------------------- |
| Initial JS, homepage  | ≤ 20 KB gzip        | `tests/budgets/payload.spec.ts`                                |
| Character field chunk | ≤ 8 KB gzip         | trip-wire; measured 2.9 KB (2026-09-24)                        |
| Total JS, homepage    | ≤ 45 KB gzip        | measured 10.7 KB, 0.9 KB of it inline (2026-09-24)             |
| LCP                   | < 2.5 s             | `tests/budgets/vitals.spec.ts`, 4× CPU, read before any scroll |
| CLS                   | < 0.1               | `tests/budgets/vitals.spec.ts`, 4× CPU, the whole page walked  |
| INP                   | < 200 ms            | **Field only** — see below                                     |
| Canvas elements       | **0**               | `tests/budgets/payload.spec.ts`                                |
| WebGL contexts        | **0**               | `tests/budgets/payload.spec.ts`                                |
| Animation loops       | 1, paused when idle | `tests/budgets/payload.spec.ts`                                |
| Character grid        | ≤ 6000 cells        | `tests/e2e/field.spec.ts`                                      |

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
measures **2.9 KB gzip**, against the 25 KB a GPU renderer would have taken on its own.

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

Lato 400 and 700 only, self-hosted as WOFF2 in `public/fonts/`, with `font-display: swap` and the
licence alongside them (`OFL.txt` — Lato is SIL OFL and redistribution requires it).

These are Google's own WOFF2 builds, downloaded once and committed. **There is deliberately no font
build dependency.** To refresh them:

```bash
# 1. Get the current face URLs (the latin subset is the one with U+0000-00FF):
curl -s -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" \
  | grep -B4 "U+0000-00FF" | grep -o "https://[^)]*\.woff2"

# 2. Download them to public/fonts/lato-400.woff2 and public/fonts/lato-700.woff2
# 3. Verify the magic bytes are "wOF2" before committing.
```

### Display face: Martian Mono 700

`public/fonts/martian-mono-700.woff2` — 10.6 KB, Latin subset, OFL alongside, preloaded — with a
metric-matched fallback declared in `src/styles/typography.css`. Re-measure the fallback whenever the
face changes. Load the face with `new FontFace()`, **await it**, then read `measureText()` on a
canvas at 100px, for the face and for the local fallback: one glyph's `width` (both are monospaced,
so one glyph is every glyph), `fontBoundingBoxAscent` and `fontBoundingBoxDescent`.

```text
size-adjust      = face advance / fallback advance     70 / 60.01 = 116.65%
ascent-override  = face ascent  / size-adjust          100 / 1.1665 = 85.73%
descent-override = face descent / size-adjust           20 / 1.1665 = 17.15%
```

Measuring before the face has loaded silently measures the fallback: four different candidates once
all came out at an identical 6.61em. The subset has no arrows and no U+2011 non-breaking hyphen, so
neither may appear in display text.

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
- **Throttled to 30fps.** Character art has no sub-cell motion — a glyph either changes or it does
  not — so the perceptual gap to 60 is far smaller than for continuous motion, and 30 divides evenly
  into 60/90/120, which is what makes a stepped cadence read as intentional rather than dropped.
- **Never read layout inside the tick.** `textContent = s` alone is ~0.0 ms; adding a forced read
  like `offsetHeight` makes it 0.3–0.9 ms. Resolve progress comes from `IntersectionObserver`
  thresholds, never `getBoundingClientRect`.
- **Grid capped at 6000 cells**, sized from the _measured_ advance width — never an assumed one.
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
