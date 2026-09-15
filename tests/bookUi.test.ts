// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import BookActions from '../src/components/BookActions.astro';
import BookNavigation from '../src/components/BookNavigation.astro';
import CreatureIndex from '../src/components/CreatureIndex.astro';
import SpellIndex from '../src/components/SpellIndex.astro';
import { BROOD_AND_BLOOM } from '../src/data/books.ts';
import { setupReadingRail } from '../src/scripts/readingRail.ts';

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

  it('tracks the current section semantically and closes mobile contents after navigation', async () => {
    const html = await container.renderToString(BookNavigation, {
      props: {
        book: BROOD_AND_BLOOM,
        chapters,
        current: 'chapter-5',
        headings: [
          { depth: 2, slug: 'colonies', text: 'Colonies and lines' },
          { depth: 3, slug: 'traits', text: 'The shared traits' },
        ],
      },
    });
    const dom = new JSDOM(`${html}<h2 id="colonies">Colonies</h2><h3 id="traits">Traits</h3>`);
    const { document, Event } = dom.window;
    const [colonies, traits] = [...document.querySelectorAll<HTMLElement>('h2, h3')];
    colonies.getBoundingClientRect = () => ({ top: 80 }) as DOMRect;
    traits.getBoundingClientRect = () => ({ top: 200 }) as DOMRect;
    const toggle = document.querySelector<HTMLInputElement>('#book-nav-state')!;
    toggle.checked = true;

    setupReadingRail({
      root: document,
      linkSelector: '.book-headings a',
      scrollContainerSelector: '.book-sidebar',
      closeToggleSelector: '#book-nav-state',
    });
    expect(
      document
        .querySelector<HTMLAnchorElement>('.book-headings a[aria-current="true"]')
        ?.getAttribute('href'),
    ).toBe('#colonies');

    colonies.getBoundingClientRect = () => ({ top: -20 }) as DOMRect;
    traits.getBoundingClientRect = () => ({ top: 80 }) as DOMRect;
    dom.window.dispatchEvent(new Event('scroll'));

    const current = document.querySelector<HTMLAnchorElement>(
      '.book-headings a[aria-current="true"]',
    );
    expect(current?.getAttribute('href')).toBe('#traits');

    current?.click();
    expect(toggle.checked).toBe(false);
  });

  it('keeps the active section link inside the rail without scrolling the page', async () => {
    const html = await container.renderToString(BookNavigation, {
      props: {
        book: BROOD_AND_BLOOM,
        chapters,
        current: 'chapter-5',
        headings: [{ depth: 2, slug: 'colonies', text: 'Colonies and lines' }],
      },
    });
    const dom = new JSDOM(`${html}<h2 id="colonies">Colonies</h2>`);
    const { document } = dom.window;
    const sidebar = document.querySelector<HTMLElement>('.book-sidebar')!;
    const link = document.querySelector<HTMLAnchorElement>('.book-headings a')!;
    const heading = document.querySelector<HTMLElement>('#colonies')!;
    sidebar.scrollTop = 20;
    sidebar.getBoundingClientRect = () => ({ top: 0, bottom: 100, height: 100 }) as DOMRect;
    link.getBoundingClientRect = () => ({ top: 110, bottom: 130 }) as DOMRect;
    heading.getBoundingClientRect = () => ({ top: 80 }) as DOMRect;

    setupReadingRail({
      root: document,
      linkSelector: '.book-headings a',
      scrollContainerSelector: '.book-sidebar',
    });

    expect(sidebar.scrollTop).toBe(50);
    expect(dom.window.scrollY).toBe(0);
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

describe('CreatureIndex', () => {
  it.each([
    {
      by: 'cr' as const,
      label: 'Challenge Rating bands',
      expectedIds: ['cr-0', 'cr-1-8', 'cr-17'],
      bandCount: 20,
    },
    {
      by: 'type' as const,
      label: 'Creature type bands',
      expectedIds: ['type-aberration', 'type-humanoid', 'type-monstrosity', 'type-plant'],
      bandCount: 4,
    },
  ])(
    'links to every unique $by band destination',
    async ({ by, label, expectedIds, bandCount }) => {
      const html = await container.renderToString(CreatureIndex, {
        props: { by, book: BROOD_AND_BLOOM },
      });
      const page = new JSDOM(html, { url: 'https://openfray.app/' }).window.document;
      const bands = [...page.querySelectorAll<HTMLElement>('.index-band')];
      const links = [...page.querySelectorAll<HTMLAnchorElement>('.index-jumps a')];
      const ids = bands.map((band) => band.id);

      expect(page.querySelector('.index-jumps')?.getAttribute('aria-label')).toBe(label);
      expect(bands).toHaveLength(bandCount);
      expect(links).toHaveLength(bandCount);
      expect(new Set(ids).size).toBe(ids.length);
      expect(expectedIds.every((id) => ids.includes(id))).toBe(true);
      expect(links.map((link) => link.hash)).toEqual(ids.map((id) => `#${id}`));
      expect(bands.every((band) => band.querySelector(':scope > h2.index-band-head'))).toBe(true);
    },
  );

  it('keeps creature destinations in the responsive multi-column index', async () => {
    const html = await container.renderToString(CreatureIndex, {
      props: { by: 'type', book: BROOD_AND_BLOOM },
    });
    const page = new JSDOM(html, { url: 'https://openfray.app/' }).window.document;
    const index = page.querySelector('.creature-index')!;
    const creatureLinks = [...index.querySelectorAll<HTMLAnchorElement>('.index-list a')];

    expect(index).not.toBeNull();
    expect(creatureLinks).toHaveLength(67);
    expect(
      creatureLinks.find((link) => link.textContent === 'Latchling')?.getAttribute('href'),
    ).toBe('/brood-and-bloom/chapter-4/#c-latchling');
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
