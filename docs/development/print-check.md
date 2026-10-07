# Check the print edition

Run this check after changing site styles, book content, stat blocks, or a print
route. Read [How the print edition is built](../../AGENTS.md#how-the-print-edition-is-built)
before editing print layout.

## Run the check

Run these commands from the site repository. In the assembled workspace, start the
server with `npm run dev -w site`; in a standalone site clone, use `npm run dev`.

1. Start the dev server on port 4321.
2. Check The Waking Garden:

   ```bash
   node scripts/print-check.mjs
   ```

   Pass another print URL as the first argument to check another book.

The script opens real Chrome, waits for pagination, and fails on errors, warnings,
or timeouts. A healthy run reports `Paged.js: <N> pages, <X>/<X> refs resolved.`

Compare the page count with the last known result. An unexpected change after a
CSS-only edit needs investigation. Recent `Print:` commits can provide the baseline.

Use a real browser. Embedded browser panes can stall Paged.js idle callbacks.

## Inspect manually

Open `/the-waking-garden/print/` in Chrome. Pagination takes about a minute, and
the page stays blank until it finishes. Completion sets `document.body.dataset.pages`.
Print to PDF with backgrounds enabled.

Resolve these diagnostics before accepting the result:

- A `Print: replaced …` warning means the whole-word library-to-book map's count
  changed. For an intentional copy edit, update the book's `expectedTerms` value
  passed to `paginateBook` in its print route.
- A `Print: … reference(s) found no target.` warning means a cross-reference failed.
- `dataset.pages === 'failed'` means pagination threw. Read the browser console.

Paged.js must receive only `print-paged.css`. Its CSS parser cannot handle
Tailwind v4 range queries such as `@media (width >= 40rem)`.

## Layout constraints

Paged.js discards `break-after: avoid`. Keep heading groups together with
`break-inside: avoid` wrappers.

Pagination waits for `document.fonts.ready`. Measuring before fonts load produces
unreliable page counts.

Resolve cross-references against rendered clones inside `.pagedjs_pages`.
Paged.js also keeps source markup in a template, so unrestricted queries can find
duplicate creature IDs.

Print routes are local tools. The parent repository's assembly removes them from
`dist/`, and sitemap generation excludes them.
