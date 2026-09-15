// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { readFileSync } from 'node:fs';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import SpellIndex from '../src/components/SpellIndex.astro';

const bookLayout = readFileSync(
  new URL('../src/layouts/BookLayout.astro', import.meta.url),
  'utf8',
);
const landingPages = [
  '../src/pages/brood-and-bloom/index.astro',
  '../src/pages/the-waking-garden/index.astro',
  '../src/pages/strong-waters/index.astro',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

describe('BookLayout navigation', () => {
  it('renders persistent contents navigation only when there is a current chapter', () => {
    expect(bookLayout).toMatch(
      /current\s*&&\s*\([\s\S]*book-nav-state[\s\S]*book-sidebar[\s\S]*\)\s*}/,
    );
  });

  it('keeps chapter contents in a viewport-bounded scrolling panel on mobile', () => {
    expect(bookLayout).toContain('max-[900px]:max-h-[calc(100vh-8rem)]');
    expect(bookLayout).toContain('max-[900px]:overflow-y-auto');
  });
});

describe('book landing actions', () => {
  it('makes reading primary and the console secondary on every landing page', () => {
    for (const page of landingPages) {
      expect(page).toMatch(
        /<Cta href=.*>Start reading<\/Cta>[\s\S]*<Cta href="\/console\/" variant="ghost">/,
      );
    }
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
