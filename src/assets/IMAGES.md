# Photographs — provenance

Every photograph on the one-pager is Rick's own. None is stock and none is generated.

## How they were prepared

All of them were re-encoded through sharp, which drops every metadata block. **That matters here
specifically:** five of the phone originals carried GPS coordinates. Nothing in this directory does,
and `check-assets` fails the build on EXIF in `src/assets` and in `dist`, so a future photo cannot
slip one through. The original file names are not kept either — phone file names are capture
timestamps.

| File                 | What it is                                               | Used in                  |
| -------------------- | -------------------------------------------------------- | ------------------------ |
| `portrait.jpg`       | A tight face crop from the talk photo, with a soft matte | The hero character field |
| `talk.jpg`           | Rick presenting                                          | Backdrop of _How I work_ |
| `art/lighthouse.jpg` | A lighthouse silhouetted at sunset                       | Interlude / Signal       |
| `art/tower.jpg`      | A stone clock tower against the sky                      | Interlude / Field        |
| `about.jpg`          | Rick on a bridge by a canal                              | Contact                  |

## The talk photo is edited, deliberately

The slide on screen named an internal tool at an internal event. That is the employer's to publish,
not this site's, so **the slide is blurred in the file itself** — not with a CSS filter, which
anyone opening the image directly would bypass. Both audience members are blurred the same way:
colleagues at a work event did not agree to appear here, backs of heads or not.

The blur is feathered through a soft mask so it reads as shallow depth of field rather than as a
patch, and every blurred region stops short of Rick.

## The portrait is interim

`portrait.jpg` is the best face in the set — no cap, eyes visible, side-lit by the screen — but it
was not taken for this, and its background is lit. Every lit cell gets a glyph, so without the
matte the portrait read as a textured rectangle with a face somewhere in it. The matte crushes
everything outside a feathered ellipse to black, so the face comes out of empty field instead.

It works; it is not the finished signature piece. A purpose-shot portrait is pending: see
`docs/art-system.md` § Changing the portrait.

## How the set was chosen

Twelve photographs were supplied. Each was put through a 1-bit Bayer dither at image resolution —
the treatment they will actually get — rather than judged as a photograph. Seven did not survive
it: in most the subject is small in frame and the rest is mid-tone landscape with no dominant
shape, which dithers to noise. Good photographs, poor dither sources.

The ones that survived share one property: **a single dominant shape against a bright field.** That
is the thing to look for in any photo added later.
