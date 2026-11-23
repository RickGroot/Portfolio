---
title: VAMP
role: Solo project
company: Independent
period: '2026'
status: ongoing
summary: A local-first, offline PWA for sketching chord progressions and looping backing tracks to practise over. No login, no backend, no accounts.
tags: ['SvelteKit', 'Tone.js', 'PWA', 'Web Audio']
format: sleeve
pigment: yellow
cover: ../../assets/work/screens/vamp.jpg
# COPY CHECK (2026-11-23): alt for the new cover.
coverAlt: 'The VAMP editor: a bold "Jazz ii-V-I in C" title over a yellow transport panel showing the Dm7 chord, tempo 100 BPM, key C major, and a three-bar Dm7, G7, Cmaj7 chord grid.'
# COPY CHECK (2026-11-23): written from the notes below, first person.
blurb: 'I play trumpet, and wanted to sketch a chord progression, loop it and play over it. VAMP does that offline, with no account and no backend.'
# COPY CHECK (2026-11-23): the features, as the secondary list.
built:
  - 'A pitch switch for transposing instruments'
  - 'Trade-solos mode drops the backing out'
  - 'A drone generator for practising modes'
  - 'Share URL that holds the progression'
# COPY CHECK (2026-11-23): four, so the back fits without scrolling (smplr and tonal are in the notes below).
stack:
  - { label: Framework, value: SvelteKit }
  - { label: Audio, value: Tone.js }
  - { label: Notation, value: VexFlow }
  - { label: Storage, value: IndexedDB }
# COPY CHECK (2026-11-23): shortened so the back fits; the CDN caveat stays in the notes below.
note: Personal project, not production software.
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
