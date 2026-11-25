# Images: provenance

No image here is stock. The photographs are Rick's own (one, of him, by another photographer, credited on its card), and three of them were retouched with an
image model; the work covers are crops of his own app screenshots, halftoned in CSS, and Chromecast
draws its art as inline SVG. Which is which, and how, is recorded below, because a portfolio should be able
to say.

## How they were prepared

All of them were re-encoded through sharp, which drops every metadata block, the content
credentials an image model attaches included. **That matters here specifically:** five of the phone
originals carried GPS coordinates. Nothing in this directory does, and `check-assets` fails the
build on EXIF in `src/assets` and in `dist`, so a future image cannot slip one through. The original
file names are not kept either: phone file names are capture timestamps.

| File                              | What it is                                                             | Used in                |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------- |
| `gallery.jpg`                     | Rick in a white-walled gallery in Prague: his own photo                | The player card (Rick) |
| `prague.jpg`                      | Rick over the rooftops of Prague: his own photo, 2026-10               | The Prague slide       |
| `trumpet.jpg`                     | Rick playing trumpet: by Fred Homan, his watermark kept in the file    | The trumpet polaroid   |
| `art/lighthouse.jpg`              | A lighthouse at sunset, southern Montenegro; photographer not recorded | The lighthouse slide   |
| `work/screens/nlziet.jpg`         | Crop: the NLZIET app's screen, Rick's own screenshot                   | NLZIET cover           |
| `work/screens/kijk.jpg`           | Crop: the KIJK app's screen, Rick's own screenshot                     | KIJK cover             |
| `work/screens/vamp.jpg`           | Crop: VAMP's chord editor, Rick's own screenshot                       | VAMP cover             |
| `work/screens/nos.jpg`            | Crop: the NOS app's screen, Rick's own screenshot                      | NOS cover              |
| `work/screens/streamz-vtm-go.jpg` | Crop: the VTM GO app's screen, Rick's own screenshot                   | Streamz & VTM GO cover |
| `work/screens/sleeve.jpg`         | Crop: the Sleeve skin before play, Rick's own screenshot               | Sleeve cover           |

Chromecast has no image: its card draws a phone casting to a TV that runs the receiver, as inline SVG.

## The retouched photographs

On 2026-09-25 Rick edited four of his own photographs with an image model, from prompts that asked
for the lighting, the background and the crop to change and for his face to stay exactly as it is:
edits of real photos, never a generated face.

Two of them were on the site, `talk.jpg` (deleted 2026-11-23 with the old site) and a portrait on a canal bridge that Contact showed until
2026-10-14, when Rick's own photograph over Prague (`prague.jpg`) replaced it. The masthead showed a third,
a portrait on black, as the character field's face and faintly under it, from 2026-09-25 until
2026-10-14, when Rick asked for it to leave the codebase ("I don't want an AI generated image to be
the main subject"); it was deleted with the field.

## The player card's photograph

`gallery.jpg` is Rick's own, taken in a gallery in Prague in 2026, cropped square around him. The
work on the wall behind him and the sculpture at his side are an artist's, not his: the crop leaves
out the wall labels and the artist's name, and the site credits neither as its own. Rick chose it
over a photograph without them (2026-10-14).

## The share card

`share/home.png` is the card table, a 1920x1008 screenshot of the built page scaled to 1200x630.
Re-render it when the cards change (a Playwright screenshot after the deal, then sharp).

## The covers are the apps' own screens

A cover is the app's screen and nothing else, cropped (2026-11-23) from the earlier covers, which were
generated rooms with Rick's own screenshot keyed into a TV or tablet screen locally, pixel for pixel
(no client screen went to the model). The room, the TV and the bezel are gone; what is left is a
rectangle of the screenshot. The four dark screens were also lightened a little in sharp (VAMP's pale
one was darkened) so they survive being printed in one ink (the NOS crop, the darkest, was lifted further on 2026-11-23 with a gamma curve in sharp, so its pigment shows through). The site prints them in the card's
pigment with a halftone (see `.print` in `formats.css`); the files themselves stay in full tone. The
programme art inside the screenshots belongs to the broadcasters.

Crop rectangles on the old 1672x941 composites (x, y, width, height): NLZIET 664,164,564,284; KIJK
535,147,603,315; VTM GO 592,166,450,256; NOS 552,141,612,346; VAMP 515,195,330,330 (the chord
blocks, squared for the sleeve). Where a screen was angled, the largest clean rectangle inside it.

Sleeve's cover (2026-11-24) is not from a composite: it is the "ready" screenshot in Rick's own Sleeve
repository (`docs/media/sleeve-1-ready.jpg`, 1600x1200), cropped to 64,140,1472,920 so the whole
player fits the listing's 16:10 screen, then resized to 960x600. The frame inside the player is from
NASA's Cosmic Dawn trailer, NASA media.

## How the photographs were chosen

(Retired with the 1-bit print.) Twelve photographs were supplied. Each was put through a 1-bit Bayer dither at image resolution,
the treatment they will actually get, rather than judged as a photograph. Seven did not survive
it: in most the subject is small in frame and the rest is mid-tone landscape with no dominant
shape, which dithers to noise. Good photographs, poor dither sources.

The ones that survived share one property: **a single dominant shape against a bright field.** That
is the thing to look for in any photo added later.
