# Easter eggs

Rare, cheap, and never in the way. **The joke is not worth a memory leak.**

## What exists now (Phase 1)

### `pnpm jazz`

`scripts/jazz.mjs` — prints a small ANSI "signal acquired" meter and a trumpet.

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

### The `potato` quality tier (Phase 3, named now)

The lowest device tier is called `potato` and it means **poster only — the renderer is never
imported**. The name is a joke that still teaches the behaviour to whoever maintains this in six
months: this device gets potato quality, i.e. a picture.

## Planned (Phase 6)

### Typing `jazz` on the site

Reveals a lightweight dithered "signal acquired" layer. Non-negotiable requirements:

- **Lazy-loaded only after the sequence begins.** No bytes for anyone who does not type it.
- Silent by default. No audio, ever.
- Escape dismisses it.
- **Does not steal input from form controls** — if focus is in an `<input>`, `<textarea>`, or
  anything `contenteditable`, the sequence must not fire.
- Static (or absent) under `prefers-reduced-motion`.
- **Zero timers and zero listeners survive dismissal.** A test asserts this.
- Deliberate keyboard and screen-reader behaviour — it is decorative, so it should be hidden from
  assistive technology rather than announced as noise.

### A restrained console message

One line. `"Signal acquired."` Nothing that looks like a job advert.

### The "lost signal" 404

`src/pages/404.astro` exists and works today but is deliberately plain — Phase 1 needed the route to
exist so Firebase could serve a real HTTP 404 instead of the homepage with a 200. Phase 6 gives it
the treatment. **Whatever it becomes, it keeps real navigation links.** A 404 that is only a joke is
a worse 404.

## Rules for anything added later

Easter eggs must not hurt Core Web Vitals, accessibility, SEO, or normal navigation.

No autoplay audio. No invasive tracking. No surprise network requests. No giant libraries. No
permanent background loops.

If an easter egg cannot meet those, it does not ship.
