# Measure CSS changes

Use this procedure before changing shared CSS, a layout, or a component's Tailwind
classes. It compares computed styles and identifies the declarations behind changes.

## Capture and compare

Run these commands from the site repository. In the assembled workspace, start the
server with `npm run dev -w site`; in a standalone site clone, use `npm run dev`.

1. Start the dev server on port 4321.
2. Capture each affected page before editing:

   ```bash
   node scripts/measure-css.mjs snapshot http://localhost:4321/ /tmp/before-home.json
   ```

   Include the home page, `/compendium/`, `/privacy/`, a book landing, and a chapter
   when shared styles affect them. Add `--theme light` for theme-variable changes.
   Dark is the default.

3. Make the change and capture the same pages to `after-*.json`.
4. Compare each pair:

   ```bash
   node scripts/measure-css.mjs diff /tmp/before-home.json /tmp/after-home.json --omit-derived
   ```

Every reported difference must be intentional. A difference exits nonzero.
The script wraps qain and adds theme selection and page-settling behavior.
Its snapshots also work with `npx @qain/cli diff`.

## Read the result

Each change names the selector, old and new values, and the originating declaration.

- Start with `--omit-derived` to hide nodes moved by an ancestor's change.
  Read the full diff when those causes do not explain the result.
- Check contrast changes when editing theme variables. Threshold crossings are flagged.
- A theme flip can report that no declaration changed: the declaration still uses the
  same variable, while the variable's value changed.
- Tailwind rules point to generated CSS. Use the class name to locate the source.
- `--html <file>` writes a report. `--replay <file>` writes a comparison animation
  when both snapshots were captured with `--replay`.

## Additional checks

Computed styles cannot detect a removed script-hook class. Search `src/` before
removing names such as `.lightbox-next`, `.nav-toggle`, or `.shot-thumb`.

After changing `global.css` or book styles, follow
[Check the print edition](./print-check.md).

Pseudo-elements such as `::before` and `::backdrop` are not walked. Check affected
lightboxes manually. Use `--states hover,focus-visible` to capture pseudo-classes.

## Capture timing

Capture waits for `load`, `--wait-for`, `document.fonts.ready`, and `--wait`, in
that order. Set those flags when content arrives later.

Use localhost. Production analytics beacons contain changing cache-busters that
create unrelated differences.

Use `--no-rules` when only changed values matter. It skips declaration capture.
If Playwright cannot be found, seed the npx cache with
`npx --yes playwright --version`.
