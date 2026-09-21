# Roadmap

Direction, not scripture. Each phase ends with a gate you can _run_, not an opinion.

## Status

| Phase                                        | State        |
| -------------------------------------------- | ------------ |
| 1. Foundation                                | **Complete** |
| 2. Design system, shell & asset pipeline     | Next         |
| 3. Renderer core + Decode                    | Outline only |
| 4. Chapters & case studies                   | Outline only |
| 5. Transitions, PWA, SEO, a11y completion    | Outline only |
| 6. Easter eggs, 404 treatment, cross-browser | Outline only |
| 7. Real-hardware validation & launch         | Outline only |

Later phases are deliberately outlines. They get expanded against the real repository state when
their turn arrives — not guessed at today.

---

## Phase 1 — Foundation ✅

Replaced SvelteKit 1 with Astro 7. Content collections with real work copy, deep-linkable routes,
CI quality gates, and the service-worker kill switch.

**Gate — all verified:**

- `/`, `/work`, `/work/nlziet`, `/work/chromecast`, `/work/vamp` return 200 with no redirect;
  any other path returns a real 404.
- 25 Playwright tests pass: routing, smoke, axe on all 6 routes, payload budgets.
- `astro check` 0 errors · eslint 0 problems · prettier clean.
- Initial JS **2.04 KB gzip** (gate: < 10 KB). 0 canvases, 0 RAF loops.
- Repo assets **1019 KB** (gate: < 1.2 MB, from 6.9 MB). Zero EXIF markers.
- No third-party origins requested at runtime.

## Phase 2 — Design system, shell & asset pipeline — NEXT

**This is the real performance phase, and it must be shippable on its own.** If Phase 3 never
happens the site should already be dramatically better than what it replaced.

- Port the CSS/SVG visual ideas from `origin/feature/portfolio-new` — `Bokeh`, `Wave`,
  `HeaderHover`, `TopImage`. Port the _ideas_, not the code: every one of those components leaks
  listeners, and none has a `prefers-reduced-motion` guard.
- Real responsive chapter shell, navigation, no-JS baseline.
- `scripts/check-assets.ts` as a CI gate: per-image and per-route weight caps, EXIF markers, and
  `.map`/`sourceMappingURL` in `dist/`. Zero dependencies — `node:zlib` and `node:fs`.
- Retire `origin/feature/portfolio-new` once its visual work is ported.

**Gate:** `pnpm check:assets` exits 0 · LCP < 2.5 s and CLS < 0.1 on built output · no shipped
image over 300 KB · zero EXIF · keyboard traversal and axe clean **with JavaScript disabled**.

**Non-goals:** no canvas, no WebGL, no shaders.

## Phase 3 — Renderer core + Decode

One WebGL2 context, one RAF loop, one scene, full fallback ladder. See `docs/performance.md` for
the architecture and `docs/art-system.md` (to be written this phase) for treatments and uniforms.

Key decisions already made:

- **A single active-scene slot, not a scene registry.** The art rule is "one dominant treatment per
  scene", so only one is ever active by design. `setActiveScene(scene | null)` is ~30 lines.
  Promote to a registry when a _third_ scene actually ships.
- **The governor splits in two.** "Adaptive tiers from frame-time monitoring" and "prefer a
  triggered transition over continuous animation" are incompatible: a hero reveal runs ~900 ms and
  an EWMA needs seconds before it may act, so running adaptation would never fire on the scene that
  matters. A pre-flight capability probe is the entire governor for triggered scenes. Build the
  running EWMA only if an idle scene ever ships.
- **`potato` tier means poster-only** and the renderer is never imported — the gate sits _before_
  the dynamic `import()`, so a weak device pays zero bytes.
- **The poster is the shader's final frame**, rendered at build time via Playwright at a fixed seed.
  Because the canvas's terminal state matches the image beneath it, there is no pop at any rung.

**Gate:** deferred chunk ≤ 25 KB gzip · Playwright green including forced context loss, reduced
motion and no-WebGL rungs · poster-parity diff under threshold.

**Non-goals:** Fracture, Field, Pulse. Any second scene.

## Phase 4 — Chapters & case studies

The nine planned chapters as real content. Write the three featured case studies properly.

**Gate:** `astro check` clean · blocklist scan passes · no unpublished metric without recorded sign-off.

## Phase 5 — Transitions, PWA, SEO, a11y completion

**Gate:** installable · offline fallback matches the design · no stale HTML · sitemap and canonicals
agree.

## Phase 6 — Easter eggs, 404 treatment, cross-browser QA

The `jazz` key sequence on the site, the "lost signal" 404 treatment, console line.

**Gate:** typing `jazz` inside an `<input>` does nothing · Escape dismisses · zero timers and zero
listeners survive dismissal · reduced motion yields a static frame.

## Phase 7 — Real-hardware validation & launch

Where the Connected-TV thesis is actually earned; it cannot be faked in a lab. Real Smart TV
browser, an old Android device, a throttled connection.

**Gate:** a recorded trace per device class showing selected tier and achieved frame time · a
browser profile carrying the **old** service worker receives the new site.

---

## Deferred dependencies

Nothing on this list may be installed without moving it off the list first.

| Package           | Phase | Why deferred                                                                                                                                                |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@astrojs/mdx`    | 4     | Built-in `.md` is enough for prose. MDX earns its place when a page needs a component _inside_ prose.                                                       |
| `@astrojs/rss`    | 4     | No writing section exists. A feed of five static items is noise.                                                                                            |
| `@lhci/cli`       | 2     | Flaky on shared runners, and there is no design to measure yet.                                                                                             |
| `ogl`, `motion`   | 3     | Art renderer.                                                                                                                                               |
| `vite-plugin-pwa` | 5     | **`@vite-pwa/astro@1.2.0` peers `astro ^1–^5` and does NOT support Astro 7.** Wire `vite-plugin-pwa@1.3.0` through `astro.config`'s `vite.plugins` instead. |

That last row is the reason this table exists — it stops the next person reaching for the obvious
wrapper and losing an afternoon.

## Open items carried out of Phase 1

1. **NOS is held back on image rights, not content.** Its supplied cover is an ANP Kippa press photo
   carrying a visible credit. Needs an image Rick owns or is licensed to use, then drop `draft: true`.
   **Ajax and NH Nieuws covers need the same provenance check.**
2. **`nlziet.jpg` is 1200×675** — soft for a 2× hero. Re-export at ≥1920 px or cap its display width.
3. **Confirm the LinkedIn URL.** The old README used `/in/rick-groot-469777193/`, the unreleased
   branch used `/in/r-groot/`. The vanity URL is assumed current but is unverified.
4. **Archive Regular was not carried over.** It shipped with no licence file and its redistribution
   terms could not be verified. Phase 2 owns typography — either license it properly or choose
   another display face.
5. **Ajax and NH Nieuws periods are inferred** and marked unconfirmed in their frontmatter.
6. **Stale remote branches** (`develop`, `first_site`, `sveltekit`) are still to be pruned, which
   makes the old `icov` blobs and the 2021 "fix: remove public info" commit unreachable.
7. **Firebase console follow-ups** — see `README.md` § Security.
