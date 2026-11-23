# Images: provenance

No image here is stock. The photographs are Rick's own, and three of them were retouched with an
image model; the programme covers are illustrations built around his real screenshots. Which is
which, and how, is recorded below, because a portfolio should be able to say.

## How they were prepared

All of them were re-encoded through sharp, which drops every metadata block, the content
credentials an image model attaches included. **That matters here specifically:** five of the phone
originals carried GPS coordinates. Nothing in this directory does, and `check-assets` fails the
build on EXIF in `src/assets` and in `dist`, so a future image cannot slip one through. The original
file names are not kept either: phone file names are capture timestamps.

| File                      | What it is                                                    | Used in                  |
| ------------------------- | ------------------------------------------------------------- | ------------------------ |
| `gallery.jpg`             | Rick in a white-walled gallery in Prague: his own photo       | The masthead's screen    |
| `talk.jpg`                | Rick presenting, in front of a blank screen: retouched        | Backdrop of _How I work_ |
| `prague.jpg`              | Rick over the rooftops of Prague: his own photo, 2026-10      | Contact                  |
| `art/lighthouse.jpg`      | A lighthouse silhouetted at sunset                            | Interlude / Signal       |
| `art/tower.jpg`           | A stone clock tower against the sky                           | Interlude / Field        |
| `work/nlziet.jpg`         | Illustration: the NLZIET app on a TV, a real screenshot       | NLZIET key art           |
| `work/kijk.jpg`           | Illustration: the KIJK app on a TV, a real screenshot         | KIJK key art             |
| `work/vamp.jpg`           | Illustration: VAMP on a tablet, a real screenshot             | VAMP key art             |
| `work/nos.jpg`            | Illustration: the NOS app on a TV, a real screenshot          | NOS key art              |
| `work/streamz-vtm-go.jpg` | Illustration: VTM GO and Streamz on two TVs, real screenshots | Streamz & VTM GO key art |
| `work/chromecast.jpg`     | A Chromecast and its remote on a white surface                | Chromecast key art       |

## The retouched photographs

On 2026-09-25 Rick edited four of his own photographs with an image model, from prompts that asked
for the lighting, the background and the crop to change and for his face to stay exactly as it is:
edits of real photos, never a generated face.

Two of them were on the site, `talk.jpg` and a portrait on a canal bridge that Contact showed until
2026-10-14, when Rick's own photograph over Prague (`prague.jpg`) replaced it. The masthead showed a third,
a portrait on black, as the character field's face and faintly under it, from 2026-09-25 until
2026-10-14, when Rick asked for it to leave the codebase ("I don't want an AI generated image to be
the main subject"); it was deleted with the field.

## The masthead's photograph

`gallery.jpg` is Rick's own, taken in a gallery in Prague in 2026, cropped square around him. The
work on the wall behind him and the sculpture at his side are an artist's, not his: the crop leaves
out the wall labels and the artist's name, and the site credits neither as its own. Rick chose it
over a photograph without them (2026-10-14).

## The share card

`share/home.png` is the masthead itself, rendered at 1200×630 from the page with the rail and the
readout hidden, the tracker at its first row. Re-render it when the masthead changes.

## The covers are illustrations

A programme's key art is a generated scene, a TV or a tablet in a room lit in its channel's
colours, with Rick's own screenshot of the app composited into the screen locally, pixel for pixel:
the scene was generated with a flat green screen, and the screenshot was keyed into it rather than
redrawn by the model, so the interface is the real one and no client screen went to the model. The
programme art inside those screenshots belongs to the broadcasters.

`work/chromecast.jpg` is the older cover and stays until a receiver screenshot replaces it.

## How the photographs were chosen

Twelve photographs were supplied. Each was put through a 1-bit Bayer dither at image resolution,
the treatment they will actually get, rather than judged as a photograph. Seven did not survive
it: in most the subject is small in frame and the rest is mid-tone landscape with no dominant
shape, which dithers to noise. Good photographs, poor dither sources.

The ones that survived share one property: **a single dominant shape against a bright field.** That
is the thing to look for in any photo added later.
