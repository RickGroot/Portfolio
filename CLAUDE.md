# CLAUDE.md

Engineering rules for this repository. Short on purpose — if a rule here is wrong, fix the rule.

## Stack

Astro 7 (static output) · strict TypeScript · native CSS with custom properties · vanilla TS.
**No UI framework runtime.** Deployed to Firebase Hosting at <https://rickgroot.nl>.

The site is one page, "The Collection": loose cards on a paper table, draggable, each flipping to its
case study. The card system is in `docs/card-system.md`. The earlier TV-channel site is commit
5f1bb67; its notes are in `docs/retired/`.

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
   so the table script's observers and listeners are torn down by the browser for free.
   ClientRouter would keep them alive across navigations and require real per-navigation teardown,
   for no benefit on a one-page static site.

## Structural rules

- **`global.css` is imported exactly once, in `BaseLayout.astro`.** Never `@import` it from a
  component (the old site duplicated `@font-face` into every stylesheet that way).
- **No third-party origins at runtime.** Fonts are self-hosted. A test asserts this.
- **Security headers live in `firebase.json`** (the `**` block). The CSP allows the one inline
  script, the bootstrap in `BaseLayout.astro`, by its sha256. Change a byte of it and
  `tests/e2e/headers.spec.ts` fails with the new hash to paste into `script-src`. No inline event
  handlers, no `innerHTML` (Trusted Types is enforced). `astro preview` ignores `firebase.json`, so
  the test applies the headers itself; `PREVIEW_URL` checks the real ones on a preview channel.
- `src/assets` for anything imported (hashed, resized, intrinsic dimensions). `public/` only for
  files something outside your HTML references: favicons, manifest, robots.txt, the service worker,
  CSS-referenced fonts.
- Content lives in `src/content/`: `work/*.md`, `slides/*.md`, `player.yaml`, and How I work in
  `practice.yaml`. **Zero content in `.ts` files.**
- **One page, no sub-pages.** A work card's back is its case study. `/work` and `/work/**` are 301s
  to `/` in `firebase.json`; do not recreate those routes.
- **Every colour comes from `src/lib/palette.ts`.** A card sets `--field` and `--on-field`, solved
  at build time; the build fails below 4.5:1. No hex values in CSS (use `color-mix` on the palette
  properties). Radius 0, one 2px rule, a hard 6px shadow on a separate element that does not flip.
- **No nested interactive elements.** A card front is covered by one `.turn` button; the back has
  its own button and links; the face turned away is `inert`. See `docs/card-system.md`.
- **Public files are not hashed.** `/fonts/**` is cached `immutable` for a year, so a changed font
  gets a new file name. Never overwrite one in place.
- **After a content schema change, delete `node_modules/.astro/data-store.json`** and restart the dev
  server. `astro check` writes that cache, and the dev server keeps serving the old shape from it.
- **CSS is minified by esbuild, not Lightning CSS** (`astro.config.mjs`). Lightning folds
  `animation-timeline` into the `animation` shorthand, which is invalid, and the browser drops it.
- **Fonts are budgeted at 160 KB total** (`scripts/check-assets.mjs`), up from 80 KB: the Archivo
  variable file is 90 KB unsubset. Subsetting it (needs `pyftsubset`) would win the room back.

## Budgets

| Budget               | Limit                                                           |
| -------------------- | --------------------------------------------------------------- |
| Initial JS, homepage | <= 20 KB gzip (2.6 KB at the redesign)                          |
| Total JS, homepage   | <= 45 KB gzip                                                   |
| LCP / CLS            | < 2.5 s / < 0.1, plus an 1800 ms LCP trip-wire                  |
| Canvas, WebGL, rAF   | **0**                                                           |
| Animation            | CSS and WAAPI only; paused offscreen; none under reduced motion |

INP is field-only. Use TBT as the lab proxy; do not claim Lighthouse measures INP.

LCP and CLS are measured by `tests/budgets/vitals.spec.ts` at **4x CPU throttle**, because this is
a portfolio about software that runs on hardware you do not choose. It is tagged `@vitals` and
excluded from `pnpm test` (the default run uses parallel workers and contention distorts a throttled
measurement). Run it with `pnpm test:vitals`.

`eslint.config.js` bans `requestAnimationFrame` everywhere in `src`; motion is CSS or WAAPI.

## Tests

`pnpm test` covers routes and the `/work` redirect config, smoke, share metadata, scrollbars at four
widths, axe on `/` and the 404, the remote (arrow keys move focus spatially), the keyboard flip (Enter turns a card, focus moves, the hidden face
is inert), reduced motion, pigment contrast with the manifest and favicon pinned to the palette,
no third-party origins, the JS budget and the service-worker kill switch. `astro preview` does not
read `firebase.json`, so redirects are asserted on the config.

## Publishing hygiene

Only work cleared for publication appears here: in content, image metadata, sourcemaps, commit
messages and git history. A metric can fingerprint a project even when it is not named.
`check-assets` scans the build against a local, gitignored blocklist (`scripts/blocklist.local.txt`).
**Never describe what was removed in a commit message.**
