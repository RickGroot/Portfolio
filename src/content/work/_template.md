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
accent: '#000000' # 6-digit hex. Becomes a CSS custom property.
cover: ../../assets/work/your-image.jpg
coverAlt: What is actually in the image, for someone who cannot see it.
order: 99
# featured: true   # uncomment to ALSO give this a page at /work/<slug>.
#                  # You must update the guard in src/pages/work/[id].astro too.
# draft: true      # hides it everywhere. Use this instead of commenting entries out.
---

The full case study goes here, in Markdown. `/work` renders this body in full for every
non-draft entry, so nothing you write here is wasted even if the project is not featured.
