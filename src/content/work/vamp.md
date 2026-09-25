---
title: VAMP
role: Solo project
company: Independent
period: '2026'
status: ongoing
summary: A local-first, offline PWA for sketching chord progressions and looping backing tracks to practise over. No login, no backend, no accounts.
tags: ['SvelteKit', 'Tone.js', 'PWA', 'Web Audio']
channel: navy
cover: ../../assets/work/vamp.png
coverAlt: The VAMP chord sketchpad showing a jazz ii–V–I progression in C with chord chart notation.
order: 3
links:
  - label: Live app
    href: 'https://rickgroot.github.io/vamp/'
  - label: Source
    href: 'https://github.com/RickGroot/vamp'
---

VAMP is the tool I wanted as a trumpet player and could not find: somewhere to sketch a chord
progression, loop it, and play over it. No account, no subscription, no network connection.
Enter chords into bars, set tempo and time signature, pick a sampled instrument, and
jam. Everything stays on the device.

It is built with SvelteKit and TypeScript, with Tone.js driving the audio clock and smplr providing
sampled instruments. Chords are parsed and validated with tonal, notation renders through VexFlow,
and sketches persist to IndexedDB. A progression encodes into its own share URL, so sharing needs no
backend at all.

The parts I find most interesting are the ones that exist because I actually use it: a transposing
pitch switch so I can read a chart in B♭ while playback stays in concert pitch, a trade-solos mode
that drops the backing out every other few bars, and a drone generator for practising modes.

**This is a personal project, not production software, and it says so.** Instrument samples load
from a CDN and are only cached for offline use after the first online play; the sound quality
ceiling is set by a general-purpose soundfont; and the iOS audio lifecycle needs verification on
physical hardware. Those trade-offs are documented in the repository rather than hidden. It is
continuously evolving, which is the point of it.
