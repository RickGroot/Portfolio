# Design references

Sources for the visual direction, and what is deliberately **not** taken from each.

This file exists so that inspiration does not quietly become imitation three refactors later. Every
row below was written after visiting the site at 1440×900 in a real browser on 2026-09-22, not from
design vocabulary. Where a claim is a measurement, the measurement is given.

None of these are permission to trace layouts, copy animation timings, reuse assets, or reproduce
another studio's identity.

---

## 1. Studio Freight — <https://studiofreight.com/>

|                            |                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observed**               | At rest the viewport is almost entirely empty. Every navigation item is pinned to the perimeter — mark top-left, section links top-right, socials bottom-left, wordmark bottom-centre, legal bottom-right — leaving the centre for a single statement (`Moving Missions Forward`). The centre is reserved for one idea, not filled. |
| **Adapt**                  | Perimeter-anchored chrome and a centre that holds exactly one subject per viewport. The rail and nav already sit at the edges; push further by letting sections carry far less furniture.                                                                                                                                           |
| **Deliberately different** | No orbiting collage of image fragments. We have a handful of real project covers, not dozens, and a collage of four images reads as thin rather than abundant. Navigation will never depend on finding a floating image.                                                                                                            |

> The site is heavily animated: a scroll-then-screenshot attempt timed out after 5s waiting for the
> page to finish rendering. Worth remembering as a counter-example — this is the cost profile the
> performance budget exists to avoid.

## 2. Obys — <https://obys.agency/>

|                            |                                                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observed**               | The project index carries **categorical metadata, never prose**: each entry is name + industry + disciplines + a zero-padded number (`01`…`18`). No descriptive blurbs anywhere in the index.                     |
| **Adapt**                  | Drop the prose summary from the one-pager panels in favour of the metadata that is already in the content model (`role`, `company`, `period`, `tags`). The zero-padded index is already in use and should stay.   |
| **Deliberately different** | No three-view switcher. With four case studies, alternate vertical/horizontal/grid views would be three ways to look at the same short list, which is the gimmick the brief warns about. No hover-only discovery. |

## 3. Mouthwash Studio — <https://mouthwash.studio/>

|                            |                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Observed**               | Opens with a plain declarative paragraph in ordinary sentences — who they are, who they work with, three named clients. No slogan, no abstraction. Work is then filtered by **Industry**, each project listed with its disciplines. A separate `Our Ecosystem` block holds the side projects (a café, a newsletter, a magazine) without pretending they are client work. |
| **Adapt**                  | The opening paragraph model: concrete nouns, named things, no slogan. And an "ecosystem" beat is the honest home for VAMP, the trumpet material and the lab experiments — adjacent to the work, clearly not client work.                                                                                                                                                 |
| **Deliberately different** | No agency voice, no "influence culture". One person, first person.                                                                                                                                                                                                                                                                                                       |

## 4. 2xA — <https://2xa.studio/> and <https://2xa.studio/projects/miao-world>

The closest reference to where this site is already heading, and the most useful of the seven.

|                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observed**               | Exactly **two type families**, measured on the project page: a custom variable monospace (`2XAMONOVF`) and `HelveticaProRoman`. The contrast the studio describes as "Low Tech and High Life" is mono against a neutral grotesque — _not_ two grotesques. Project metadata is a labelled key/value block in mono caps: `PROJECT / TYPE / SERVICES / COUNTRY / YEAR / AWARDS`. Headlines break to one word per line as typographic planes (`Code- / Driven / Design / Studio`). Live local clocks for both studio cities sit in the header (`ATH(GR) 09:38  AMS(NL) 08:38`) — real state, not decoration. Projects are numbered `(01)`. |
| **Adapt**                  | The mono-plus-neutral pairing as the answer to the type question. The labelled metadata block. Word-per-line display setting for the identity section. One piece of genuinely live state in the chrome, if an honest one exists.                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Deliberately different** | No fake terminal copy and no invented technical artifacts. A live clock is real; a fake build log is not. The project page runs 3 canvases; ours runs none (see the conflict register below).                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## 5. Unseen Studio — <https://unseen.co/>

|                            |                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Observed**               | **Measured: 1 `<canvas>`, 22 links, and 665 characters of text in the entire document.** `<main>` contains one word: "Home". The experience _is_ the canvas; there is essentially no document underneath it.                                                                                     |
| **Adapt**                  | The idea of one unmistakable opening interaction.                                                                                                                                                                                                                                                |
| **Deliberately different** | This is the exact failure the brief rejects — "requiring WebGL to reach content". It is also a recruiter reading a portfolio with JavaScript blocked and finding one word. Our hero is server-rendered text that is already correct before any script runs, and that property is not negotiable. |

## 6. Studio Feixen — <https://www.studiofeixen.ch/>

|                            |                                                                                                                                                                                                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observed**               | A `Quick Links` set of small, concretely-named things (Fonts, Poster Shop, Graphic Design Workflow, The No Book, Nearby, Newsletter), each with one plain sentence of dry copy: _"Do you have an empty white wall at home? Here you'll find some colors!"_ Plainly stated, mildly funny, zero portfolio-speak. |
| **Adapt**                  | **This is the answer to the copy problem.** Name a concrete thing, say what it is in one plain sentence, allow one dry joke. It is the opposite of the aphoristic register currently in `src/lib/practice.ts`.                                                                                                 |
| **Deliberately different** | No icon-only primary navigation. A small symbol set for the visual languages may exist, but every symbol needs a plain-text equivalent.                                                                                                                                                                        |

## 7. Sora UI dither transition — <https://ui.soralabs.studio/blog/dither-page-transition-webgl>

Engineering reference only; the visual direction is not taken from here.

|                            |                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observed**               | Claims a 3 KB raw WebGL 1.0 implementation (no Three.js), Bayer-matrix threshold computed analytically in the shader, ~48 bytes of VRAM, shader compile under 2 ms, and **no idle render loop** — the context exists only for the duration of a transition. The article credits 2xa.studio as its visual source, which makes 2xA the root reference rather than this. |
| **Adapt**                  | The shape of the idea: a transition-only effect with no persistent renderer, and timing coupled to real navigation state instead of a blind timeout.                                                                                                                                                                                                                  |
| **Deliberately different** | All figures are from a React/Next App Router stack and must be re-measured here before being repeated. The orchestration is Next-specific and does not port to Astro's static output. Whether we take the WebGL path at all is an open decision — see the conflict register.                                                                                          |

---

---

## The reference video — analysis

`portfolio-dither-reference-video.mp4`, supplied 2026-09-22.

**The file is truncated.** The container header declares 311s (5:11), but only **840 frames — 28.0
seconds** of video data are present; the decoder hits `partial file` at an offset past the end of
the file. The copy used here is byte-identical to the original (same MD5), so this is the source
file, not the transfer. Everything below is from those 28 seconds. Roughly 91% of the video was
never received, and nothing in it has been guessed at.

It is a screen recording of an Instagram reel, whose own caption states the subject:

> "How to create an ASCII block effect with the help of a free website tool! Grainrad is super
> underrated and that's why I wanted to make a little tutorial"

### What is actually being shown

| Time     | What is on screen                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.5s     | A face rendered in **dense, per-character coloured ASCII** — skin tones, red lips, teal shadows, all sampled from the source photograph. Caption: "Let me show"            |
| 3.0s     | **The "ASCII block effect"**: large, sparse, amber-on-black characters, letterforms individually readable (`/	f`, `fjxvYU`, `rnvYQ0`, `xuzJ0d`). Caption names it directly. |
| 4.5s     | A figure with RGB channel-offset / pixel-sort glitch, magenta and cyan fringing                                                                                            |
| 7.5–9s   | The tool identified: **grainrad.com**                                                                                                                                      |
| 16.5s    | The tool's **Settings** panel, fully legible (see below)                                                                                                                   |
| 18–22.5s | Character Set switched between `DETAILED` and `BLOCKS`, showing the difference                                                                                             |
| 19.5s    | The **Export** panel: PNG, JPEG, GIF, **SVG**, **Text (.txt)**, Three.js (.html)                                                                                           |

### The parameter surface Rick is reacting to

Read directly off the panel at 16.5s:

- **ASCII** — Scale `2`, Spacing `0.0`, Output Width `0`
- **Character Set** — `STANDARD`, `BLOCKS`, `BINARY`, `DETAILED`, `MINIMAL`, `ALPHABETIC`,
  `NUMERIC`, `MATH`, `SYMBOLS`
- **Adjustments** — Brightness, Contrast, Saturation, Hue Rotation, Sharpness, Gamma
- **Color** — Mode `Original`, Background, Intensity `1.0`

### What this changes

**The reference is text, not a photographic shader.** The signature treatment in the video is
characters on a grid — and the export formats confirm it: a tool whose output options are `.txt`
and `.svg` is not producing a raster dither. The character field already built here is the same
technique, and the 3.0s "ASCII block effect" frame is close to what this site's hero already does
in amber.

So the gap is narrower and much more specific than "add WebGL". Three things are missing:

1. **Per-character colour sampled from the source.** Ours is two fixed colours, where `Mode:
Original` samples each cell from the photograph. This is the single biggest visual difference,
   and it is the one measured at **40.71ms per frame** with one `<span>` per cell — the
   measurement that killed the DOM approach. **This, not photographic dithering, is the real case
   for the GPU.**
2. **Selectable character sets.** One ramp today against nine presets there.
3. **Scale and spacing as controls** rather than constants.

This reframes the renderer: its job is to make **the character field itself** full-colour and
higher-resolution, not to replace it with a halftone shader. That reconciles the decision with the
one property worth keeping — a hero that is server-rendered text and correct before any script
runs.

### Deliberate differences

- **Grainrad is a tool; this is a portfolio.** A settings panel exposing nine character sets and six
  adjustments is the right interface for an editor and the wrong one for a site. The parameters get
  chosen once, by Rick, and baked in.
- **No glitch as identity.** The channel-offset frame at 4.5s is the brief's "Fracture", explicitly
  a rare, occasional language. Permanent glitching harms legibility.
- **Not a face filter.** The reel applies the effect to stock faces for the demo. Here it resolves
  into a specific person, which is why the portrait has to be real.

### The complete video (re-exported 2026-09-22)

The second export decodes fully: **9329 frames, 5:10.96, 128 MB**, no errors. The analysis below
supersedes the truncated read above, which saw only the first 28 seconds — about 9% of it.

**What it actually is:** a screen recording of a saved-reels collection on Instagram, scrolled
through in a browser. It is not one curated art-direction reference, and most of it is tool
bookmarks rather than visual direction — `motion.dev`, `componentry.dev`, `particles.casberry.io`,
`manus.im`, `playgrnd.tools`, a QR generator, an orb shader. Those are worth keeping as a
bookmark list; they are not a look.

Filtering to the frames that are art direction, the signal is consistent:

| Time   | What is on screen                                                                                                            | Language                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 0–35s  | The Grainrad ASCII tutorial analysed above — coloured ASCII portraits, the "ASCII block effect", the nine character sets     | **Decode**                  |
| 30s    | A face under hard **horizontal scanlines**                                                                                   | **Fracture**                |
| 87.9s  | Black **halftone dots on saturated yellow** — an organic blob resolved entirely in dots                                      | **Decode**, at poster scale |
| 228.5s | A photograph **sliced into a rotated grid of tiles**, recomposed                                                             | **Fracture**                |
| 240s   | White dithered noise on **electric blue**, driven by a control panel reading `INFLUENCE RADIUS`, `FORCE SCALE`, `MAX DEFORM` | **Field**                   |
| 270s   | **"ROTATING ARC GRID S87"** — a black-and-white op-art arc pattern above a small mono caption block                          | **Field**                   |
| 300s   | A flat **red / yellow / black geometric poster** — hard bands, zigzags, one gradient                                         | —                           |

### What this says that the first 28 seconds did not

1. **The palette is wrong.** Every art-direction frame here is built on **flat, saturated colour** —
   yellow, electric blue, red — carrying black or white marks. The site is currently a lifted
   near-black with two accents used sparingly. Nothing in the references looks like that. This is
   the biggest single gap between the built site and the reference, and it is a bigger change than
   the renderer.
2. **The poster layout at 270s is already the panel structure here**: one large graphic field, a
   display title, and a small mono caption block beneath. That is `WorkPanel.astro`. The difference
   is entirely treatment and colour, not composition.
3. **Fracture has more evidence than expected** — scanlines at 30s and tile-slicing at 228.5s are
   two separate instances, so it is more than an occasional accent.
4. **The Grainrad section remains the most developed single idea**, and it is still the only part
   with a caption naming what it is. Treat it as the primary language; the rest sets the palette
   and the pattern vocabulary.

### What is deliberately not taken

- The tool bookmarks. A particle playground and a QR generator are not this site's identity.
- The saturated-poster colour applied wholesale. Two to four colours per section, per the brief;
  a project already owns its accent, and that system should absorb the shift rather than be
  replaced by it.

## Conflict register

The brief that produced this file assumes some things the repository had already decided against,
on evidence. Recorded here so the disagreement is explicit rather than discovered later, and so the
resolutions are not re-litigated next session.

**Decisions taken 2026-09-22 by Rick.**

Including one that reframes the rest: **visual impact now outranks performance.** The budgets stay
as measurement, not as a veto. Accessibility and the no-JavaScript document are explicitly not part
of that trade — see `renderer-plan.md`.

| #   | The brief asks for                                                                                           | The repository does                                                                                                                                                                               | Resolution                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "One persistent shared WebGL/canvas renderer", DPR capped ~1.5, poster fallbacks                             | `CLAUDE.md`: **canvas elements 0, WebGL contexts 0**, asserted on every route by two tests. The hero is text in two `<pre>` elements, 2.6 KB gzip.                                                | **Brief wins — full shared renderer approved.** The 0-canvas prohibition in `CLAUDE.md` and the assertions in `tests/budgets/payload.spec.ts` and `tests/e2e/field.spec.ts` are to be rewritten _in the same commit as the renderer_, not before. Refinement from source 7: a dither wipe is ~3 KB of raw WebGL 1.0, not a library, so this need not cost the ~25 KB the cut OGL plan assumed. |
| 2   | "Do not default to Inter, **Space Grotesk**, Sora, or another predictable pairing without a specific reason" | Ships Space Grotesk 700 as the display face.                                                                                                                                                      | **Open — candidates being proposed.** See `/design/type`. The question is reframed by source 4: mono against a neutral, not grotesque against grotesque.                                                                                                                                                                                                                                       |
| 3   | "No endless rounded cards, pill buttons, bento grids"                                                        | `--radius: 4px`, `--radius-lg: 10px` across panels and cards; `border-radius: 999px` pills in `Nav.astro` and `TagList.astro`.                                                                    | **Deferred.** Revisit as one deliberate pass once the art direction is settled, rather than piecemeal.                                                                                                                                                                                                                                                                                         |
| 4   | "No constant cursor-chasing", "no every-text-line reveal"                                                    | Custom cursor with trailing ring and proximity glow, plus scroll reveals on most blocks.                                                                                                          | **Deferred**, as above. Note this one also contradicts an explicit earlier request for a section-following pointer, so it needs a real decision rather than a default.                                                                                                                                                                                                                         |
| 5   | "Use only one dominant effect in any viewport"                                                               | A work panel runs dither, hover sheen, four corner brackets, idle signal bars, parallax and a proximity glow at once.                                                                             | **Deferred**, as above.                                                                                                                                                                                                                                                                                                                                                                        |
| 6   | "Do not use generated images as the site's identity"; prioritise real photos and project material            | Resolved: both interludes, the _How I work_ backdrop and the contact photo are Rick's own photographs. The hero portrait is a real photo of Rick, cropped and matted, pending a purpose-shot one. | **Resolved 2026-09-23**, portrait interim.                                                                                                                                                                                                                                                                                                                                                     |
| 7   | Bayer dithering as the primary "Decode" language                                                             | Bayer was removed from the character field after a side-by-side test: at one matrix cell per character cell it has a ~36×64 px period and reads as a screen-door lattice.                         | **Resolved — both are true at different scales.** Bayer is correct at image and shader resolution, where the period is sub-pixel, and wrong at character-cell resolution. The approved WebGL renderer works at the scale where Bayer belongs.                                                                                                                                                  |

## Still blocked

The brief's first deliverable is an analysis of a screen recording, with timestamps. **No video has
been supplied** — only the brief itself. Nothing in it has been inferred, invented or substituted
from the reference sites. The art-direction statement and design system that depend on it are
waiting on that file.
