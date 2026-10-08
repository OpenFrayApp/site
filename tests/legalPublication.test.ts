// @vitest-environment node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { GET } from '../src/pages/legal-publication.json';

it('publishes normalized dates from the same source used by visible legal labels', async () => {
  const manifest = await (await GET()).json();
  expect(manifest).toMatchObject({ schemaVersion: 1, terms: '2026-10-08', privacy: '2026-10-08' });
  for (const document of ['terms', 'privacy']) {
    const page = readFileSync(`src/pages/${document}.astro`, 'utf8');
    expect(page).toContain(`datetime={legalDates.${document}}`);
    expect(page).toContain(`{legalDateLabel(legalDates.${document})}`);
  }
});

it('describes publication-time service notices and limited analytics processing without promising receipt', () => {
  const terms = readFileSync('src/pages/terms.astro', 'utf8').replace(/\s+/g, ' ');
  const privacy = readFileSync('src/pages/privacy.astro', 'utf8').replace(/\s+/g, ' ');
  expect(terms).toContain(
    'We initiate email notification to existing account holders when the updated terms are published.',
  );
  expect(terms).toContain('Delivery and receipt are not guaranteed');
  expect(terms).not.toContain('before it takes effect: in the app');
  expect(privacy).toContain(
    'We use Fathom Analytics to measure website traffic and feature usage without cookies or cross-site tracking.',
  );
  expect(privacy).toContain(
    'Fathom processes limited technical information to generate privacy-preserving statistics.',
  );
  expect(privacy).not.toMatch(/collects no personal data|aggregate traffic only, no personal data/);
  expect(privacy).toContain(
    'welcome emails and notices of published Terms or Privacy Policy updates',
  );
  expect(privacy).toContain('Provider delivery records');
});
