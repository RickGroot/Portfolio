# The art system

One ambient layer on the whole site: the hero character field. Everything else is
interaction-triggered.

## What it is

A grid of characters recomputed 60 times a second and written into stacked `<pre>` elements.
**No canvas, no WebGL, no graphics context.** The renderer is 4.3 KB gzip.

Since 2026-09-28 it draws channel 01 as a **test card**: the card a television shows before the
programmes start. A grid of lines in characters runs edge to edge, a circle stands in the middle,
and the portrait develops inside the circle out of a field of its own. It decodes on load, dissolves
again as the hero leaves the viewport, and a fast pointer ripples the card near it. See
[The test card](#the-test-card).

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

The field uses one blue at two strengths — the palette's electric blue for the field, and a tint of
it halfway to paper for the lit portrait (`--art-noise`, `--art-signal`) — which means per-cell
colour. The portrait was yellow until 2026-09-24, when Rick asked for the blue to "seep into the art
of my picture": in one hue the face reads as the field brightening, not as a second picture laid
over it. Measured at
120×60:

| Strategy                            | ms/frame  |
| ----------------------------------- | --------- |
| One `<pre>`, single colour          | 1.18      |
| **Two stacked `<pre>`** (shipped)   | **2.22**  |
| One `<span>` per cell (7,200 nodes) | **40.71** |

Span-per-cell is 2.5× over a 60fps budget _on a desktop_. Settled.

The split costs nothing extra because it **is** the resolve state: a cell developed into the lit
portrait goes to the tint layer, anything else to the field's, and each writes a space to the other. At rest one
layer is entirely spaces and its write is skipped — so the field spends almost all its life at
single-layer cost and only pays the double during the ~1 s decode.

Two layers measured **3×** single-layer cost, not 2× — overlapping repaint is superlinear. **Two is
the colour budget** for layers that change. A third changing layer is not affordable on mobile.

The test card's circle is a third `<pre>`, and does not break that rule: it never moves, so it is
written once per layout and never per frame. It costs paint, not text layout. Layers A and B leave
its cells blank, and `tests/e2e/field.spec.ts` holds all three to one cell each.

## The resolve

Per cell, a precomputed threshold, and an eased development past it rather than a hard swap:

```
threshold[i] = 0.50 * radialFromCentre(x, y)   // resolves centre-out
             + 0.30 * hash(x, y)                // organic dissolve texture
             + 0.20 * (1 - portraitLuminance)   // bright features first

w = smoothstep((p * 1.14 - threshold[i]) / 0.14)   // 0 = field, 1 = portrait
value = (1 - w) * field + w * (luminance + shimmer)
```

The face develops out of the field instead of being stamped onto it, and at rest the field's motion
carries on through it as a faint shimmer, so the two read as one surface.

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

Grid capped at 6000 cells on a 1440×900 screen, and scaled with the screen's area up to 2.2× that.
Capped, the glyphs grow to cover the screen, so without the extra cells a 2560×1440 display drew
the face in blocks too coarse to read as a face (Rick, 2026-09-25: "it's not really clear that
it's my face on there").

The portrait occupies a **square** box rather than the whole grid, 64% of the field's height (or
80% of its width, where that is smaller), because a face emerging from a still-live field reads far
better than a rectangle appearing. It is centred across the screen and on `--face-cy` down it: on
a wide screen that is above the circle's centre, so the name's box crosses the chin rather than
the smile; on a phone it is the circle's centre.

Only the lit part of the box is portrait. **The map's darkest level belongs to the field**
(`FIELD_LEVEL` in `field.ts`): where the photograph is black, the live field shows through. The box's
dark background used to count as portrait, and resolved it printed as spaces, so the face sat in
an empty rectangle cut out of the field. On the current map level 0 is exactly the matte around
the head; the darkest feature inside the face is level 1.

## The image pipeline

`scripts/build-portrait-map.mjs` uses sharp at build time to emit an 80×80, 12-level luminance map
as a packed ASCII string — **0.62 KB gzip**. Measured alternatives: base64 is 3× larger, a JSON
array 3.8×, because a small alphabet keeps deflate's match-finding working.

No image decode, no canvas and no pixel reads at runtime. The emitted artifact carries no EXIF, no
GPS and no camera metadata, because it is not an image any more.

The map is sampled at the **centre** of each cell. Sampled at its corner, the face drew about half
a cell right of and below where it belongs, which went unseen until a photograph sat under it.

The script also emits a **fully resolved static frame** which is server-rendered into the `<pre>`.

## The photograph under it

At the field's resolution a face can read as a pattern, most of all on a large screen (Rick,
2026-09-25: "it's not really clear that it's my face on there"). So the portrait photograph itself
sits under the characters, faintly: an ordinary `<img>` from the same `portrait.jpg`, printed in the
field's two colours by `.duo` (highlights in the face's tint, shadows in the field itself), laid on
at 0.42 so the shadows vanish into the field and only the light parts glow through, and feathered
at the edge so it never reads as a square.
The characters stay the picture; the photograph tells you whose it is.

It needs no JavaScript. Its box starts as the static frame's (64 columns of the field's monospace
by 32 lines, centred on `--face-cy`, as the frame's text is), so the no-JS and reduced-motion
portrait has it too. Live, the field lays the face out itself and publishes the box on the host:
`--port-w` and `--port-h`, and its corner as `--port-dx` and `--port-dy`, measured across from the
host's centre and down from the face's.

**The box never moves.** It stays pinned to the field's centre, and the handover changes only its
size and its `translate`. Moved by its insets instead, it measured **0.109 CLS** at 1440×900, the
whole page's budget and more, from one decorative element; at the vitals run's own viewport it was
0.087, under the budget, so the budget would not have caught it. `tests/e2e/field.spec.ts` asks the
handover for no layout shift at all.

Both boxes are right by construction, which is not the same as the faces lining up: the corner
sampling above passed every box check. `tests/e2e/field.spec.ts` compares the pictures instead,
blurred to the scale of a cell, in 2px steps, and fails if they correlate best more than one step
from none. The characters carry a bias of their own, a pixel or two, which moves with the number
of cells across the face: +1px at 69 columns, −1 to −2px at the test card's 54 (measured
2026-09-28). Moving the face's box a whole cell moved nothing, so it is the rendering, not the
geometry. The 4px steps the test used before put a 2px bias on the line between two steps, and the
field's shimmer decided which way it fell.

It is loaded eagerly at low priority and is not the LCP element: a `<pre>` is.

## The test card

Rick asked for the header to be "more visually impressive" (2026-09-28). Of three candidates
rendered at full size (a test card; a transmission, rings of characters leaving the head; the
masthead printed in ink on the yellow channel) he chose the test card. It is the language of the
Philips PM5544 card that Dutch television showed before the programmes (see
`DESIGN_REFERENCES.md`), drawn in the field's characters rather than traced.

- **The grid** is layer A outside the circle: `|`, `-` and `+` on a step of `--grid`, laid from
  the circle's centre, one cell wide. Its squares are empty, unless the pointer ripples them.
- **The circle** is layer C, rasterised as a line: one cell per column where it runs flat, one per
  row where it runs steep. Where it is flat, the glyph follows the line's height inside its cell
  (`'`, `-`, `.`, `_`), which is how an ASCII drawing makes a shallow curve read smooth; steep, it
  is `/`, `\` and `|`. Drawn as a band of every cell it touched, the first prototype came out two
  and three columns thick at the sides and one row thick at the top: a ring of hashes, not a line.
- **Inside the circle** the field runs faint (`FIELD_WEIGHT`, 0.36) and the face develops out of
  it, as it always has. The card is the frame; the face is the picture.
- **The castellations** down each side, the name, the colour bars, the synopsis and the clock are
  HTML, in `index.astro`. The name, the bars and the synopsis are one plate under the chin, solid,
  so neither the grid nor the face ever runs behind text. The clock sits in a box on the top of the
  circle and shows the visitor's own time, as the guide's does: to the second, only while the hero
  is on screen, and to the minute under reduced motion (`src/scripts/testcard.ts`).
- **The pointer.** The field is `pointer-events: none`, so a `pointermove` listener on it never ran:
  the disturbance this document described had never happened (30 moves over the hero, 0 calls).
  The hero listens now, and the ripple is local, fading over about 16 cells: as written it would
  have rippled the whole screen, which nobody had seen because it never fired.

**The geometry belongs to the stylesheet.** `index.astro` sets `--ring-cy`, `--ring-r`,
`--face-cy`, `--grid` and `--card-at` on the hero, and the renderer reads the first four through a
probe instead of deciding them. The boxes are laid out from the same properties before any script
runs, so the handover to the live card cannot move one, and the no-JavaScript card lines up with the
live one.

**Where the renderer does not draw it** — no JavaScript (`@media (scripting: none)`) and reduced
motion — the field's pseudo-elements draw the same grid and circle as plain lines, from the same
properties, under the static portrait. Not while a script is merely on its way: the live card
replaces the static frame within the first frames, and lines drawn twice would flash. Data saver
and a failed import get the portrait and the boxes without the lines.

## Degradation

| Rung                     | What the visitor gets                                                         | Cost     |
| ------------------------ | ----------------------------------------------------------------------------- | -------- |
| No JS                    | The resolved portrait, as text, over the photograph, on the card drawn in CSS | 0 JS     |
| `prefers-reduced-motion` | The same, zero frames; the clock shows the minute                             | 0 JS\*   |
| Data saver               | The portrait and the card's boxes, without its lines                          | 0 JS\*   |
| Import fails             | Same — the static frame stands                                                | —        |
| Non-monospace font       | Same — the renderer refuses to mount                                          | —        |
| Print / forced-colors    | `display: none`. It is decoration.                                            | CSS only |
| Offscreen / tab hidden   | Loop unsubscribes, RAF cancelled — it does not idle                           | —        |
| Full                     | The test card, decode on load, pointer ripple, dissolve on scroll             | 4.3 KB   |

\* No renderer. The page's own script, with the clock, still runs.

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
its highlights the channel's signal colour. That is `.duo` in `src/styles/surfaces.css`, and every
photograph on the site uses it.

**Key art does not.** A programme's picture on the guide and on its case study is shown as it is:
a logo is already its own colours, and printed in its channel's it lost them — NLZIET's pink logo in
crimson and pink was one pink block (Rick, 2026-09-25). The channel's colour stays in the screen's
frame and in the ground around it. Until then a cover whose tone was the opposite of its field
printed as a negative (`coverTone`, `coverPrint()`); both are gone.

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
seen; it shows only where the picture is dark. The plates are cut to the display face's metrics
(Bricolage Grotesque's, since 2026-09-25), so they meet without one covering the descenders of the
line above; the numbers are in the comment on `.art__plate`, and change with the face.

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
reader is never read noise. The display face is proportional, so a noise glyph is not the width
of its letter: before it starts, the decode measures every letter as rendered and holds each in a
box of exactly that width, words kept together, so nothing reflows; `tests/e2e/motion.spec.ts`
watches every frame of one for a word moving. Whitespace, and the zero-width characters that hold a
word together, are left alone. Under reduced motion nothing scrambles.

## Changing the portrait

1. Replace `src/assets/portrait.jpg`. Square, head and shoulders filling it: the characters and
   the photograph under them both stretch it to the portrait box.
2. `node scripts/build-portrait-map.mjs`
3. Commit the regenerated `src/generated/portrait-map.ts`.
4. Run `tests/e2e/field.spec.ts`: it holds the photograph and the characters to the same face.

The source needs: head-and-shoulders, **eyes visible** (the single feature that makes a
low-resolution face legible), strong directional light, and **a dark or plain background**. That
last one is not a nicety. Every lit cell gets a glyph, so a mid-tone background turns the portrait
into a textured rectangle with a face somewhere in it; the face has to come out of empty field.

The hero is a test card: the face sits in the circle, and on a wide screen above its centre, so
the name's plate crosses the chin and not the smile. A new portrait with the face lower in its
frame puts the smile under the plate: look at it at 1440×900 and at a phone's size.
`tests/a11y/hero-contrast.spec.ts` holds the copy's plates to their floor over the live field.

**Current state: interim.** `portrait.jpg` is Rick's portrait on black, retouched with an image
model and cropped tight to the head. Now that the photograph shows under the characters it is the
main subject of the page, and Rick is replacing it with a real selfie (2026-09-25: "I don't want
an AI generated image to be the main subject"). The photo worth taking: facing a window after
dark or on an overcast day, a plain dark wall behind, no cap, one side of the face lit and the other
in shadow. Two minutes with a phone.
