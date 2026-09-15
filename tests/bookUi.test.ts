// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import BookActions from '../src/components/BookActions.astro';
import BookNavigation from '../src/components/BookNavigation.astro';
import SpellIndex from '../src/components/SpellIndex.astro';
import { BROOD_AND_BLOOM } from '../src/data/books.ts';

const chapters = [
  { id: 'chapter-1', data: { eyebrow: 'Chapter 1', label: 'The broods' } },
  { id: 'chapter-5', data: { eyebrow: 'Chapter 5', label: 'Sporophore' } },
];
let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

describe('BookNavigation', () => {
  it('renders nothing on a book landing page', async () => {
    const html = await container.renderToString(BookNavigation, {
      props: { book: BROOD_AND_BLOOM, chapters },
    });

    expect(html.trim()).toBe('');
  });

  it('keeps chapter contents in a viewport-bounded scrolling panel on mobile', async () => {
    const html = await container.renderToString(BookNavigation, {
      props: {
        book: BROOD_AND_BLOOM,
        chapters,
        current: 'chapter-5',
        headings: [{ depth: 2, slug: 'colonies', text: 'Colonies and lines' }],
      },
    });
    const page = new JSDOM(html).window.document;
    const sidebar = page.querySelector('.book-sidebar')!;

    expect(page.querySelector('.book-nav-toggle')).not.toBeNull();
    expect(sidebar.classList.contains('max-[900px]:max-h-[calc(100vh-8rem)]')).toBe(true);
    expect(sidebar.classList.contains('max-[900px]:overflow-y-auto')).toBe(true);
    expect(page.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe(
      '/brood-and-bloom/chapter-5/',
    );
    expect(page.querySelector('a[href="#colonies"]')?.textContent?.trim()).toBe(
      'Colonies and lines',
    );
  });
});

describe('BookActions', () => {
  it('makes reading primary and the console secondary', async () => {
    const html = await container.renderToString(BookActions, {
      props: { readingHref: '/brood-and-bloom/overview/' },
    });
    const actions = [
      ...new JSDOM(html).window.document.querySelectorAll<HTMLAnchorElement>('.cta'),
    ];

    expect(actions.map((action) => action.textContent?.trim())).toEqual([
      'Start reading',
      'Open the console',
    ]);
    expect(actions[0].href).toBe('/brood-and-bloom/overview/');
    expect(actions[0].classList.contains('cta-ghost')).toBe(false);
    expect(actions[1].href).toBe('/console/');
    expect(actions[1].classList.contains('cta-ghost')).toBe(true);
  });
});

describe('SpellIndex', () => {
  it.each(['level', 'class'] as const)(
    'contains the %s table in its own overflow wrapper',
    async (by) => {
      const html = await container.renderToString(SpellIndex, { props: { by } });
      const page = new JSDOM(html).window.document;
      const wrapper = page.querySelector('.table-scroll')!;

      expect(wrapper).not.toBeNull();
      expect(wrapper.children).toHaveLength(1);
      expect(wrapper.firstElementChild?.matches('table.spell-index')).toBe(true);
    },
  );
});
