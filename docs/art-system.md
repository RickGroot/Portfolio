# The art system

One ambient layer on the whole site: the hero character field. Everything else is
interaction-triggered.

## What it is

A grid of characters recomputed 30 times a second and written into two stacked `<pre>` elements.
**No canvas, no WebGL, no graphics context.** The whole thing is 2.9 KB gzip.

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

The field uses two palette colours — signal yellow for the resolved portrait, electric blue for the
noise it resolves out of (`--art-signal`, `--art-noise`) — which means per-cell colour. Measured at
120×60:

| Strategy                            | ms/frame  |
| ----------------------------------- | --------- |
| One `<pre>`, single colour          | 1.18      |
| **Two stacked `<pre>`** (shipped)   | **2.22**  |
| One `<span>` per cell (7,200 nodes) | **40.71** |

Span-per-cell is 2.5× over a 60fps budget _on a desktop_. Settled.

The split costs nothing extra because it **is** the resolve state: a resolved cell goes to the signal
layer, a cell still in noise to the noise layer, and each writes a space to the other. At rest one
layer is entirely spaces and its write is skipped — so the field spends almost all its life at
single-layer cost and only pays the double during the ~1 s decode.

Two layers measured **3×** single-layer cost, not 2× — overlapping repaint is superlinear. **Two is
the colour budget.** A third layer colour is not affordable on mobile.

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
| Full                     | Decode on load, pointer-reactive, dissolve on scroll | 2.9 KB   |

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

Two full-bleed sections sit on the one-pager. They are not the character field — they are
photographs printed in their channel's two colours: greyed, then two flat layers laid over them — the
highlight colour multiplied (`--duo-hi`) and the shadow colour screened (`--duo-lo`). On a light
channel that prints the photo in ink on the field; on a deep channel its shadows are the field and
its highlights the channel's signal colour — the NLZIET logo in red out of crimson. That is `.duo`
in `src/styles/surfaces.css`, and every photograph on the site uses it, the guide's key art and
the case studies' included.

A picture whose tone is the opposite of its field prints as a negative, so it comes out mostly as
the field rather than as a bright or dark block: a white screenshot on the navy channel, say. The
content only says whether a cover is `light` or `dark` (`coverTone`); `coverPrint()` in
`src/lib/channels.ts` decides.

The previous treatment greyscaled each photograph, pushed it down to 42–68% brightness and laid a dot
screen over it in the page colour. Every image came out as a darkened photo on a dark page, which is
most of why the site read as dark. A duotone is made of the channel's own colours and nothing else,
so it cannot.

They are Rick's own photographs — a lighthouse at sunset for _Signal_, a clock tower for _Field_ —
chosen by dithering all twelve candidates rather than looking at them. See `src/assets/IMAGES.md`.

Three props exist because real photographs are not uniform:

- **`lift`** — brightness before the print (`--duo-lift`). A photograph that is mostly mid-tones
  prints muddy on a light channel; lifting it sends the mid-tones to the field. The lighthouse
  sunset printed olive at 1 and prints yellow at `1.45`.
- **`contrast`** — how hard the two colours separate (`--duo-contrast`, default `1.1`).
- **`focus`** — the `object-position` of the cover crop. A phone shows a narrow centre band of a
  landscape photograph, so an off-centre subject gets cut away unless the crop is told where to
  look. The clock tower sits left of centre.

The statement crosses the photograph — the lighthouse's tower, at most sizes — so it sits on a plate
of the field, one band per line (`box-decoration-break: clone`). On the field the plate cannot be
seen; it shows only where the picture is dark. The plates are cut to Martian Mono's metrics, so
they meet without one covering the descenders of the line above; the numbers are in the comment on
`.art__plate`.

**Treat at display time, not at bake time.** An earlier version quantised its source through an
ordered Bayer dither, which looked right in isolation and was wrong twice over: the page applied
its own screen on top, so it doubled; and high-frequency noise is the worst input a lossy encoder
can get — `check-assets` failed the build at **507 KB** for one backdrop that was **67 KB** without
it. Keep sources photographic and let the page apply the treatment.

## Depth and decoding

**Depth** (`src/styles/depth.css`). Each section is a named view timeline, `--channel`, and its
layers ride it at their own depth: `--depth × --depth-unit` (14vh, 7vh on a phone) one way on entry
and the other way on exit. At rest a section sits at 50% of its timeline, where every depth is 0,
so a settled channel is exactly its layout and the parallax exists only in motion. Pictures sit
behind (negative), copy in front (positive), and the name is two planes, GROOT nearer than RICK.
Pictures that travel are oversized so the travel never shows an edge. The keyframes animate
`transform`, not `translate`, so they compose with the `translate` other animations set on the same
element. Phones move the pictures only; reduced motion, or no `animation-timeline`, moves nothing.

It depends on esbuild minifying the CSS (`astro.config.mjs`). Lightning CSS folds
`animation-timeline` into the `animation` shorthand, which is invalid; the browser drops the whole
declaration, and every scroll-driven animation on the site was dead in the production build while
the dev server, which does not minify, looked fine.

**Decoding** (`src/lib/decode.ts`). A headline scrambles into its real text when its channel comes
on: the readout's name, a section's heading, the guide's programme titles and the interludes'
statements (`data-decode`). It runs on the one animation loop (`subscribe` from `loop.ts`) and
never starts its own. While it runs, the element's `aria-label` holds the real text, so a screen
reader is never read noise. The noise glyphs are in the Martian Mono subset and the face is
monospaced, so nothing reflows. Whitespace, and the zero-width characters that hold a word
together, are left alone. Under reduced motion nothing scrambles.

## Changing the portrait

1. Replace `src/assets/portrait.jpg`.
2. `node scripts/build-portrait-map.mjs`
3. Commit the regenerated `src/generated/portrait-map.ts`.

The source needs: head-and-shoulders, **eyes visible** (the single feature that makes a
low-resolution face legible), strong directional light, and **a dark or plain background**. That
last one is not a nicety. Every lit cell gets a glyph, so a mid-tone background turns the portrait
into a textured rectangle with a face somewhere in it; the face has to come out of empty field.

**Current state: interim.** `portrait.jpg` is a face crop from the talk photo with a soft
elliptical matte, because its background is lit. The photo worth taking: facing a window after
dark or on an overcast day, a plain dark wall behind, no cap, one side of the face lit and the other
in shadow. Two minutes with a phone.
