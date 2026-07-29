// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest';
import {
  bindHeadingsToNext,
  flattenStatBlockFolds,
  groupStatBlockHeads,
  insertPageRefPlaceholders,
  normalizeColumnTops,
  replaceLibraryTerms,
  resolvePageRefs,
  type ColumnGeometry,
} from '../src/lib/print.ts';

/** A fresh body holding the given HTML. */
function body(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe('replaceLibraryTerms', () => {
  it('rewrites whole words only, both numbers, and reports the count', () => {
    const root = body('<p>This library joins other libraries; a librarian disagrees.</p>');
    const hits = replaceLibraryTerms(root);
    expect(hits).toBe(2);
    expect(root.textContent).toBe('This book joins other books; a librarian disagrees.');
  });

  it('leaves script and style text alone — rewriting them broke the page once', () => {
    const root = body(
      '<script>const t = "library"</script><style>/* library */</style><p>library</p>',
    );
    const hits = replaceLibraryTerms(root);
    expect(hits).toBe(1);
    expect(root.querySelector('script')!.textContent).toContain('library');
    expect(root.querySelector('style')!.textContent).toContain('library');
  });
});

describe('flattenStatBlockFolds', () => {
  it('unwraps details and summary, keeping every child in order', () => {
    const root = body(
      '<section class="statblock"><details><summary><h3>Name</h3><p class="lore">Lore</p></summary><dl class="sb-top"></dl></details></section>',
    );
    flattenStatBlockFolds(root);
    const block = root.querySelector('.statblock')!;
    expect(block.querySelector('details')).toBeNull();
    expect(block.querySelector('summary')).toBeNull();
    expect([...block.children].map((el) => el.tagName)).toEqual(['H3', 'P', 'DL']);
  });
});

describe('groupStatBlockHeads', () => {
  it('wraps everything through .sb-traits-list in an unsplittable head group', () => {
    const root = body(
      '<section class="statblock"><h3>Name</h3><p>Kicker</p><dl class="sb-top"></dl><dl class="sb-traits-list"></dl><div class="sb-section">Traits</div></section>',
    );
    groupStatBlockHeads(root);
    const group = root.querySelector('.sb-head-group')!;
    expect(group).not.toBeNull();
    expect(group.children).toHaveLength(4);
    // The traits section stays outside, free to break onto the next column.
    expect(root.querySelector('.statblock > .sb-section')).not.toBeNull();
  });

  it('leaves a block without a traits list alone', () => {
    const root = body('<section class="statblock"><h3>Name</h3><p>Kicker</p></section>');
    groupStatBlockHeads(root);
    expect(root.querySelector('.sb-head-group')).toBeNull();
  });
});

describe('bindHeadingsToNext', () => {
  it('binds a heading to the element after it', () => {
    const root = body('<div class="chapter-body"><h3>Head</h3><p>Para</p><p>Loose</p></div>');
    bindHeadingsToNext(root);
    const keep = root.querySelector('.keep-with-next')!;
    expect([...keep.children].map((el) => el.tagName)).toEqual(['H3', 'P']);
    // Only the first paragraph is bound; the rest of the run may break freely.
    expect(root.querySelectorAll('.chapter-body > p')).toHaveLength(1);
  });

  it('leaves headings inside wide sections and head groups alone', () => {
    const root = body(
      '<div class="chapter-body"><div class="wide"><h3>Wide</h3><p>t</p></div><div class="sb-head-group"><h4>Grouped</h4><p>t</p></div></div>',
    );
    bindHeadingsToNext(root);
    expect(root.querySelector('.keep-with-next')).toBeNull();
  });

  it('does not bind a heading straight onto the next h2', () => {
    const root = body('<div class="chapter-body"><h2>One</h2><h2>Two</h2><p>t</p></div>');
    bindHeadingsToNext(root);
    // The second h2 binds to its paragraph; the first stays free.
    expect(root.querySelectorAll('.keep-with-next')).toHaveLength(1);
  });
});

describe('insertPageRefPlaceholders', () => {
  it('reserves space after chapter-path and bare-anchor creature links alike', () => {
    const root = body(
      '<div class="book-body"><a href="/the-waking-garden/chapter-2/#c-gourdling">Gourdling</a> and <a href="#c-root-wolf">Root Wolf</a> and <a href="/docs/">docs</a></div>',
    );
    const count = insertPageRefPlaceholders(root);
    expect(count).toBe(2);
    const refs = [...root.querySelectorAll('.pageref')];
    expect(refs.map((r) => r.textContent)).toEqual([' (p. 00)', ' (p. 00)']);
    // The non-creature link gets no placeholder.
    expect(root.querySelector('a[href="/docs/"]')!.nextElementSibling).toBeNull();
  });
});

describe('resolvePageRefs', () => {
  it('fills each placeholder from its target’s rendered page, dropping orphans', () => {
    const root = body(
      `<div class="pagedjs_pages">
        <div class="pagedjs_page"><a href="#c-gourdling">Gourdling</a><span class="pageref"> (p. 00)</span>
          <a href="#c-gone">Gone</a><span class="pageref"> (p. 00)</span></div>
        <div class="pagedjs_page"><section id="c-gourdling">block</section></div>
      </div>`,
    );
    const area = root.querySelector('.pagedjs_pages')!;
    const resolved = resolvePageRefs(area);
    expect(resolved).toBe(1);
    expect(area.querySelector('.pageref')!.textContent).toBe(' (p. 2)');
    // The unresolvable placeholder is removed rather than printing "(p. 00)".
    expect(area.querySelectorAll('.pageref')).toHaveLength(1);
  });
});

describe('normalizeColumnTops', () => {
  it('zeroes the top margin of whatever starts each column, and nothing else', () => {
    const root = body(
      `<div class="pagedjs_page_content">
        <h2 id="left-first">L1</h2><p id="left-second">L2</p>
        <p id="right-first">R1</p>
        <table id="spanning"><tbody><tr><td>t</td></tr></tbody></table>
      </div>`,
    );
    // Fake layout: a 1000px-wide page, two 400px columns, one full-width table.
    const rects: Record<string, { left: number; top: number; width: number; height: number }> = {
      'left-first': { left: 0, top: 40, width: 400, height: 30 },
      'left-second': { left: 0, top: 90, width: 400, height: 30 },
      'right-first': { left: 500, top: 45, width: 400, height: 30 },
      spanning: { left: 0, top: 300, width: 900, height: 50 },
    };
    const geometry: ColumnGeometry = {
      rectOf: (el) =>
        (el as HTMLElement).classList.contains('pagedjs_page_content')
          ? { left: 0, top: 0, width: 1000, height: 1400 }
          : rects[(el as HTMLElement).id],
      marginTopOf: () => 20,
    };
    normalizeColumnTops(root, geometry);
    expect(root.querySelector<HTMLElement>('#left-first')!.style.marginTop).toBe('0px');
    expect(root.querySelector<HTMLElement>('#right-first')!.style.marginTop).toBe('0px');
    expect(root.querySelector<HTMLElement>('#left-second')!.style.marginTop).toBe('');
    // A spanning element starts its own flow and keeps its margin.
    expect(root.querySelector<HTMLElement>('#spanning')!.style.marginTop).toBe('');
  });
});
