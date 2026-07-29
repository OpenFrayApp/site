// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest';
import rehypeExternalLinks from '../src/plugins/rehype-external-links.mjs';
import rehypeTableScroll from '../src/plugins/rehype-table-scroll.mjs';

/** A minimal hast element node. */
function el(tagName: string, properties: Record<string, unknown> = {}, children: unknown[] = []) {
  return { type: 'element', tagName, properties, children };
}

/** A hast root wrapping the given children. */
const root = (...children: unknown[]) => ({ type: 'root', children });

describe('rehype-external-links', () => {
  it('opens off-site links in a new tab with rel=noreferrer', () => {
    const link = el('a', { href: 'https://example.com' });
    rehypeExternalLinks()(root(el('p', {}, [link])));
    expect(link.properties.target).toBe('_blank');
    expect(link.properties.rel).toBe('noreferrer');
  });

  it('leaves internal links, anchors, and the site’s own domain alone', () => {
    const internal = el('a', { href: '/docs/' });
    const anchor = el('a', { href: '#c-gourdling' });
    const own = el('a', { href: 'https://openfray.app/console/' });
    rehypeExternalLinks()(root(internal, anchor, own));
    for (const link of [internal, anchor, own]) {
      expect(link.properties.target).toBeUndefined();
      expect(link.properties.rel).toBeUndefined();
    }
  });
});

describe('rehype-table-scroll', () => {
  it('wraps every table in a div.table-scroll so the page never scrolls sideways', () => {
    const table = el('table');
    const tree = root(el('div', {}, [table]));
    rehypeTableScroll()(tree);
    const wrapper = (tree.children[0] as ReturnType<typeof el>).children[0] as ReturnType<
      typeof el
    >;
    expect(wrapper.tagName).toBe('div');
    expect(wrapper.properties.className).toEqual(['table-scroll']);
    expect(wrapper.children[0]).toBe(table);
  });

  it('leaves non-table content untouched', () => {
    const p = el('p');
    const tree = root(p);
    rehypeTableScroll()(tree);
    expect(tree.children[0]).toBe(p);
  });
});
