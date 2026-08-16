Guidance for AI agents (and humans) working on the OpenFray site. The cross-repo
agreements (code style, writing style, committing, working agreements, content
licensing) live in the
[openfray repo's AGENTS.md](https://github.com/OpenFrayApp/openfray/blob/main/AGENTS.md),
and every published word follows this
repo's [STYLE.md](./STYLE.md) (the persuading voice, and the books' register),
built on the shared core in that repo. **Read all three before working here.** This file carries what is specific to the site:
where the books live, how the print edition is built, and how the site is styled.

## What this repo is

The Astro site at [openfray.app](https://openfray.app): home, news, legal pages, and
the three published books. It needs a clone of
[console](https://github.com/OpenFrayApp/console) sitting beside it (same parent
folder, named `console`), because the book pages import its compendium JSON at build
time.

```bash
npm install
npm run dev        # localhost:4321
npm test           # Vitest suite in tests/, including the build checks
npm run build      # news-slug, prose, and CSS-specificity checks, then astro build
```

## Where a published library's content lives

A first-party library (_The Waking Garden_) is published as a section of this repo,
and it has exactly two sources. Edit them; don't generate them.

- **Prose** — `src/content/waking-garden/*.mdx`, one file per chapter. These are
  written by hand. They were imported once from the authored manuscript, but they have
  since diverged on purpose (the web edition says "library" where print says "book", and
  it reorders an encounter's parts), so the MDX is the source now and re-importing would
  undo those edits. There is no generator to re-run, and adding one back would only turn
  every copy edit into a string substitution keyed to a sentence that might change.
- **Stat blocks** — `../console/public/compendium/<library>-creatures.json`, rendered at
  build time by `src/components/Creature.astro`. Never
  transcribe a stat block into the prose: the page and the console read the same file,
  which is what stops them disagreeing. That JSON is generated from the
  [compendium](https://github.com/OpenFrayApp/compendium) repo; edit it there.

The print edition is built from these same two sources, with only the differences that
print needs (its own wording for "book", a two-column page). It is not a separate text.
Its licensing page also keeps a fineprint line the web edition drops, because print has no
footer to carry the compatibility and trademark notices.

## How the print edition is built

`src/pages/the-waking-garden/print.astro` renders the whole book as one page and
[Paged.js](https://pagedjs.org) lays it out on A4. Run the dev server, open
`/the-waking-garden/print/`, and print to PDF. Pagination takes about a minute and the
page is blank while it runs. `scripts/print-check.mjs` verifies a print edition
end-to-end (page count, cross-references, the word map); its skill is in
`.claude/skills/print-check/`.

It is a **local tool, not a page of the site**: the openfray repo's assemble step
removes the route from `dist/` and the sitemap filter keeps it unadvertised. It lives
under `src/pages` anyway so it renders through the site's own components and
stylesheet. An earlier Typst edition restated that CSS in another language, and
nearly all the work went into the restating rather than the book.

**Layout is authored, not inferred.** Three controls in the MDX, and nothing else decides:

|                        |                                                          |
| ---------------------- | -------------------------------------------------------- |
| `<div class="wide">`   | span the page: wrap the **whole section**, not the table |
| `<PageBreak />`        | start a new page                                         |
| `<div class="run-in">` | set a lookup table as a run-in list                      |

Wrapping only a table is the mistake to avoid: a spanning element splits the column flow,
and the short run left above it balances into two stubby columns.

Things that will bite whoever changes this next:

- **Paged.js is handed only `print-paged.css`.** Given no stylesheets it strips every one
  in the document and parses them with css-tree, which cannot read Tailwind v4's
  `@media (width >= 40rem)` — the prelude comes back raw and Paged.js's own print-media
  handler throws on it, leaving a blank page and no error.
- **The root font size is the scale.** Everything on the site is in `rem`, so one
  declaration sizes the whole book and keeps its proportions.
- **`break-after: avoid` does nothing** — Paged.js discards it. Keeping a heading with its
  paragraph, and a stat block's identity together, is done by wrapping them in a group
  that carries `break-inside: avoid`. `print.astro` builds those groups.
- **Spacing on an element's top misaligns at every fragment boundary** — page tops, column
  tops, multicol starts. Print corrects it by measuring per column after layout, because
  Paged.js rebuilds the ancestor chain per page and `:first-child` cannot find it. The
  site pushes spacing downward in CSS instead.
- **Pagination waits on `document.fonts.ready`.** Without it the book measures against the
  fallback face and the page count varies run to run.
- **Cross-references resolve after pagination**, not by `target-counter`, which only sees
  pages already laid out and so misses every forward reference. A placeholder reserves the
  space during layout; the digits are filled in against the rendered clones, not the source
  markup Paged.js keeps in a `<template>`.
- **The site's `--faint` is 2.6:1 on white.** Print overrides it with `!important`, since
  `global.css` sets it on `:root.light`.
- **Stat blocks are `<details>` on the site**, collapsed to name, type line and lore. Print
  flattens them before paginating, so the markup serves both.

One print/web difference is encoded rather than hand-maintained: the web's "library"
becomes "book" via a whole-word map that **asserts its occurrence count**, so a copy edit
that changes it warns in the console instead of silently rewriting prose.

## How the site is styled

This repo is **Tailwind v4, utilities-first**: a component, layout or page carries its
own utilities, and the two stylesheets hold only what a utility can't reach.

- The theme lives in CSS custom properties mapped into `@theme`, so `bg-panel` resolves
  through the variable and flips with the light/dark toggle. There is **no `dark:` variant
  here.** The console uses the opposite convention (`.dark` + `dark:`). Don't unify
  them without changing the pre-paint script in both places.
- **All of the site's own CSS is wrapped in `@layer components`.** That is load-bearing:
  layer order beats specificity, so utilities always win over the stylesheet and the
  stylesheet always wins over preflight. Don't unwrap it.
- **What stays CSS, deliberately:** the prose defaults for `.doc` and `.book-body`. They
  style bare `h2`/`p`/`li`/`td` in long-form copy, which has nothing to hang a utility on
  short of classing every paragraph. The same goes for the rendered markdown inside components,
  element-level rules, and the few things no utility can express (`.lightbox::backdrop`,
  the theme toggle's icon swap, `color-mix()`).
- `scripts/check-css-specificity.mjs` fails the build on a prose rule written as a plain
  descendant selector. Wrap prose defaults in `:where()` so a component's own class wins.

Three Tailwind behaviors have each caused a silent bug here. All three are invisible until
measured:

1. **Preflight removes browser defaults the stylesheet never declared**: bold headings,
   list markers, paragraph margins. They are declared explicitly now.
2. **Two utilities for the same property in one class list resolve by Tailwind's output
   order, not the order written.** Keep a shared class constant free of any property a
   caller might set; `display` and margins have both bitten.
3. **A `text-*` utility also sets `line-height`.** Pair it with an explicit `leading-*`
   when the element had been inheriting the body's `1.6`.

**A class name may also be a script hook** (`.lightbox-next`, `.nav-toggle`, `.shot-thumb`).
Keep the semantic name alongside the utilities. Dropping one breaks behavior while every
computed style stays identical, so measurement cannot catch it.

Before changing shared CSS or a layout, snapshot computed styles and diff after; every
regression worth catching here has been invisible to the eye and obvious in the
numbers. `scripts/measure-css.mjs snapshot <url> <out.json>` captures a page and
`… diff <before> <after> --omit-derived` reports what changed, naming the declaration
behind each change and folding away the nodes that merely moved with it. It wraps
[qain](https://github.com/Shinyaigeek/qain) — the script's own job is forcing the
`localStorage` theme (`--theme light`) and settling the page. Its skill is in
`.claude/skills/measure-css/`.

## Working here

- **Legal pages:** any change to `src/pages/privacy.astro` or `terms.astro`
  must **also bump the `Last updated:` date** (`<p class="updated">`) to the current
  date, in the same edit. Never alter the legal copy without updating that date.
- The marketing screenshots and video loops (the home page and the feature pages) are
  shot by this repo's own pipeline. Recipes live in `screenshots/`, the loops in
  `scripts/record-loops.mjs`, and the crops in `screenshots/recut-vignettes.sh`. Shoot
  against a clean console `main` on port 5199 (`.claude/launch.json` starts it); never
  edit an installed image by hand.
- Commit subjects use the `Site:`, `Print:`, `Style:`, and `Copy:` areas; the full
  committing and PR agreements are in the parent repo's AGENTS.md.
