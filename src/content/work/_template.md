---
# Copy this file, rename it to the slug you want (the filename becomes the URL),
# and fill in every field. See docs/content-guide.md for what each one is for.
title: Project name
role: Your role on it
company: Triple # or Independent
period: '2024' # or '2022–2025'. First-to-last year, NOT a claim of continuous work.
status: completed # or ongoing -> renders as "Ongoing since <period>"
summary: One sentence, 50-180 characters. This becomes the meta description, so write it for a search result.
tags: ['Tag one', 'Tag two'] # 1-4. The card layout breaks past four.
channel: crimson # ink, paper, yellow, crimson, ultramarine or navy. See src/lib/channels.ts.
cover: ../../assets/work/your-image.jpg
coverAlt: What is actually in the image, for someone who cannot see it.
coverTone: dark # or light: is the picture mostly dark or mostly light?
order: 99
# draft: true      # hides it everywhere. Use this instead of commenting entries out.
#                  # Publishing an entry also means updating the guard in
#                  # src/pages/work/[id].astro -- deliberately.
---

The full case study goes here, in Markdown. Every non-draft entry is a programme on the guide
and renders this body in full on its own page at /work/<slug>.
