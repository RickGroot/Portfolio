---
title: Sleeve
role: Solo project
company: Independent
period: '2026'
status: completed
summary: A Video.js v10 skin for video and audio that prints the player on the video like a record cover. My entry for the Video.js Skins Design Challenge.
tags: ['Video.js', 'CSS', 'TypeScript']
format: listing
pigment: red
cover: ../../assets/work/screens/sleeve.jpg
coverAlt: 'The Sleeve video skin before play: an orange cover panel reading "Ready, NASA Cosmic Dawn trailer, 1:51" beside a greyscale rocket launch, over a strip of square control cells.'
blurb: My Video.js skin prints the player on the video, like a record cover.
built:
  - 'A colour field that sizes to the player state'
  - 'An audio look for media without a picture'
  - 'Plays HLS, DASH, live, YouTube and Vimeo'
order: 4
links:
  - label: Live demo
    href: 'https://rickgroot.github.io/VideoJS-Retro-Player/'
  - label: Source
    href: 'https://github.com/RickGroot/VideoJS-Retro-Player'
---

Sleeve is a skin for Video.js v10, for video and audio, made for the Video.js Skins Design
Challenge. The idea: the video is the photograph on a record cover and the player is printed on it.
Ink on paper, square corners, 2px rules, condensed capitals, and one flat block of colour that
changes size with how much the player needs you.

With no picture, the cover itself is the player. It is plain HTML and CSS on Video.js's own
elements, with no player API of its own. It is a proof of concept, checked by hand in Chromium.
