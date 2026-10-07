// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Read legal copy with markup and whitespace normalized. */
function legalText(page: string) {
  return readFileSync(`src/pages/${page}.astro`, 'utf8')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,:;])/g, '$1');
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

describe('tutorial privacy notices', () => {
  it('discloses permanent suppression in device settings and account metadata', () => {
    const privacy = legalText('privacy');
    expect(privacy).toContain(
      'Whether you permanently dismissed or completed the tutorial, stored in your account’s user metadata.',
    );
    expect(privacy).toContain(
      'App settings — which content libraries you have turned on, how the compendium is sorted, and what your player view reveals, in localStorage. These settings also record permanent tutorial dismissal or completion.',
    );
    expect(privacy).toContain(
      'Automatic tutorial invitations stop when either your device or your account records permanent dismissal or completion.',
    );
    expect(privacy).toContain('You can still start the tutorial manually.');
  });

  it('discloses anonymous transfer and the limits of background account updates', () => {
    const privacy = legalText('privacy');
    expect(privacy).toContain(
      'A device preference set while anonymous transfers to your account after sign-in.',
    );
    expect(privacy).toContain(
      'Preference changes apply locally first, with account updates sent in the background.',
    );
    expect(privacy).toContain(
      'If an account update fails, suppression across devices remains unconfirmed.',
    );
    expect(privacy).toContain('Anonymous encounter data lives only in your browser');
  });

  it('separates the session invitation latch, encounter recovery, and unsaved guide progress', () => {
    const privacy = legalText('privacy');
    expect(privacy).toContain(
      'Tutorial invitation state: whether an invitation has already been offered in this tab’s session, in sessionStorage. This is separate from anonymous encounter recovery.',
    );
    expect(privacy).toContain('Tutorial step progress is kept only in memory.');
    expect(privacy).toContain(
      'Reloading closes the guide without restoring a step; encounter recovery uses the normal storage described above.',
    );
    expect(privacy).toContain(
      'If browser storage is blocked, tutorial use remains available, but device preferences and session invitation state may not survive a reload.',
    );
  });
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
