# Easter eggs

Rare, cheap, and never in the way. **The joke is not worth a memory leak.**

## What exists now

### `pnpm jazz`

`scripts/jazz.mjs` — prints a small ANSI "signal acquired" meter and a trumpet, in the nearest
xterm-256 colours to the palette: the field's blue, the ink channel's yellow, and brass for the
music work.

Constraints it must keep obeying:

- **No dependency.** Zero imports.
- **No network.** No audio. No file writes.
- **Never wired to install, build, CI, or `dev`.** It is a script you type on purpose.
- Exits immediately. Honours `NO_COLOR` and `TERM=dumb`.

To disable it: delete the `jazz` line from `package.json#scripts` and `scripts/jazz.mjs`. Nothing
else references it.

_Note on timing:_ the script's own work is negligible, but Node's cold start on some Windows setups
(antivirus scanning `node.exe`) can be 1–2 s. Measure the script against the `node -e ""` baseline
on the same machine rather than in absolute terms.

### Retired with the channel guide

The console line ("Signal acquired.") and the number keys that tuned channels went with the TV
site (2026-11-23, in commit 4bd873d if you want them back). The site now logs nothing, and
`tests/e2e/smoke.spec.ts` asserts it. The planned `jazz` typing egg and the "lost signal" 404 were
channel jokes too and are dropped; the 404 is now a ticket, "Lost: page 404", with a way back.

## Rules for anything added later

Easter eggs must not hurt Core Web Vitals, accessibility, SEO, or normal navigation.

No autoplay audio. No invasive tracking. No surprise network requests. No giant libraries. No
permanent background loops.

If an easter egg cannot meet those, it does not ship.
