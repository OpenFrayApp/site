// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

// The DOM transforms the print edition applies around Paged.js — extracted from
// print.astro so they can be unit-tested. Everything here runs against a plain
// Document; print.astro wires them together and drives the pagination itself.

/** Print says "book" where the web says "library"; whole words only, both numbers. */
export const PRINT_TERMS: [RegExp, string][] = [
  [/\blibrary\b/g, 'book'],
  [/\blibraries\b/g, 'books'],
];

/**
 * Rewrite the web edition's wording for print, returning how many terms were hit.
 * The caller asserts the count so a copy edit reports rather than silently
 * rewriting a sentence it no longer matches.
 */
export function replaceLibraryTerms(
  root: HTMLElement,
  terms: [RegExp, string][] = PRINT_TERMS,
): number {
  // Rejecting SCRIPT and STYLE matters: plain SHOW_TEXT rewrote the page's own
  // script source and inflated the count.
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      /^(SCRIPT|STYLE)$/.test(node.parentElement?.tagName ?? '')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  let hits = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let text = node.nodeValue ?? '';
    for (const [from, to] of terms) {
      hits += (text.match(from) ?? []).length;
      text = text.replace(from, to);
    }
    if (text !== node.nodeValue) node.nodeValue = text;
  }
  return hits;
}

/**
 * Unfold the site's stat-block accordions. The site collapses a block to name,
 * type line and lore inside a <details>; print wants all of it, flattened back to
 * plain siblings so the head grouping still sees name, lore, stats and defenses
 * as children of .statblock.
 */
export function flattenStatBlockFolds(root: ParentNode): void {
  for (const fold of root.querySelectorAll('.statblock details')) {
    const summary = fold.querySelector('summary');
    if (summary) summary.replaceWith(...summary.childNodes);
    fold.replaceWith(...fold.childNodes);
  }
}

/**
 * Wrap each stat block's identity — everything up to and including the
 * .sb-traits-list — in a .sb-head-group. A block may break between its sections
 * but never inside its identity; those parts are siblings with no element of
 * their own, so the run gets one to hang `break-inside: avoid` on.
 */
export function groupStatBlockHeads(root: ParentNode): void {
  for (const block of root.querySelectorAll('.statblock')) {
    const children = [...block.children];
    const end = children.findIndex((el) => el.classList.contains('sb-traits-list'));
    if (end < 1) continue;
    const group = block.ownerDocument!.createElement('div');
    group.className = 'sb-head-group';
    children[0].before(group);
    group.append(...children.slice(0, end + 1));
  }
}

/**
 * Bind each heading to the element after it in a .keep-with-next wrapper.
 * Paged.js discards `break-after: avoid` (it computes back to `auto`), so the
 * pair is made unsplittable instead. Headings already inside a wide section or a
 * stat-block head group are left alone, as is a heading directly followed by an h2.
 */
export function bindHeadingsToNext(root: ParentNode): void {
  for (const body of root.querySelectorAll('.chapter-body')) {
    for (const heading of [...body.querySelectorAll('h2, h3, h4')]) {
      const next = heading.nextElementSibling;
      if (!next || heading.closest('.wide, .sb-head-group') || next.tagName === 'H2') continue;
      const keep = heading.ownerDocument!.createElement('div');
      keep.className = 'keep-with-next';
      heading.before(keep);
      keep.append(heading, next);
    }
  }
}

/**
 * Put a " (p. 00)" placeholder after every entry cross-reference — `#c-` for a
 * creature, `#s-` for a spell — returning how many were inserted. Page numbers
 * only exist after pagination, so the placeholder reserves the space now —
 * growing laid-out text would overflow a page silently. `*=` not `^=`: a link to
 * another chapter is a full site path, and matching only bare fragments skipped
 * most of the book.
 */
export function insertPageRefPlaceholders(root: ParentNode): number {
  let count = 0;
  for (const link of root.querySelectorAll(
    '.book-body a[href*="#c-"], .book-body a[href*="#s-"]',
  )) {
    const ref = link.ownerDocument!.createElement('span');
    ref.className = 'pageref';
    ref.textContent = ' (p. 00)';
    link.after(ref);
    count += 1;
  }
  return count;
}

/** Geometry reader for normalizeColumnTops; injectable so tests can fake layout. */
export interface ColumnGeometry {
  rectOf: (el: Element) => { left: number; top: number; width: number; height: number };
  marginTopOf: (el: Element) => number;
}

/** Reads real layout: bounding rects and computed margin-top in CSS pixels. */
const domGeometry = (win: Window & typeof globalThis): ColumnGeometry => ({
  rectOf: (el) => el.getBoundingClientRect(),
  marginTopOf: (el) => parseFloat(win.getComputedStyle(el).marginTop) || 0,
});

/**
 * Drop the top margin off whatever opens a page or a column. Paged.js keeps the
 * margin on the first column but collapses it in a continuation, so the two
 * columns start at different heights. It cannot be a `:first-child` rule —
 * Paged.js rebuilds the ancestor chain per page, so depth and sibling order vary
 * — but the geometry is reliable: nothing above an element means its gap is
 * exactly its own margin.
 */
export function normalizeColumnTops(root: ParentNode, geometry?: ColumnGeometry): void {
  for (const content of root.querySelectorAll('.pagedjs_page_content')) {
    const geo = geometry ?? domGeometry(content.ownerDocument!.defaultView!);
    const box = geo.rectOf(content);
    const middle = box.left + box.width / 2;
    const columns: Record<
      'left' | 'right',
      { block: HTMLElement; margin: number; edge: number }[]
    > = { left: [], right: [] };

    for (const block of content.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, p, ul, ol, dl, table',
    )) {
      const rect = geo.rectOf(block);
      // A spanning element is not in either column and starts its own flow.
      if (!rect.height || rect.width > box.width * 0.8) continue;
      const margin = geo.marginTopOf(block);
      columns[rect.left < middle ? 'left' : 'right'].push({
        block,
        margin,
        // Margin-box top: equal for everything that starts a column.
        edge: rect.top - margin,
      });
    }

    for (const items of Object.values(columns)) {
      if (!items.length) continue;
      const start = Math.min(...items.map((i) => i.edge));
      for (const item of items) {
        if (item.margin && item.edge - start <= 1) item.block.style.marginTop = '0';
      }
    }
  }
}

/**
 * Fill each placeholder with its target's page number, against the *rendered*
 * pages: Paged.js lays out clones and keeps the source in a <template>, so every
 * creature id exists twice and only the clone knows its page. A placeholder whose
 * target is missing is removed. Returns how many resolved.
 */
export function resolvePageRefs(area: Element): number {
  const pageOf = new Map<Element, number>();
  area.querySelectorAll('.pagedjs_page').forEach((page, i) => pageOf.set(page, i + 1));

  const css = area.ownerDocument!.defaultView!.CSS;
  /** Escape a slug for an id selector; jsdom has no CSS, and the book's slugs are
   *  already selector-safe, so the identity fallback only ever runs in tests. */
  const escapeId = (slug: string): string => (css ? css.escape(slug) : slug);
  let resolved = 0;
  for (const ref of area.querySelectorAll('.pageref')) {
    const href = ref.previousElementSibling?.getAttribute('href');
    const slug = href?.slice(href.indexOf('#') + 1);
    const target = slug && area.querySelector(`[id="${escapeId(slug)}"]`);
    const page = target && pageOf.get(target.closest('.pagedjs_page')!);
    if (page) {
      ref.textContent = ` (p. ${page})`;
      resolved += 1;
    } else {
      ref.remove();
    }
  }
  return resolved;
}
