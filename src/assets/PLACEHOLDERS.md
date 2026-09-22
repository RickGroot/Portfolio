# Placeholder imagery — provenance, and why it must not launch

Every file in this repository whose name begins with `PLACEHOLDER-` is temporary. They exist so the
Decode treatment can be judged against real photographs instead of generated art, which the brief
rules out as the site's identity.

`check-assets.mjs` warns about them on every run. Replace them before launch.

## Sources

All three are from Unsplash and were re-encoded through sharp, which strips EXIF, XMP and every
other metadata block. None carries camera data, GPS or an author tag.

| File                         | Source                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| `PLACEHOLDER-portrait.jpg`   | <https://unsplash.com/photos/photo-1532170579297-281918c8ae72> |
| `art/PLACEHOLDER-signal.jpg` | <https://unsplash.com/photos/photo-1501290301209-7a0323622985> |
| `art/PLACEHOLDER-field.jpg`  | <https://unsplash.com/photos/photo-1625039162908-19d625adbaac> |

The Unsplash licence grants free use, including commercially, with no attribution required. The
table is here anyway, because knowing where a file came from is worth more than the licence
requires.

## The portrait is the one that actually matters

**It is a photograph of a real, identifiable person who is not Rick Groot.**

The Unsplash licence covers the photograph. It does not grant rights to a depicted person's
likeness — Unsplash says so itself — and it certainly does not cover presenting a stranger as the
author of this site.

On most sites a stock portrait reads as stock. Here it does not. The character field resolves into
this face directly beside the words "Rick Groot", which makes it a claim about who he is rather
than decoration. Shipping it would be a misrepresentation of a person who never agreed to it.

So it is fine for exactly what it is being used for — proving the dither pipeline works on a real
face, with real skin texture and real directional light, which the generated CG bust could not
do — and it must be swapped before anything goes live.

## What the real portrait needs

Same brief as before, now confirmed against a photograph that works:

- Head and shoulders, **eyes visible** — eyes are the one feature that makes a face legible at
  80×80.
- Strong directional light. The luminance map has 12 levels; flat lighting wastes most of them.
- Plain or blown-out background, so figure and ground separate under a threshold.
- Subject filling at least 60% of frame height.
- Roughly square.

Then run `node scripts/build-portrait-map.mjs`, which re-derives the map and the server-rendered
static frame, and records the source hash so a stale map is detectable.
