# rickgroot.nl

Personal portfolio for Rick Groot — Connected TV developer.

Astro 7, static output, strict TypeScript, native CSS. No UI framework.
Deployed to Firebase Hosting at <https://rickgroot.nl>.

> The previous contents of this file were a GitHub _profile_ readme (badges, stats card) that had
> ended up in a project repo. It is preserved in git history; its real home is
> `github.com/RickGroot/RickGroot`.

## Requirements

- **Node 24.21.0** (see `.node-version`). Node 25 will not install — `eslint-plugin-astro` declares
  `^22.22.3 || ^24.16.0 || >=26.3.0` and 25 falls in the gap.
- pnpm 11+.

## Getting started

```bash
pnpm install --ignore-scripts
pnpm setup:browsers
pnpm dev
```

`pnpm setup:browsers` is **required**, not optional — `@playwright/test` has no install hook, so
browsers are never downloaded automatically with or without `--ignore-scripts`.

## Commands

| Command          | What it does                                |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Dev server                                  |
| `pnpm typecheck` | `astro check` — the gate for `.astro` files |
| `pnpm lint`      | eslint + prettier check                     |
| `pnpm build`     | Production build to `dist/`                 |
| `pnpm preview`   | Serve the built output                      |
| `pnpm test`      | Playwright: routing, smoke, axe, budgets    |
| `pnpm jazz`      | Opt-in. Try it.                             |

## Project layout

```
src/
  content/             work/*.md, slides/*.md, player.yaml, practice.yaml. No content in .ts.
  content.config.ts    The schemas. Astro 7 Content Layer API.
  components/Card.astro  One component, nine formats (player, tape, listing, sleeve, cast, liner, slide, polaroid, ticket)
  lib/                 deck.ts (builds the cards), palette.ts (pigments, solved for contrast)
  scripts/table.ts     Flip, tilt, drag, deal. No rAF.
  pages/               / and 404
  assets/              Imported images -- hashed, resized by astro:assets
  styles/              global.css is imported ONCE, in BaseLayout.
public/                Only files referenced from outside the HTML
  service-worker.js    Kill switch -- do NOT delete before ~2027-09
design/                The card-table design reference (not built, not linted)
docs/                  Card system, roadmap, content guide, performance, easter eggs
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) -- engineering rules, pinned versions and why, hard prohibitions
- [`docs/card-system.md`](docs/card-system.md) -- tokens, the nine formats, motion, the a11y pattern
- [`docs/roadmap.md`](docs/roadmap.md) -- phases, gates, deferred dependencies, open items
- [`docs/content-guide.md`](docs/content-guide.md) -- how to add work, field rules, image rights
- [`docs/performance.md`](docs/performance.md) -- budgets and measurement
- [`docs/easter-eggs.md`](docs/easter-eggs.md) -- what exists, and how to turn it off
- [`docs/retired/`](docs/retired/) -- the TV-channel site's art system, renderer plan and character field

## Deployment

Pushes to `main` build and deploy to Firebase Hosting. Pull requests deploy to a Firebase preview
channel with a live URL — that is the staging environment. Both are gated on typecheck, lint, build
and the Playwright suite; the deploy job consumes the built artifact, so **the deployed bytes are
the tested bytes**.

The previous site is tagged `v1-sveltekit` as a restore point.

## Security

The Firebase **web** API key that used to sit in `firebaseConfig.js` is a public client identifier
by design — the file was dead code and has been removed, but rotating that key is not the right
reflex. What is worth doing in the console for `portfolio-rick-groot`:

1. Confirm Authentication, Firestore, Realtime Database and Storage are **disabled**. If any is
   enabled with permissive rules, the _rules_ are the exposure, not the key.
2. Add HTTP-referrer restrictions to the API key, scoped to `rickgroot.nl`.
3. Verify the service account behind `FIREBASE_SERVICE_ACCOUNT_PORTFOLIO_RICK_GROOT` holds only
   `roles/firebasehosting.admin`. **That secret is the real one** — the Firebase CLI's generated
   service account is frequently over-privileged.

## Licence

Code is MIT. Content, copy and photography are all rights reserved. See [LICENSE](LICENSE).
