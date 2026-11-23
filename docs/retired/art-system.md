# The art system

Three kinds of art on the site, all in the channels' colours, all one bit where the machine can:
the masthead (channel 01), the photographs — the interludes, How I work, Contact — and key art on
the guide and the case studies. Everything that moves runs on the one animation loop
(`src/lib/field/loop.ts`).

## The masthead

Channel 01 is the first programme in the guide (`src/components/Hero.astro`, 2026-10-14). Rick
asked for the test card to go and for the header to "go with music, maybe a dither 1-bit art with
music characters". Three music-only candidates came first — a trumpet printed in one bit with a
staff opening out of its bell, a tracker pattern, a broadcast waveform — and his answer was "I still
want an image there, but better UI/UX". Three photo layouts followed (a score, a lower third, a
programme); he picked the programme, with the gallery photograph.

**It speaks the guide's grammar.** CH 01 and ON AIR, the name as the title, the role as the meta
line ("Connected TV developer · Trumpet"), the synopsis, and the guide's own buttons: _See the
work_ to `#work`, _Get in touch_ to `#contact`. A visitor knows in one look who this is, what he
does, and where to go next. The test card said none of that until you read the plate under its chin.

**The screen is a photograph in the print.** `gallery.jpg` — Rick in a cap and glasses, smiling, in
a white-walled gallery — is a `.duo` frame marked `data-dither`, so the 1-bit print draws it ("The
print", below) with everything that comes with it: the small lens under the pointer, the
hum bar, the dissolve on the scroll, `.duo` without a GPU. Paper on the ink field at one-pixel dots,
the rule for faces. Lifted to 1.2 (contrast 0.95): his face is in the shade of his cap against a
white wall, and at 1.0 it printed as a dark blob. The source is cropped square and centred on him,
so the desktop's 4:3 screen crops it top and bottom and a phone's 4:5 either side; the first crop,
4:3, gave the painting behind him more of the screen than him.

**The soundtrack is a tracker.** "When the Saints Go Marching In" — traditional, public domain, a
trumpet standard — as a four-channel tracker pattern (`src/lib/hero/tune.ts`): trumpet, bass, keys,
drums, written for trumpet in C at 112 bpm, two rows a beat. Text in the field's monospace, so it
needs no GPU and no font beyond the system's; the row that plays is a plate of the accent, the
guide's focus; each channel has a level meter of sixteen segments, one bit, never a gradient.
**It is server-rendered at row 0**, so without JavaScript and under reduced motion it stands as
written; `src/lib/hero/tracker.ts` only steps it, a row at a time the way a tracker scrolls,
ambient on the loop and only while the masthead is on screen. A phone's panel is narrow enough to
show the trumpet and the bass.

**What was cut with the test card**: the character field and its renderer, the portrait map and the
script that built it, `portrait.jpg` (an AI-retouched interim portrait Rick wanted gone), the test
card's clock, and the castellations. Their lessons are in `docs/retired/character-field.md`.

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

## The print

Since 2026-10-13 a photograph is printed in **one bit** where the machine can: the same two colours
as `.duo`, each pixel one or the other, as an 8×8 ordered (Bayer) dither drawn by a fragment
shader (`src/lib/dither/`). Rick picked it from three full-size candidates rendered on the
interludes — ordered, blue noise, and scanlines that tuned in like a set finding a station — and
2px dots over one device pixel.

**Why the GPU, for this.** CSS can grey and tint a picture but cannot dither one, and baking the
dither into the file failed (above: it doubled with the page's own screen, and cost 507 KB where
the photograph cost 67). A shader is "treat at display time" done properly: the source stays a
photograph, and the dither is laid at the screen's own pixels. It is also where Bayer is right: at
one matrix cell per character cell it was a screen door (`docs/retired/character-field.md`, "The
resolve"); at one cell per two
pixels its period is below what the eye resolves.

**Whole device pixels.** A dot is `--dither-dot` CSS px (2 by default), rounded to whole device
pixels: 2 at 1×, 3 at 1.25× and 1.5×, 4 at 2×. The canvas is sized from `device-pixel-content-box`,
checked against `devicePixelRatio`, because an emulated device scale (devtools, Playwright) reports
the real screen's box: the first build drew retina screens at CSS resolution, with dots twice the
size. `image-rendering: pixelated`, so a dot moved a fraction of a pixel by the parallax stays one
colour.

**The tone**, on top of the duotone's levers:

- **Unsharp mask** from the mip chain (0.9, 2.5 levels down). One bit has no grey to spend on an
  edge: without it the clock face's numerals dissolved into the dither.
- **Contrast × 1.15.** A large near-white area is a screen of dots; clipped, it reads as colour.
- **Coverage = tone^1.5.** Half the dots lit reads lighter than a 50% grey.
- **Faces get their own levers.** The two photographs of Rick set `--dither-dot: 1` and
  `--dither-lift`/`--dither-contrast: 1`. At 2px his face in the talk was some 55 dots across and
  read as a stencil, in the contact photo 30, and the duotone's lift of 1.2 sent his skin to blank
  paper. At 1px with no lift both are him again. The interludes keep 2px.

**The fade is dithered too.** `.art__fade` and `.practice__fade` were gradients to the field; a
gradient over one bit is two treatments at once, so the shader fades the tone into the field
instead, between the two positions in `--dither-fade`. The interludes' fade lands at 80% of the
frame, not the gradient's 92%: a stray dot behind the small caption is noise where 8% of a gradient
was not, and `tests/e2e/dither.spec.ts` holds the caption to pure field.

**Tuning in.** When a channel comes on (`section:enter`, from the advance), its photographs drop to
the field and come back as a Bayer dissolve, in blocks of 4×4 dots leaning down the picture, over
1.1 s, a beat after the headline starts to decode. Transient work on the one loop, every frame. A remote jump announces its channel before the scroll brings it near enough to mount, so a
print that mounts within 900 ms of its channel coming on catches up. A scroll by hand, a deep link
and reduced motion land on the finished print.

**Where it does not run, `.duo` stands**, unchanged and complete: no JavaScript, no WebGL2, forced
colours, a lost context (until it is restored), and a software GPU. That last is refused twice,
because `failIfMajorPerformanceCaveat` is a hint Chrome does not always take — headless Chromium
hands back SwiftShader with it set — so the renderer also reads the driver's name (SwiftShader,
llvmpipe, WARP). The tests set `window.__ditherSoftware = true` to run it there.

**Alive** (2026-10-14). Rick asked for "something that also seems more alive instead of only an
appearing thing", and picked two of three candidates together: A, live signal, and B, touch. The
third, key art printed in the test card's colours, broke the rule below and was not picked.

- **A, on air.** A soft hum bar rolls down every 7 s and bends the picture sideways as it passes; a
  photograph's dots near their threshold flicker at 12 steps a second (the field and solid shapes
  never do: the threshold is clamped, so pure tone stays pure); key art twinkles with a few dots of
  the field. Key art's idle push — guide-push and info-push, the CSS it had — is drawn by the
  shader now, so the picture moves under a fixed dot grid instead of the grid scaling with it.
- **B, answering.** Under a mouse or pen, a small lens (56px) shows a photograph at one CSS px a
  dot. Its edge is not drawn: each dot decides by its own threshold where the lens ends, so it
  frays into the picture. A flick (over 1.8 px/ms) sends a faint ring of dots out from the pointer,
  at most one every 260 ms. Both were louder until 2026-10-14 — a 120px lens ringed in the
  channel's colour, ripples from a hand at an ordinary pace — and Rick found the hover "a bit too
  much and pulse too much".
  A photograph dissolves into the field as its channel scrolls away (how much of the screen its
  section fills, from an IntersectionObserver ladder, never a layout read in a frame), and a case
  study's stage dissolves from the foot up once a quarter of the head has gone. A finger is
  scrolling, not pointing: touch gets no lens and no ripples.
- **Key art keeps its own colours.** The guide's screen and a case study's stage are drawn in the
  picture's colours with the field's dots over it — the hum bar, the twinkle, the ripples, the
  fade — and keep them under the pointer: no lens there, which in one bit turned a disc of the
  picture monochrome. A change of programme on the guide is snow in the field and accent colours,
  then the new picture through it in Bayer order (380 ms), in place of the CSS static burst, and
  with no static over the rest of the page; `guide.ts` announces it as `guide:tune`. One canvas serves the whole
  guide and is carried to whichever screen is on.
- **The stage's fade must clear the title.** A case study's foot was a CSS gradient; dithered, it
  is the stage's dots fading into the field, solid 24px above the title's first line (the fade
  follows the scroll a frame behind the title, which CSS lifts). `tests/e2e/dither.spec.ts` holds
  the title to pure field.

**When it draws.** Ambient frames (the life at rest) on the loop's ambient tier, at most 30 a
second, only while the picture is on screen, so the loop steps them down on a slow machine and
holds them while the page changes channel. Transient frames (a tune-in, a change, the pointer, a
ripple, a scroll) every frame, until they are done. Under reduced motion there is no life at all:
the print is still, and drawn on a resize and a new image only.

**Cost.** 6.9 KB gzip, imported when the first picture comes within half a screen; each picture gets
its own context only then, so the top of the page creates none. Measured in the lab on SwiftShader
only: **not yet on a real GPU** (roadmap, open item 15).

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
