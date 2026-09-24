# CLAUDE.md

Engineering rules for this repository. Short on purpose — if a rule here is wrong, fix the rule.

## Stack

Astro 7 (static output) · strict TypeScript · native CSS with custom properties · vanilla TS.
**No UI framework runtime.** Deployed to Firebase Hosting at <https://rickgroot.nl>.

## Pinned versions — and why

| Pin                | Reason it is pinned                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node `24.21.0`     | `eslint-plugin-astro` declares `^22.22.3 \|\| ^24.16.0 \|\| >=26.3.0`. **Node 25 falls in the gap** and `engineStrict` will refuse to install. 24.x is the current LTS (Krypton).       |
| TypeScript `6.0.3` | `@astrojs/check` peers `^5 \|\| ^6` and `typescript-eslint` peers `>=4.8.4 <6.1.0`. **TypeScript 7 breaks both.** Do not upgrade without checking both peer ranges.                     |
| `eslint 10.10.0`   | 10.11.0 exists but was published inside the 3-day `minimumReleaseAge` quarantine. Step forward once it ages out.                                                                        |
| `sharp 0.35.4`     | Astro lists sharp in its own `optionalDependencies`, but **pnpm's strict layout makes it unresolvable from the project root**, so Astro's image service fails. It must be a direct dep. |

Everything is pinned exactly, not caret-ranged. The lockfile should be the only source of drift.

## Commands

```bash
pnpm install --ignore-scripts   # required flag; see pnpm rules below
pnpm setup:browsers             # REQUIRED after install -- @playwright/test has no install hook
pnpm dev
pnpm typecheck                  # astro check -- the gate for .astro files, tsc cannot see them
pnpm lint                       # eslint + prettier --check
pnpm build
pnpm test                       # playwright: e2e + a11y + budgets (excludes @vitals)
pnpm test:vitals                # LCP/CLS at 4x CPU throttle -- SINGLE worker, see below
pnpm jazz                       # opt-in easter egg. Never wired to install/build/CI.
```

`build` is plain `astro build`, not `astro check && astro build`, so CI gets a separately
attributable failure. The trade-off: a local `pnpm build` will not catch type errors — run
`pnpm typecheck` first.

## pnpm rules

- **Settings live in `pnpm-workspace.yaml`, never `.npmrc`.** Since pnpm 10, only auth and registry
  settings are read from `.npmrc`; anything else there resolves to `undefined` and silently does
  nothing. Verify with `pnpm config get minimumReleaseAge` → `4320`.
- `minimumReleaseAge: 4320` quarantines new releases for 3 days. If a genuine security patch is
  blocked, the escape hatch is `pnpm install --config.minimumReleaseAge=0` — **do not edit the
  policy file in a panic.**
- `onlyBuiltDependencies: []` means no package may run install scripts. This is the real control;
  `--ignore-scripts` is belt-and-braces.

## Hard prohibitions

1. **No UI framework runtime.** Islands are for islands.
2. **No new dependency without a line in `docs/roadmap.md`** saying which phase it belongs to and why.
3. **Do not delete `public/service-worker.js` before ~2027-09.** It is a kill switch retiring the v1
   SvelteKit service worker, which cached the old site cache-first. Deleting it re-opens the bug for
   anyone who has not visited since the migration.
4. **Do not add Astro's `ClientRouter`.** Static output means every navigation is a fresh document,
   so the field's RAF loop, its observers and its listeners are torn down by the browser for free.
   ClientRouter would keep them alive across navigations and require real per-navigation teardown,
   for no benefit on a CDN-served static site. Page transitions use CSS `@view-transition` instead,
   which needs no JavaScript at all.

## Structural rules

- **`global.css` is imported exactly once, in `BaseLayout.astro`.** Never `@import` it from a
  component. The previous site `@import`ed its style barrel inside every component's `<style>`
  block, which duplicated `@font-face` and two Google Fonts CDN requests into all 8 stylesheets.
- **No third-party origins at runtime.** Fonts are self-hosted. A test asserts this.
- `src/assets` for anything imported (hashed, resized, intrinsic dimensions). `public/` only for
  files something outside your HTML references — favicons, manifest, robots.txt, the service worker,
  CSS-referenced fonts.
- Content lives in `src/content/work/*.md`. **Zero content in `.ts` files.**
- **Every colour comes from `src/lib/channels.ts`.** Each full-screen section is a _channel_ — one
  flat field — and declares which one; its text colour is solved against the field at build time and
  the build fails below 4.5:1. Stylesheets only read `--field`, `--mark`, `--mark-dim`, `--accent`.
  No hex values in CSS, and no darkening a photograph to make text legible — photos print in their
  channel's colours (`.duo`), and text that crosses one sits on a plate of the field.
- **Public files are not hashed.** `/fonts/**` is cached `immutable` for a year, so a changed font
  gets a new file name. Never overwrite one in place.
- **After a content schema change, delete `node_modules/.astro/data-store.json`** and restart the dev
  server. `astro check` writes that cache, and the dev server keeps serving the old shape from it —
  a new field reads as `undefined` with no error.
- **Full-bleed bands go on a `bleed` page** (`BaseLayout`'s prop: `<main>` goes full width, and each
  band draws its own column). Never `calc(50% - 50vw)`: vw counts a classic scrollbar, so on Windows
  the band is 15px wider than the page and the page scrolls sideways. Playwright hides scrollbars;
  only `tests/e2e/scrollbars.spec.ts` can see this.
- **CSS is minified by esbuild, not Lightning CSS** (`astro.config.mjs`). Lightning folds
  `animation-timeline` into the `animation` shorthand, which is invalid, and the browser drops it:
  every scroll-driven animation was dead in the production build, and nothing failed.

## Budgets

| Budget                      | Limit                                                     |
| --------------------------- | --------------------------------------------------------- |
| Initial JS, homepage        | ≤ 20 KB gzip                                              |
| Deferred art renderer chunk | ≤ 25 KB gzip — a trip-wire, not an allowance              |
| Total JS, homepage          | ≤ 45 KB gzip                                              |
| LCP / CLS                   | < 2.5 s / < 0.1, plus an 1800 ms LCP trip-wire            |
| Canvas elements             | **0**, asserted on every route                            |
| WebGL contexts              | **0** — the art is text; there is no GPU path             |
| Animation loops             | **exactly 1**, throttled to 60fps, stopped when offscreen |

INP is field-only. Use TBT as the lab proxy; do not claim Lighthouse measures INP.

LCP and CLS are measured by `tests/budgets/vitals.spec.ts` at **4x CPU throttle**, because this is
a portfolio about software that runs on hardware you do not choose. It is tagged `@vitals` and
excluded from `pnpm test`: the default run uses 8 workers, and a throttled measurement taken while
seven other browsers fight for the same cores measured over the 2.5 s budget against 788 ms on an
uncontended machine. Run it with `pnpm test:vitals`.

Phase 1 asserted 0 canvases **and** 0 RAF loops, specifically so that adding a loop had to be a
deliberate edit. Phase 2 made that edit: the character field runs one loop. The canvas assertions
got _stronger_ — a canvas appearing now means someone reintroduced a WebGL path that was cut.

`eslint.config.js` restricts `requestAnimationFrame` everywhere except `src/lib/field/loop.ts`, so
"one loop" is enforced rather than requested.

## The art system

The hero renders as text in two `<pre>` elements. No canvas, no WebGL, 2.9 KB gzip.
See `docs/art-system.md` before touching `src/lib/field/`.

## Content rule

> The programme guide is the complete record: every non-draft entry is a programme on it, and has
> its own page at `/work/<slug>`.

Publishing an entry also requires updating the guard in `src/pages/work/[id].astro`. That is
deliberate friction.

## Publishing hygiene

Only work cleared for publication appears here: in content, image metadata, sourcemaps, commit
messages and git history. A metric can fingerprint a project even when it is not named.
`check-assets` scans the build against a local, gitignored blocklist (`scripts/blocklist.local.txt`).
**Never describe what was removed in a commit message.**
