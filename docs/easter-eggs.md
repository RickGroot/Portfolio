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

### The console line

`src/scripts/ident.ts` — one `console.log` on every page: the broadcast palette's colour bars, then
"Signal acquired." on a plate of the page's channel. The colours are read off `<html>`, so it has no
copy of the palette. `tests/e2e/smoke.spec.ts` asserts exactly one log line on the homepage, a case
study and the 404, so a second one is either debugging left in or this stopping being restrained.

### The number keys

On the one-pager, `1`–`6` tune straight to a channel, as on a remote, with the same static and
readout as any other change of channel (`src/scripts/sections.ts`, `channelKey`). Nothing on screen
mentions them.

- **Live only while focus is in the page's content.** A single-character shortcut is one speech
  input can type by accident, and WCAG 2.1.4 allows one only if it can be turned off, remapped, or
  is active only while its component has focus. The third is how this meets it: every change of
  channel leaves focus in the page, and on a page nobody has touched, focus is on the body and a
  number does nothing.
- Never while typing in a field, never with Ctrl, Alt or Meta. Shift is allowed, because AZERTY
  digits are shifted.
- Dropped while a change is still settling, so the static stays under two bursts a second however
  fast the keys are pressed.
- Under reduced motion it still works, as an instant jump with no static and no readout — the same
  thing a rail link does there.
- A number with no channel on it (7–9) does nothing. If the one-pager ever has more than nine
  channels, the tenth is only reachable the ordinary ways.

### The `potato` quality tier — removed

There used to be a device tier called `potato`, meaning "poster only, never load the renderer".
It is gone, along with the tier system and the WebGL renderer it belonged to: the art is text now,
the renderer costs 4.3 KB gzip (2026-09-28), and there is no quality left to degrade.

Recorded rather than silently deleted, because the joke did real work — the name taught the
behaviour to whoever read the tier list six months later. If tiers ever come back, bring the name.

## Planned (Phase 5)

### Typing `jazz` on the site

Reveals a lightweight dithered "signal acquired" layer. Non-negotiable requirements:

- **Lazy-loaded only after the sequence begins.** No bytes for anyone who does not type it.
- Silent by default. No audio, ever.
- Escape dismisses it.
- **Does not steal input from form controls** — if focus is in an `<input>`, `<textarea>`, or
  anything `contenteditable`, the sequence must not fire.
- **Meets WCAG 2.1.4** the way the number keys do: live only while focus is in the page's content.
- Static (or absent) under `prefers-reduced-motion`.
- **Zero timers and zero listeners survive dismissal.** A test asserts this.
- Deliberate keyboard and screen-reader behaviour — it is decorative, so it should be hidden from
  assistive technology rather than announced as noise.

### The "lost signal" 404

`src/pages/404.astro` exists and works today but is deliberately plain — Phase 1 needed the route to
exist so Firebase could serve a real HTTP 404 instead of the homepage with a 200. Phase 5 gives it
the treatment. **Whatever it becomes, it keeps real navigation links.** A 404 that is only a joke is
a worse 404.

## Rules for anything added later

Easter eggs must not hurt Core Web Vitals, accessibility, SEO, or normal navigation.

No autoplay audio. No invasive tracking. No surprise network requests. No giant libraries. No
permanent background loops.

If an easter egg cannot meet those, it does not ship.
