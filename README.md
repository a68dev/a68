# a68.ca

The A68 site. Plain HTML, CSS and one small script — no framework, no build step, no
dependencies. Published with GitHub Pages.

| | |
|---|---|
| `index.html` | the page |
| `style.css` | all of the styling |
| `mark.js` | the A68 mark's typeface behaviour |
| `favicon.svg` | the icon, drawn as paths so it needs no font |
| `sun-macro*.jpg` | the background photograph, in three crops |
| `CNAME` | the custom domain |

## The mark

A68 is set with a different typeface for each of its three glyphs. Each position draws from a
pool locked to one category — the A is always a serif, the 6 a heavy or condensed sans, the 8 a
monospace — which is what keeps a changing combination looking deliberate. Every face carries
its own em size, because equal point sizes do not look equal.

It is drawn as SVG text rather than HTML text for a specific reason: an HTML inline box reaches
above the baseline by its own font's ascent, so swapping faces would grow the line box and shift
the page beneath it. In SVG the baseline is a coordinate, so nothing moves.

## The photograph

An HDR JPEG — an ordinary SDR image with an ISO 21496-1 gain map beside it, giving about 3.5x
headroom above white on a display that can show it. Browsers that cannot read the gain map
decode the base image and see exactly what they always did. Built with `make-hdr.swift`,
which lives outside this repo.
