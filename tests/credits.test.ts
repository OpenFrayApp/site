// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { Content as Credits } from '../../console/CREDITS.md';
import { shippedLibraries } from '../src/data/libraries.ts';

it('renders canonical console attribution and licenses with one page heading', async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Credits);
  const document = new JSDOM(html).window.document;
  expect(document.querySelectorAll('h1')).toHaveLength(1);
  const text = document.body.textContent;
  for (const creator of [
    'KibblesTasty Homebrew LLC',
    'Omega Ankh',
    'somanyrobots',
    'Wizards of the Coast',
  ]) {
    expect(text).toContain(creator);
  }
  expect(text).toContain('Wall of Blood');
  expect(text).toContain('Maya Selbie');
  expect(text).toContain('Changes were made');
  expect(
    document.querySelector('a[href="https://creativecommons.org/licenses/by/4.0/legalcode"]'),
  ).not.toBeNull();
  expect(
    document.querySelector('a[href="https://www.gmbinder.com/share/-NR0OWlW60yv2EfA3qQp"]'),
  ).not.toBeNull();
  expect(
    document.querySelector('a[href="https://www.gmbinder.com/share/-NMZq9u_rDyV_XD5YTxf"]'),
  ).not.toBeNull();
});

it('links the canonical credits page and lists the shipped reference collections', () => {
  expect(readFileSync('src/pages/credits.astro', 'utf8')).toContain('../../../console/CREDITS.md');
  expect(readFileSync('src/pages/index.astro', 'utf8')).toContain("href: '/credits/'");
  expect(shippedLibraries).toContain('Kibbles’ Casting Compendium v2.3');
  expect(shippedLibraries).toContain('Spells That Don’t Suck');
  expect(shippedLibraries).toContain('So Many Spells');
});
