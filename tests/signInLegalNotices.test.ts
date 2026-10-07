// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Read legal copy with markup and whitespace normalized. */
function legalText(page: string) {
  return readFileSync(`src/pages/${page}.astro`, 'utf8')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

describe('legal links', () => {
  it.each(['src/layouts/Layout.astro', 'src/content/news/openfray-1-2.mdx', 'public/llms.txt'])(
    'uses trailing slashes in %s',
    (path) => {
      const source = readFileSync(path, 'utf8');
      expect(source).toMatch(/\/(?:privacy|terms)\//);
      expect(source).not.toMatch(/\/(?:privacy|terms)(?=["')?#])/);
    },
  );
});

describe('sign-in legal notices', () => {
  it('describes agreement through the named provider buttons', () => {
    const terms = legalText('terms');
    expect(terms).toContain(
      'Clicking “Continue with Google” or “Continue with Discord” means you agree to these terms.',
    );
    expect(terms).not.toContain('asks you to confirm it');
    expect(terms).toContain('Last updated: 7 October 2026');
    expect(terms).toContain('AGPL version 3 or later');
    expect(terms).toContain('importer is licensed separately under MIT');
  });

  it('distinguishes necessary account processing from blanket consent', () => {
    const privacy = legalText('privacy');
    expect(privacy).toContain('save your content to perform our contract with you');
    expect(privacy).toContain('you do not need to accept it as a separate agreement');
    expect(privacy).not.toContain('for optional sign-in — on your consent');
    expect(privacy).toContain('Last updated: 7 October 2026');
    expect(privacy).toContain('AGPL version 3 or later');
    expect(privacy).toContain('importer is licensed separately under MIT');
  });
});
