---
# Copy this file, rename it to the slug you want (the filename becomes its id),
# and fill in every field. See docs/content-guide.md for what each one is for.
title: Project name
role: Your role on it
company: Hypersolid # or Independent
period: '2024' # or '2022–2025'. First-to-last year, NOT a claim of continuous work.
status: completed # or ongoing -> renders as "Ongoing since <period>"
summary: One sentence, 50-180 characters. This becomes the meta description, so write it for a search result.
tags: ['Tag one', 'Tag two'] # 1-4. The card layout breaks past four.
format: tape # tape, listing, sleeve or cast: the shape of its card. See docs/card-system.md.
pigment: red # yellow, orange, red, blue or green: the flat field of its card.
cover: ../../assets/work/screens/your-screen.jpg
coverAlt: What is actually in the image, for someone who cannot see it.
built: # 2-6 short highlight lines (a cast: 2-5), <= 48 chars. What I am proud of, only facts from your notes.
  - First thing built
  - Second thing built
# stack: # optional: Side B of a tape, a sleeve's credits. Falls back to tags.
#   - { label: Framework, value: Svelte }
# blurb: First person. # required for a listing (<= 80), a cast (<= 160) and a sleeve (<= 320)
# note: The honest note. # required for a sleeve
order: 99
# draft: true      # hides it everywhere. Use this instead of commenting entries out.
---

The back of the card is the other side of its object: `built`, `stack`, `blurb` and `note` above, plus the links. This body is
working notes: it is not rendered anywhere on the site.
