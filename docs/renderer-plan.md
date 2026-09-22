# The shared renderer — plan

**Status: approved 2026-09-22, not started.** No renderer code has been written and no existing rule
has been relaxed yet.

**Priority shift, same day.** Rick: _"It has to be visually stunning this portfolio, so maybe I'll
start to put less focus on performance."_ Performance is now explicitly subordinate to visual
ambition. The budgets below stay as instrumentation — they tell us what a choice costs — but they
are no longer a veto. A change that looks materially better and costs measurably more is now an
acceptable trade, made knowingly rather than discovered later.

Two things do **not** relax, because neither is a performance concern:

- **Accessibility.** Contrast, keyboard traversal, reduced motion and axe stay gates.
- **The document.** Content stays in HTML that survives without JavaScript. That is an
  accessibility and indexing property, not a speed one.

## What was decided, and what it costs

The brief asks for "one persistent shared WebGL/canvas renderer". `CLAUDE.md` forbade canvas
entirely — **canvas elements 0, WebGL contexts 0** — and two tests assert it
(`tests/budgets/payload.spec.ts`, `tests/e2e/field.spec.ts`). Rick chose the brief.

That reopens what was deliberately cut in Phase 2: a quality-tier system, DPR capping, context-loss
handling, poster fallbacks, and a deferred chunk that the old plan budgeted at ~25 KB gzip.

One finding makes it much cheaper than that estimate. Source 7 in `DESIGN_REFERENCES.md` implements
a full-screen Bayer dither wipe in **~3 KB of raw WebGL 1.0** — no Three.js, no OGL, an analytical
threshold computed in the fragment shader rather than sampled from a texture, and no idle render
loop. A dither is a fragment shader over a full-screen quad; it does not need a scene graph, a
camera, or a material system. **The renderer should be written against the WebGL API directly.**
`ogl` stays out.

All figures in that write-up are from a React/Next stack and must be re-measured here before being
repeated anywhere.

## The question that has to be answered first

The hero is currently a character field: text in two `<pre>` elements, 2.6 KB gzip, and — measured
this week — **the LCP element of the homepage at 848ms under 4x CPU throttle**. It is
server-rendered fully resolved, so a visitor with no JavaScript, with reduced motion, or on a slow
connection sees the finished portrait rather than an empty box.

A canvas cannot do that. A canvas is blank until JavaScript runs. That is precisely the failure
recorded against Unseen Studio, which measures 1 canvas and 665 characters of text in the entire
document.

So there are two coherent architectures, and they are not a matter of taste:

### Option A — renderer for photographs, text for the hero (recommended)

The character field stays exactly as it is and keeps the hero. The renderer takes the
**photographic** Decode treatment: project covers, the art interludes, and the page transition.

- The no-JS and reduced-motion story survives untouched, as does the current LCP.
- Each viewport still has one dominant effect: the hero has the field, a project panel has the
  dithered cover. They never share a screen.
- Two art systems, which reads as one only if they share a palette, a ramp and a threshold curve.
  That is a real risk and it is the thing to watch in review.

### Option B — renderer takes everything, including the portrait

The portrait becomes a dithered image rendered on the GPU; the character field is retired.

- Genuinely one system, which is what "create one signature visual system" asks for.
- Costs the no-JS hero, the reduced-motion hero, 2.6 KB of working art, and the current LCP element.
  Every one of those would need rebuilding as a static poster image, which is the poster-generation
  work that was cut.

**Still open after the priority shift.** Deprioritising performance removes one argument for A but
not the main one, which is that a canvas hero is blank without JavaScript. Step 2 of the staged
plan is identical under both, so this is no longer blocking.

**Recommendation: A.** It keeps the properties that are hard to get back and spends the renderer
where the brief actually wants it — on recognisable human photography transformed through ordered
dithering. B should only be chosen if the video shows the portrait treatment is the whole point, in
which case it is worth the rebuild.

This is Rick's call and it blocks the first line of renderer code.

## Architecture, once A or B is chosen

- **One context, created lazily** on first use, not at boot. `powerPreference: 'low-power'`,
  `antialias: false`, `alpha: true`, `preserveDrawingBuffer: false`.
- **One quad, one program.** Decode, Fracture and Field are threshold variations of the same
  fragment shader, selected by a uniform. Pulse is the exception and may not belong on the GPU at
  all — it is driven by musical time, not by pixels.
- **Render on demand.** A frame is drawn when an input changes: scroll position, pointer, a
  transition. There is no idle loop. The existing one-RAF-loop rule and its lint enforcement stay,
  and the renderer subscribes to `src/lib/field/loop.ts` rather than starting a second loop.
- **Reduced internal resolution**, upscaled with `NEAREST`. Dither wants hard pixel edges, so this
  costs nothing visually and is the single biggest performance lever.
- **DPR capped at 1.5**, per the brief.
- **Context loss is not optional.** `webglcontextlost` must `preventDefault()` and the page must
  fall back to the static image. On a Smart TV this is a question of when, not if.

## What must change in the same commit as the first renderer line

Not before, so that neither the documentation nor the tests lie in the meantime:

| File                            | Change                                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                     | "Canvas elements **0**, WebGL contexts **0**" becomes "at most 1 canvas and 1 context, created lazily, released on loss". The honesty note about "at most, not exactly" comes back. |
| `tests/budgets/payload.spec.ts` | Asserts **at most one** canvas and one `getContext` call per route, and zero on routes that should have none. It must still fail if a second context appears.                       |
| `tests/e2e/field.spec.ts`       | Its canvas assertion moves or relaxes in the same way.                                                                                                                              |
| `docs/performance.md`           | The renderer-rules section, deleted when WebGL was cut, comes back — `deleteTexture`, `loseContext`, `webglcontextlost`.                                                            |
| `docs/roadmap.md`               | The renderer reappears as a phase with a budget.                                                                                                                                    |

The canvas count must never simply be deleted as an assertion. It changes from 0 to a ceiling.

## Budget

|                      | Limit                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| Renderer chunk, gzip | **8 KB** trip-wire, 25 KB hard cap                                       |
| Canvas elements      | ≤ 1 per route                                                            |
| WebGL contexts       | ≤ 1, lazily created                                                      |
| Animation loops      | still exactly 1, shared                                                  |
| LCP                  | unchanged: < 2500ms budget, 1500ms trip-wire, median of 3 at 4x throttle |
| CLS                  | unchanged: < 0.1, worst of 3                                             |

The 8 KB trip-wire is set deliberately below the ~3 KB reference plus room for the image pipeline,
so the budget has teeth. `check-assets.mjs` enforces per-route JS weight already.

## Staged plan

The brief is explicit that the layout must work before the renderer exists, and that the dither is
proved on one photograph and one section before it generalises.

1. **Decide A or B.** Blocking.
2. Prove the Decode treatment on **one real photograph** in **one full-screen section**, as a static
   build-time image. No GPU. If it does not look right as a still, a shader will not save it.
3. Review that still. Only then write the renderer.
4. Renderer behind a flag, rendering that one section, with the static image as the fallback path
   and the tests and docs updated in the same commit.
5. Measure: LCP, CLS, chunk size, frame time, and behaviour under simulated context loss.
6. Generalise one section at a time, validating mobile, keyboard, reduced motion and no-WebGL at
   each step.

Real photography is a prerequisite for step 2 and does not currently exist. The interludes and the
portrait are generated placeholders, and the brief rules those out as the site's identity.
