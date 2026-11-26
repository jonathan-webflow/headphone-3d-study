# Headphone (1) Pro: a 3D study

An independent study of an over-ear headphone, modelled in Blender, taken apart along one axis and shown on the web with Three.js. Not affiliated with the product's maker; no logos or official assets are used.

- Live study: https://headphone-teardown-study.vercel.app
- Case study (process, films, breakdown): https://headphone-teardown-study.vercel.app/case/

## What's here

| Path | What it is |
|---|---|
| `headphone_v001.blend` … `headphone_v019_film.blend` | Every saved version of the model, from blockout to the film scene |
| `web/` | The site: Three.js r175, GSAP 3.13, Lenis. Static files, deployed to Vercel from this folder |
| `web/case/` | The case study page |
| `tools/` | Blender scripts (export, textures, film and breakdown renders, light diagram) and the page audits |
| `case/remotion/` | Remotion 4 project that typesets the films, reels and posts |
| `case/*.sh` | Batch scripts for renders and compositions |
| `previews/` | Stills from the process |

Rendered frames (`case/renders/`, about 9 GB), final videos (`case/out/`) and audit captures are not in the repository: they are rebuilt from the `.blend` files and the scripts.

## Run the site locally

```bash
npx serve web -l 5173
```

## Render

```bash
Blender -b headphone_v019_film.blend -P tools/film_render.py -- <clip> [first last]
```

Then, in `case/remotion/`, `npm i` and render the compositions with Remotion.
