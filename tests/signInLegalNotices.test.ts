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

describe('sign-in legal notices', () => {
  it('describes agreement through the named provider buttons', () => {
    const terms = legalText('terms');
    expect(terms).toContain(
      'Clicking “Continue with Google” or “Continue with Discord” means you agree to these terms.',
    );
    expect(terms).not.toContain('asks you to confirm it');
    expect(terms).toContain('Last updated: 24 September 2026');
  });

  it('distinguishes necessary account processing from blanket consent', () => {
    const privacy = legalText('privacy');
    expect(privacy).toContain('save your content to perform our contract with you');
    expect(privacy).toContain('you do not need to accept it as a separate agreement');
    expect(privacy).not.toContain('for optional sign-in — on your consent');
    expect(privacy).toContain('Last updated: 24 September 2026');
  });
});
