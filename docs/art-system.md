# The art system

One ambient layer on the whole site: the hero character field. Everything else is
interaction-triggered.

## What it is

A grid of characters recomputed 30 times a second and written into two stacked `<pre>` elements.
**No canvas, no WebGL, no graphics context.** The whole thing is 2.6 KB gzip.

It idles as an abstract field, decodes into a portrait on load, and dissolves again as the hero
leaves the viewport. Fast pointer movement disturbs it.

## Why text

The reference the direction came from (`ertdfgcvb.xyz`) turned out to use no canvas at all — one
`<pre>`, 67×47 characters, 522 DOM nodes total. Measured before committing to it, with a forced
layout every frame:

| Grid    | Cells  | ms/frame |
| ------- | ------ | -------- |
| 80×40   | 3,200  | 0.50     |
| 120×60  | 7,200  | 1.87     |
| 200×100 | 20,000 | 3.25     |

Against a 16.7 ms budget, even 20,000 cells uses under a fifth of a frame.

## Two layers, because colour is the resolve state

The palette uses two accents, which means per-cell colour. Measured at 120×60:

| Strategy                            | ms/frame  |
| ----------------------------------- | --------- |
| One `<pre>`, single colour          | 1.18      |
| **Two stacked `<pre>`** (shipped)   | **2.22**  |
| One `<span>` per cell (7,200 nodes) | **40.71** |

Span-per-cell is 2.5× over a 60fps budget _on a desktop_. Settled.

The split costs nothing extra because it **is** the resolve state: a resolved cell goes to the warm
layer, a cell still in noise to the cool one, and each writes a space to the other. At rest one
layer is entirely spaces and its write is skipped — so the field spends almost all its life at
single-layer cost and only pays the double during the ~1 s decode.

Two layers measured **3×** single-layer cost, not 2× — overlapping repaint is superlinear. **Two is
the colour budget.** A third accent is not affordable on mobile.

## The resolve

Per cell, a hard swap on a precomputed threshold:

```
threshold[i] = 0.50 * radialFromCentre(x, y)   // resolves centre-out
             + 0.30 * hash(x, y)                // organic dissolve texture
             + 0.20 * (1 - portraitLuminance)   // bright features first

resolved = portrait[i] >= 0 && p > threshold[i]
```

**Not an ordered Bayer matrix.** Bayer assumes its period falls below perceptual threshold, but here
one matrix cell _is_ one character cell, so a 4×4 matrix has a ~36×64 px period that tiles visibly
across every row. Both were rendered side by side at several values of `p`: Bayer reads as a screen
door, this reads as a decode.

`p` is driven by hero visibility from `IntersectionObserver` thresholds — **never** by reading
layout in the tick. `textContent = s` alone is ~0.0 ms; adding a forced read makes it 0.3–0.9 ms.

On load `p` starts at 1, matching the server-rendered static frame exactly so there is no flash,
then scatters and decodes back in over ~3.2 s. The decode is the first thing a visitor sees rather
than something that happens off-screen as they scroll away.

## The ramp

`" .:-=+*#%@"` — 10 levels, ASCII only.

- **ASCII only.** Block characters like `░▒▓█` happen to work on Windows, but a glyph missing from
  the visitor's font falls back _per-glyph_ with an unconstrained advance width and shears the whole
  line. With two layers that also bleeds colour into the wrong cells.
- **No letters.** A field of random letters produces accidental words.
- **~10 levels, not 20.** Past about twelve the eye cannot separate adjacent levels in a small cell
  and the image reads as noise. Fewer, better-separated levels look _sharper_.
- A muddy ramp is almost always a muddy histogram — fixed at build time with `normalise()`.

## Ligatures will shear the grid

The ramp emits `==`, `--`, `::`, `**` constantly. If a visitor's monospace resolves to Fira Code,
JetBrains Mono or Cascadia Code, those fuse into single wide glyphs — on exactly the machines
developers use. Worse, `reset.css` sets `text-rendering: optimizeLegibility` on `body`, which
_enables_ ligature processing, so the field must override it explicitly:

```css
font-variant-ligatures: none;
font-feature-settings:
	'liga' 0,
	'calt' 0,
	'dlig' 0;
font-kerning: none;
text-rendering: optimizeSpeed;
```

`tests/e2e/field.spec.ts` asserts every line has identical length, which catches this.

## Geometry

Measured, never assumed. Cell aspect varies by font (0.55 Consolas, 0.60 Courier New) and a user's
minimum-font-size setting inflates it further. A probe element measures the real advance width on
mount and on resize; **if the measured font is not actually monospace the renderer bails to the
static frame** rather than shipping a sheared grid.

Grid capped at 6000 cells. The portrait occupies a centred box rather than the whole grid — a face
emerging from a still-live field reads far better than a rectangle appearing.

## The image pipeline

`scripts/build-portrait-map.mjs` uses sharp at build time to emit an 80×80, 12-level luminance map
as a packed ASCII string — **0.62 KB gzip**. Measured alternatives: base64 is 3× larger, a JSON
array 3.8×, because a small alphabet keeps deflate's match-finding working.

No image decode, no canvas and no pixel reads at runtime. The emitted artifact carries no EXIF, no
GPS and no camera metadata, because it is not an image any more.

The script also emits a **fully resolved static frame** which is server-rendered into the `<pre>`.

## Degradation

| Rung                     | What the visitor gets                                | Cost     |
| ------------------------ | ---------------------------------------------------- | -------- |
| No JS                    | The resolved portrait, as text                       | 0 JS     |
| `prefers-reduced-motion` | The same static resolved portrait, zero frames       | 0 JS     |
| Data saver               | Same                                                 | 0 JS     |
| Import fails             | Same — the static frame stands                       | —        |
| Non-monospace font       | Same — the renderer refuses to mount                 | —        |
| Print / forced-colors    | `display: none`. It is decoration.                   | CSS only |
| Offscreen / tab hidden   | Loop unsubscribes, RAF cancelled — it does not idle  | —        |
| Full                     | Decode on load, pointer-reactive, dissolve on scroll | 2.6 KB   |

The gates run **before** the dynamic import, so a visitor who will never see the animation never
downloads it. JS only ever takes over an element that is already correct — the inverse of the usual
progressive-enhancement failure where the no-JS state is a broken placeholder.

## Invariants

- **One RAF loop on the site**, in `src/lib/field/loop.ts`. `eslint.config.js` restricts
  `requestAnimationFrame` everywhere else, so this is enforced rather than requested.
- **Zero canvases, zero graphics contexts**, asserted on every route.
- `aria-hidden`, `contain: strict`, `pointer-events: none`, `user-select: none`. The last is not
  cosmetic — a global `::selection` rule would otherwise paint a solid accent block across the hero
  on a triple-click.

## One failure mode with no fix

**Find-in-page.** Ctrl+F searches the `<pre>` regardless of `aria-hidden`, and `user-select: none`
does not prevent it — the browser will scroll to the hero and paint highlight boxes over the art.
A symbol-only ramp makes this vanishingly rare in practice (nobody searches for `=`). Accepted, and
written down rather than hidden by disabling the art.

## The art interludes

Two full-bleed sections sit between the work panels. They are not the character field — they are
ordinary images under a CSS treatment: greyscaled, pushed down to 42% brightness, parallaxed, and
screened with a static dot pattern (`.art__dither`).

The interlude images are now **photographs**, not generated art — the brief rules out generated
imagery as the site's identity. They are Unsplash placeholders pending Rick's own photography, and
`src/assets/PLACEHOLDERS.md` records where each came from and why the portrait in particular must
not launch.

`scripts/make-art.mjs`, which generated interference and flow fields for this slot, has been
deleted now that its output is unused.

**Screen at display time, not at bake time.** The first version quantised the source through an
ordered Bayer dither, which looked right in isolation and was wrong twice over. The dot screen is
already applied in CSS, so baking one in doubled it. And high-frequency noise is the worst possible
input for a lossy encoder: `check-assets` failed the build at **507 KB** for one backdrop. Removing
the baked dither took the same image to **67 KB** with no visible difference, because the CSS
overlay was doing the work anyway — and it does it at a period tied to CSS pixels rather than to
whichever `srcset` candidate the browser picked.

**The source is WebP, not PNG.** Lossless PNG of an interference field is ~1.1 MB; the rings near
each wave source are genuinely high-frequency and do not compress. These are placeholders bound for
git history. Astro re-encodes to WebP regardless, and the page then greyscales, darkens and screens
the result, so q92 generation loss has nothing left to show by the time it reaches the screen.
1.6 MB of sources became 141 KB with output unchanged.

## Changing the portrait

1. Replace `src/assets/portrait-placeholder.png`.
2. `node scripts/build-portrait-map.mjs`
3. Commit the regenerated `src/generated/portrait-map.ts`.

The source needs: head-and-shoulders, **eyes visible** (the single feature that makes a
low-resolution face legible), strong directional light, a plain background well separated in
luminance, subject filling ≥60% of frame height, roughly square.
