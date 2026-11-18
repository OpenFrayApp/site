// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import Layout from '../src/layouts/Layout.astro';
import { features } from '../src/data/features.ts';

const layout = readFileSync('src/layouts/Layout.astro', 'utf8');
const featureLinks = layout.match(/features\.map\([\s\S]*?\)\)\s*\}/)?.[0];

describe('responsive feature navigation', () => {
  it('shows the current creature and spell totals for Libraries', () => {
    expect(features.find((feature) => feature.name === 'Libraries')?.blurb).toBe(
      'Over 2300 creatures and 1900 spells included, plus everything your table invents.',
    );
  });

  it('hides icons and descriptions through tablet widths while retaining desktop content', () => {
    expect(featureLinks).toBeDefined();
    expect(featureLinks?.match(/max-\[1025px\]:hidden/g)).toHaveLength(2);
    expect(featureLinks).toContain('<FeatureIcon');
    expect(featureLinks).toContain('{f.blurb}');
    expect(featureLinks).toContain('href={f.href}');
    expect(featureLinks).toContain('{f.name}');
  });

  it.each([
    ['/', true],
    ['/sign-in/', false],
    ['/sign-up/', false],
  ])(
    'only offers the header sign-up link outside the auth entry pages (%s)',
    async (path, expected) => {
      const container = await AstroContainer.create({ astroConfig: { site: 'https://openfray.app' } });
      const html = await container.renderToString(Layout, {
        props: { title: 'OpenFray' },
        request: new Request(new URL(path, 'https://openfray.app')),
      });
      const dom = new JSDOM(html);
      try {
        const links = dom.window.document.querySelectorAll('#topnav a[href="/sign-up/"]');
        expect(links).toHaveLength(expected ? 1 : 0);
        if (expected) expect(links[0].textContent?.trim()).toBe('Sign up');
      } finally {
        dom.window.close();
      }
    },
  );

  it('keeps mobile menu hooks and narrows only the tablet dropdown', () => {
    expect(layout).toContain('nav-toggle');
    expect(layout).toContain('id="topnav"');
    expect(layout).toContain('group-hover:block group-focus-within:block');
    expect(layout).toContain('md:max-[1025px]:w-56');
    expect(layout).toContain('max-md:w-full');
  });
});
