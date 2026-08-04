// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

// The browser half of the print edition: loads Paged.js, hands it the paged stylesheet,
// and runs the DOM transforms around it. Those transforms live in print.ts, where they
// are unit-tested against a plain Document; nothing here can be, because it needs a real
// layout. Every book's print route calls this, so the gotchas below are recorded once.

import {
  bindHeadingsToNext,
  flattenStatBlockFolds,
  groupStatBlockHeads,
  insertPageRefPlaceholders,
  normalizeColumnTops,
  PRINT_TERMS,
  replaceLibraryTerms,
  resolvePageRefs,
} from './print.ts';

export interface PrintBook {
  /** The name in the running footer, which replaces the stylesheet's default. */
  name: string;
  /**
   * How many terms the prose is expected to carry. Asserted so a copy edit that changes
   * the wording reports in the console instead of silently rewriting a sentence the map
   * no longer matches.
   */
  expectedTerms: number;
  /**
   * The web-to-print wording map, defaulting to library → book. A book whose "library"
   * means the console's own content toggle passes an empty map: that word is a library
   * in both editions, and rewriting it to "book" would make the sentence wrong.
   */
  terms?: [RegExp, string][];
}

/** The sliver of Paged.js this uses; the package ships no type declarations. */
interface PagedPreviewer {
  preview(content: undefined, stylesheets: Record<string, string>[]): Promise<{ total: number }>;
}

/**
 * Lay the current document out as `book`'s print edition, and record the page count on
 * `document.body.dataset.pages` — 'failed' if Paged.js threw. print-check.mjs waits on
 * that attribute, so it must be set on both paths.
 */
export async function paginateBook(book: PrintBook): Promise<void> {
  const hits = replaceLibraryTerms(document.body, book.terms ?? PRINT_TERMS);
  if (hits !== book.expectedTerms) {
    console.warn(
      `Print: replaced ${hits} wording terms, expected ${book.expectedTerms}. ` +
        'Check the result, then update the count in this book’s print.astro.',
    );
  }

  flattenStatBlockFolds(document);
  groupStatBlockHeads(document);
  bindHeadingsToNext(document);
  const refCount = insertPageRefPlaceholders(document);

  try {
    // Paged.js is handed only print-paged.css. Given no stylesheets it strips every one
    // in the document and parses them with css-tree, which cannot read Tailwind v4's
    // `@media (width >= 40rem)` — the prelude comes back raw and Paged.js's own
    // print-media handler throws on it, leaving a blank page and no error. Its polyfill
    // build also sits behind an export condition Vite will not resolve, hence driving
    // Previewer directly.
    const paged = import('pagedjs') as Promise<{ Previewer: new () => PagedPreviewer }>;
    const [{ Previewer }, { default: pagedCss }] = await Promise.all([
      paged,
      import('../styles/print-paged.css?raw'),
      // Chunking measures text, so it has to wait for the serif. Without this the book
      // paginates against the fallback face and the page count varies run to run.
      document.fonts.ready,
    ]);

    const bookCss = pagedCss.replace("'The Waking Garden'", `'${book.name}'`);
    const flow = await new Previewer().preview(undefined, [{ 'print-paged.css': bookCss }]);

    normalizeColumnTops(document);

    const area = document.querySelector('.pagedjs_pages');
    const resolved = area ? resolvePageRefs(area) : 0;
    if (resolved < refCount) {
      console.warn(`Print: ${refCount - resolved} entry reference(s) found no target.`);
    }

    console.info(`Paged.js: ${flow.total} pages, ${resolved}/${refCount} refs resolved.`);
    document.body.dataset.pages = String(flow.total);
  } catch (error) {
    // preview() empties the body before chunking, so a failure otherwise leaves a blank
    // page and no clue why.
    console.error('Paged.js failed to paginate:', error);
    document.body.dataset.pages = 'failed';
  }
}
