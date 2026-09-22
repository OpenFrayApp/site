// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import BookActions from '../src/components/BookActions.astro';
import BookNavigation from '../src/components/BookNavigation.astro';
import Creature from '../src/components/Creature.astro';
import CreatureIndex from '../src/components/CreatureIndex.astro';
import Preparation from '../src/components/Preparation.astro';
import PreparationTable from '../src/components/PreparationTable.astro';
import SpellIndex from '../src/components/SpellIndex.astro';
import { BROOD_AND_BLOOM } from '../src/data/books.ts';
import { setupReadingRail } from '../src/scripts/readingRail.ts';
import { setupTargetedStatBlock } from '../src/scripts/targetedStatBlock.ts';

const chapters = [
  { id: 'chapter-1', data: { eyebrow: 'Chapter 1', label: 'The broods' } },
  { id: 'chapter-5', data: { eyebrow: 'Chapter 5', label: 'Sporophore' } },
];
let container: AstroContainer;
let siteBuilt = false;

/** Build the production site once for tests that inspect complete routes. */
function buildSite() {
  if (siteBuilt) return;
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  siteBuilt = true;
}

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

describe('targeted stat blocks', () => {
  it('opens the creature fold named by the initial fragment on a rendered book entry', async () => {
    const url = 'https://openfray.app/brood-and-bloom/chapter-4/#c-latchling';
    const html = await container.renderToString(Creature, {
      props: { name: 'Latchling', book: 'brood-and-bloom' },
    });
    const dom = new JSDOM(html, { url });
    const target = dom.window.document.getElementById('c-latchling')!;

    setupTargetedStatBlock(dom.window.document);

    expect(target.matches('article.entry')).toBe(true);
    expect(target.querySelector('details')?.open).toBe(true);
    expect(dom.window.location.hash).toBe('#c-latchling');
  });

  it('opens later fragment targets without changing unrelated folds or native toggles', () => {
    const dom = new JSDOM(
      [
        '<article id="c-latchling"><section class="statblock"><details><summary>Latchling</summary></details></section></article>',
        '<article id="c-quagdam"><section class="statblock"><details><summary>Quagdam</summary></details></section></article>',
        '<article id="c-lacuna"><section class="statblock"><details open><summary>Lacuna</summary></details></section></article>',
      ].join(''),
      { url: 'https://openfray.app/brood-and-bloom/chapter-4/#c-latchling' },
    );
    const folds = [...dom.window.document.querySelectorAll<HTMLDetailsElement>('details')];

    setupTargetedStatBlock(dom.window.document);
    folds[0].querySelector('summary')?.click();
    dom.window.location.hash = '#c-quagdam';
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));

    expect(folds.map((fold) => fold.open)).toEqual([false, true, true]);
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

  it('resolves every generated jump on the built appendix pages', () => {
    buildSite();

    for (const [chapterId, bandCount] of [
      ['appendix-a', 20],
      ['appendix-b', 4],
    ] as const) {
      const html = readFileSync(`dist/brood-and-bloom/${chapterId}/index.html`, 'utf8');
      const page = new JSDOM(html, {
        url: `https://openfray.app/brood-and-bloom/${chapterId}/`,
      }).window.document;
      const links = [...page.querySelectorAll<HTMLAnchorElement>('.index-jumps a')];
      const destinations = links.map((link) => page.getElementById(link.hash.slice(1)));

      expect(links).toHaveLength(bandCount);
      expect(destinations.every(Boolean)).toBe(true);
      expect(new Set(destinations).size).toBe(bandCount);
    }
  }, 15_000);

  it('keeps creature destinations in the responsive multi-column index', () => {
    buildSite();
    const html = readFileSync('dist/brood-and-bloom/appendix-b/index.html', 'utf8');
    const page = new JSDOM(html, { url: 'https://openfray.app/' }).window.document;
    const index = page.querySelector('.creature-index')!;
    const creatureLinks = [...index.querySelectorAll<HTMLAnchorElement>('.index-list a')];

    expect(index).not.toBeNull();
    expect(creatureLinks).toHaveLength(67);
    expect(
      creatureLinks.find((link) => link.textContent === 'Latchling')?.getAttribute('href'),
    ).toBe('/brood-and-bloom/chapter-4/#c-latchling');
  }, 15_000);
});

/** Read a hexadecimal custom-property color from one CSS selector block. */
function cssColor(css: string, selector: string, property: string): string {
  const blockStart = css.indexOf(`${selector} {`);
  const block = blockStart >= 0 ? css.slice(blockStart, css.indexOf('}', blockStart)) : '';
  const value = block.match(new RegExp(`${property}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  if (!value) throw new Error(`Missing ${property} in ${selector}`);
  return value;
}

/** Convert a hexadecimal color to WCAG linear-light luminance. */
function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Calculate the WCAG contrast ratio between two hexadecimal colors. */
function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('book index styles', () => {
  const bookCss = readFileSync(new URL('../src/styles/book.css', import.meta.url), 'utf8');
  const globalCss = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const printCss = readFileSync(new URL('../src/styles/print-paged.css', import.meta.url), 'utf8');

  it('keeps web jump layout in component utilities and hides it from print', () => {
    expect(bookCss).not.toMatch(/\.index-jumps\s*\{/);
    expect(printCss).toMatch(/\.index-jumps\s*\{\s*display:\s*none;/);
  });

  it('compacts the seven-column preparation index for print', () => {
    expect(printCss).toMatch(/\.preparation-table\s*\{\s*font-size:\s*0\.78rem;/);
    expect(printCss).toMatch(
      /\.preparation-table th,\s*\.preparation-table td\s*\{\s*padding:\s*0\.3rem 0\.35rem;/,
    );
  });

  it('gives book secondary text AA contrast without changing the site-wide faint token', () => {
    const darkSecondary = cssColor(bookCss, '.book', '--book-secondary');
    const lightSecondary = cssColor(bookCss, ':root.light .book', '--book-secondary');

    expect(contrast(darkSecondary, cssColor(globalCss, ':root', '--panel'))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(
      contrast(lightSecondary, cssColor(globalCss, ':root.light', '--panel')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(cssColor(globalCss, ':root', '--faint')).toBe('#64748b');
    expect(cssColor(globalCss, ':root.light', '--faint')).toBe('#94a3b8');
  });

  it('applies the book token to navigation and rules labels', () => {
    const sources = [
      '../src/layouts/BookLayout.astro',
      '../src/components/Note.astro',
      '../src/components/StatBlock.astro',
      '../src/pages/brood-and-bloom/index.astro',
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

    expect(sources.every((source) => source.includes('book-secondary'))).toBe(true);
    expect(sources.join('\n')).not.toContain('text-faint');
  });
});

describe('preparation catalog', () => {
  it('gives a detailed preparation its stable destination and canonical metadata', async () => {
    const html = await container.renderToString(Preparation, {
      props: { name: 'Lavage' },
    });
    const entry = new JSDOM(html).window.document.querySelector<HTMLElement>('.preparation')!;

    expect(entry.id).toBe('p-lavage');
    expect(entry.querySelector('h4')?.textContent).toBe('Lavage');
    expect(entry.querySelector('.preparation-meta')?.textContent).toContain(
      'Draught, uncommon. Sporophore. 100 gp.',
    );
    expect(entry.querySelector('.preparation-rule')?.textContent).toContain(
      'A lavage taken later than that does the damage and nothing else.',
    );
  });

  it('links every appendix row to one unique detailed destination and shows its source', async () => {
    const html = await container.renderToString(PreparationTable, {
      props: { view: 'index' },
    });
    const page = new JSDOM(html, { url: 'https://openfray.app/' }).window.document;
    const headers = [...page.querySelectorAll('th')].map((header) => header.textContent?.trim());
    const links = [...page.querySelectorAll<HTMLAnchorElement>('tbody a')];

    expect(headers).toEqual([
      'Preparation',
      'Form',
      'Brood',
      'Rarity',
      'Price',
      'Source',
      'What it does',
    ]);
    expect(links).toHaveLength(19);
    expect(new Set(links.map((link) => link.href)).size).toBe(19);
    expect(links.map((link) => link.getAttribute('href'))).toContain(
      '/brood-and-bloom/chapter-7/#p-lavage',
    );
  });

  it('resolves every preparation index link on the built detailed chapter', () => {
    buildSite();
    const detail = new JSDOM(readFileSync('dist/brood-and-bloom/chapter-7/index.html', 'utf8'))
      .window.document;
    const appendix = new JSDOM(readFileSync('dist/brood-and-bloom/appendix-c/index.html', 'utf8'), {
      url: 'https://openfray.app/brood-and-bloom/appendix-c/',
    }).window.document;
    const links = [...appendix.querySelectorAll<HTMLAnchorElement>('.preparation-table a')];

    expect(links).toHaveLength(19);
    expect(links.every((link) => detail.getElementById(new URL(link.href).hash.slice(1)))).toBe(
      true,
    );
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
