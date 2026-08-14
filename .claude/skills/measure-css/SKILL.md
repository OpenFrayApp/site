---
name: measure-css
description: Verify a site CSS or layout change by measuring computed styles before and after, instead of eyeballing. Use whenever editing src/styles/*, a Tailwind class list, or a site layout/component — every real regression here was invisible to the eye and obvious in the numbers.
---

# Measure a CSS change instead of eyeballing it

The rule (AGENTS.md → "How the site is styled"): before changing shared CSS or a
layout in this repo, snapshot computed styles; after the change, diff. The regressions
this workflow exists for (preflight eating list markers, utility-order flips, a
`text-*` silently changing `line-height`, a dropped script-hook class) all render
"looking fine" and measure differently.

`scripts/measure-css.mjs` wraps [qain](https://github.com/Shinyaigeek/qain), which
captures the browser's used values over CDP and diffs them by meaning. The script adds
the two things qain's own CLI can't do here: force the site's `localStorage` theme, and
settle the page. What it writes are plain qain snapshots, so `npx @qain/cli diff` reads
them too.

## Workflow

1. Start the site dev server if it isn't running: `npm run dev -w site`
   (localhost:4321).
2. Snapshot every page the change can reach, **before** touching anything:

   ```bash
   node scripts/measure-css.mjs snapshot http://localhost:4321/ /tmp/before-home.json
   ```

   Pages worth including by area: `/` (home), `/compendium`, `/privacy`,
   `/the-waking-garden/` and one chapter, plus `--theme light` variants when the
   change touches theme variables (dark is the default).

3. Make the change.
4. Snapshot again to `after-*.json`, then diff each pair:

   ```bash
   node scripts/measure-css.mjs diff /tmp/before-home.json /tmp/after-home.json --omit-derived
   ```

5. **The diff must be empty, or every line must be an intended change.** The diff
   exits non-zero when anything moved, so it slots into a shell `&&` chain.

## Reading the diff

Every change carries the declaration behind it: selector, the value that moved, and
where the browser loaded the rule from:

```
html > body > header#top > nav#topnav > a
  color: rgb(148, 163, 184) → rgb(71, 85, 105)
  contrast 7.87 → 7.24
  ← .text-slate-400 { color: … → … }  <stylesheet>:647:5
```

- **Start with `--omit-derived`.** A node that only moved because something above it
  grew is derived, not a cause; the terse view drops them. Read the full list when the
  causes don't account for what you're seeing.
- **Contrast is recomputed** for every color change, and flagged when a pair crosses a
  WCAG threshold. Check it on any theme-variable edit.
- **A theme flip reports `no CSS declaration on this node changed`.** That is correct,
  not a miss: the declaration says `var(--…)` in both snapshots and only `:root` moved.
- **A Tailwind utility attributes to the generated stylesheet**, so the useful half of
  the line is the class name, not the position. Hand-written rules point into the sheet
  Vite served.
- `--html <file>` writes a standalone report; `--replay <file>` writes a before/after
  fade you can scrub, when both snapshots were captured with `--replay`.

## What the diff can't see

- **Script-hook classes** (`.lightbox-next`, `.nav-toggle`, `.shot-thumb`): removing
  one breaks behavior while every computed style stays identical. qain ignores the
  `class` attribute for that exact reason. Grep for the class name in `src` before
  deleting any class.
- **The print edition** shares these stylesheets. After a `waking-garden.css` or
  `global.css` change, run the print-check skill too.
- **Pseudo-elements** (`::before`, `::backdrop`) are not walked; check `.lightbox`
  behavior by hand if you touched it. Pseudo-_classes_ are captured on request:
  `--states hover,focus-visible`.

## Gotchas

- A page is captured after `load`, `--wait-for`, `document.fonts.ready` and `--wait`,
  in that order. Anything that streams in later needs one of those two flags. Neither
  the script nor qain guesses.
- Snapshotting **openfray.app** instead of localhost costs one phantom change per run:
  the Fathom beacon `<img>` carries a fresh cache-buster. It is PROD-only, so localhost
  stays clean.
- `--no-rules` skips rule capture (one CDP round-trip per node) when all you need to
  know is _whether_ something moved.

Playwright resolves from the npx cache; if the script says it's missing, seed it once
with `npx --yes playwright --version`.
