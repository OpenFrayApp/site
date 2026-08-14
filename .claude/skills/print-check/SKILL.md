---
name: print-check
description: Verify The Waking Garden's print edition still paginates correctly after a change to site/ styles, book content, stat blocks, or print.astro. Checks page count, cross-reference resolution, and the library→book word map.
---

# Check the print edition

The print edition (`src/pages/the-waking-garden/print.astro`) renders the whole
book through the site's own components and Paged.js lays it out on A4. It shares the
site's stylesheets, so **site CSS changes can silently reflow the book**. Read
AGENTS.md → "How the print edition is built" before changing it; this skill is the
verification loop.

## Workflow

1. Start the site dev server: `npm run dev -w site`.
2. Run the headless check. It opens the page in real Chrome, waits for
   pagination, and exits non-zero on any failure, timeout, or warning:

   ```bash
   node scripts/print-check.mjs
   ```

   A healthy run prints `Paged.js: <N> pages, <X>/<X> refs resolved.` — N should
   match the last known page count (git log the last `Print:` commit if unsure; a
   moved count on a pure-CSS change is a regression signal).

   **Use a real browser, not the in-app browser pane** — Paged.js chunking stalls
   there (its idle callbacks never fire) and the page sits blank forever with no
   error.

## Inspecting by hand

Open the URL in Chrome yourself for a visual pass; the real artifact is printed to
PDF from there, with backgrounds on. **The page is blank for ~40–60s while Paged.js
paginates**; it is done when `document.body.dataset.pages` is set. A healthy run's
console shows exactly the `Paged.js:` line above and none of these:

- A `Print: replaced …` warning means the library→book word map's occurrence count
  drifted; if the copy edit was intentional, update `EXPECTED_LIBRARY_TERMS` in
  `print.astro` in the same change.
- A `Print: … reference(s) found no target.` warning.
- `dataset.pages === 'failed'` — Paged.js threw, and the console has the error. The
  classic cause: a stylesheet other than `print-paged.css` reached Paged.js
  (css-tree cannot parse Tailwind v4's `@media (width >= 40rem)` and dies with a
  blank page).

## Traps (each cost a debugging session)

- `break-after: avoid` is discarded by Paged.js. Groups with `break-inside: avoid`
  are built in `print.astro`; don't move that into CSS.
- Pagination is non-deterministic unless it awaits `document.fonts.ready` — do not
  remove that await, and don't trust a page count measured before fonts load.
- Cross-references resolve after pagination against the rendered clones; Paged.js
  keeps source markup in a `<template>`, so every creature id exists twice. Query
  inside `.pagedjs_pages` only.
- The route is local-only: the openfray repo's assemble step deletes it from `dist/` and
  the sitemap filter hides it. If it ever appears on the live site, that stripping
  broke.
