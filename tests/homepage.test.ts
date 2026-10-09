// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const homepage = readFileSync('src/pages/index.astro', 'utf8');
const demonstration = homepage.match(/<Split\b[^>]*id="difference-title"[\s\S]*?<\/Split>/)?.[0];

describe('homepage effects demonstration', () => {
  it('offers a console open beside the demonstration and keeps the tracking link', () => {
    expect(demonstration).toBeDefined();
    expect(demonstration).toContain('<Cta href="/console/">Open the console →</Cta>');
    expect(demonstration).toContain('href="/features/tracking/"');
  });

  it('retains the existing video and accessible description as proof', () => {
    expect(demonstration).toContain('src="/media/roll-with-effects.mp4"');
    expect(demonstration).toContain('poster="/media/roll-with-effects.jpg"');
    expect(demonstration).toMatch(/aria-label="[^"]+"/);
  });
});

describe('homepage account and source links', () => {
  it('distinguishes anonymous fights from account-backed saving', () => {
    expect(homepage).toContain('Run your fights without an account');
    expect(homepage).not.toContain('Everything works without an account');
    expect(homepage).not.toContain('Everything on this page');
  });

  it('points issues at their owning repository and credits at the canonical page', () => {
    expect(homepage).toContain('href: `${repo}/openfray/issues`');
    expect(homepage).toContain("href: '/credits/'");
    expect(homepage).not.toContain('href: `${repo}/issues`');
    expect(homepage).not.toContain('href: `${repo}/blob/main/CREDITS.md`');
  });
});
