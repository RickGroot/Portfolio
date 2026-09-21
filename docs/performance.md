# Performance

## Budgets

| Budget                      | Limit                 | How it is measured                      |
| --------------------------- | --------------------- | --------------------------------------- |
| Initial JS, homepage        | ≤ 20 KB gzip          | `tests/budgets/payload.spec.ts`         |
| Deferred art renderer chunk | ≤ 25 KB gzip          | Phase 3 gate                            |
| Total JS, homepage          | ≤ 45 KB gzip          | Phase 3 gate                            |
| LCP                         | < 2.5 s               | Lighthouse CI on built output (Phase 2) |
| CLS                         | < 0.1                 | Lighthouse CI (Phase 2)                 |
| INP                         | < 200 ms              | **Field only** — see below              |
| WebGL contexts              | **at most** 1         | `tests/budgets/payload.spec.ts`         |
| Animation loops             | 1, paused when idle   | `tests/budgets/payload.spec.ts`         |
| DPR                         | adaptive, capped ~1.5 | Phase 3                                 |

### Two honesty notes

**INP cannot be measured in a lab.** It needs real interactions from real users. Lighthouse reports
Total Blocking Time; use TBT as the lab proxy and say so. Do not report a Lighthouse number as INP.

**"At most 1" context, not "exactly 1".** After a permanent fallback there are zero contexts. A CI
assertion written `=== 1` will flake.

### On excluding the renderer from the budget

The original brief said "< 60 KB gzip initial, deferred renderer excluded". That is half right: a
chunk fetched after LCP genuinely does not affect LCP. But an _unbounded_ exclusion is not a budget,
it ignores shader-compile and texture-upload cost that lands on the main thread as INP, and metered
connections pay for the bytes whenever they arrive.

The measured 26 KB baseline came from a SvelteKit SPA carrying the Firebase SDK. An Astro static
site with no framework lands near zero — Phase 1 measures **2.04 KB**. Excluding something from a
budget you are at 3% of is headroom, not a constraint. Hence three bounded numbers instead of one
plus an exemption, and the 25 KB renderer ceiling is a **trip-wire**: if it is breached, the OGL
decision reopens on evidence.

For calibration: the realistic tree-shaken OGL subset for a fullscreen textured quad measures
**25.5 KB gzip unminified**, so roughly 12–16 KB minified. A hand-written WebGL2 fullscreen quad is
2–3 KB. The delta is real; the library buys correctness and time, not bytes.

## Baseline vs now

|                      | Old site (measured live)               | Phase 1                                      |
| -------------------- | -------------------------------------- | -------------------------------------------- |
| Initial JS           | 26 KB gzip                             | **2.04 KB gzip**                             |
| Homepage images      | **5.7 MB**                             | responsive AVIF/WebP, largest variant 292 KB |
| Fonts                | 1.1 MB of TTF, none of which loaded    | 45 KB of WOFF2                               |
| Third-party requests | 2 render-blocking Google Fonts imports | **0**                                        |
| Repo assets          | 6.9 MB                                 | 1019 KB                                      |

**The performance problem was never JavaScript.** It was 5.7 MB of unoptimised camera JPEGs on the
homepage and a font stack that silently fell back to a CDN. Phase 2 owns the rest of that work.

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

The previous setup declared `format('ttf')` — not a valid token, it is `truetype` — so the local
fonts never loaded and the page fell back to two render-blocking Google Fonts CDN imports,
duplicated into all 8 component stylesheets. That was both a performance bug and a GDPR one: the
CDN receives visitor IP addresses, which for an EU-facing `.nl` site with no consent banner is not
something to do by accident.

## Caching

`firebase.json` sets `immutable` year-long caching for `/_astro/**` and `/fonts/**` (Astro
content-hashes those filenames, so this is safe and without it every repeat visit re-validates your
CSS), `must-revalidate` for HTML, and `no-store` for `/service-worker.js`.

## Renderer rules — written down before the renderer exists

Phase 3 must honour these. They are here now so they are not negotiated later under pressure.

- **One** WebGL2 context, **one** `requestAnimationFrame` loop, owned by a lifecycle controller.
  Sections declare art in markup; they never create a context or a loop.
- DPR capped at ~1.5. Resolution scale is the primary quality lever — a dithered aesthetic at 0.5×
  reads as _intentional_, which is the one genuine synergy in this art direction.
- Lazy bootstrap after critical content. The capability gate sits **before** the dynamic `import()`,
  so a weak device never pays the bytes.
- Pause when hidden or offscreen. **No permanent background loops.**
- Dispose everything: `cancelAnimationFrame`, `deleteTexture`, `deleteProgram`, `deleteShader`,
  `deleteBuffer`, `IntersectionObserver.disconnect()`, `ResizeObserver.disconnect()`,
  `removeEventListener`, `ImageBitmap.close()`, and `loseContext()` before removing the canvas —
  that last one is what actually frees the context rather than leaving it to GC.
- Guard the pending `import()` with a generation counter: scroll past fast and it can resolve after
  teardown, creating a context for a dead section.
- `preventDefault()` on `webglcontextlost` or restore never fires. Never call `delete*` on a lost
  context. Attempt restore **once**; a second loss in a session means permanent poster.
- The DOM owns content and accessibility. The canvas owns decoration. **If the canvas dies, the
  portfolio still works.**
