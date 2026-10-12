// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');
const consoleCheckout = workflow.match(
  /repository: OpenFrayApp\/console\n([\s\S]*?)persist-credentials: false/,
)?.[1];
const purePaths = ['/src/lib/byline.ts', '/src/schema/contentLicense.ts'];

it('pins the console checkout to the reviewed published snapshot', () => {
  expect(consoleCheckout).toBeDefined();
  expect(consoleCheckout?.match(/^\s+ref: (.+)$/m)?.[1]).toBe(
    '6f538b07ba6eafe0043b0e376f4c13c0a0d90448',
  );
  expect(consoleCheckout).toMatch(/^\s+path: console$/m);
  expect(consoleCheckout).toMatch(/^\s+sparse-checkout-cone-mode: false$/m);
});

it('checks out only compendium, credits, and the two account helpers', () => {
  const paths = consoleCheckout
    ?.match(/sparse-checkout: \|\n([\s\S]*)/)?.[1]
    .trim()
    .split('\n')
    .map((line) => line.trim());
  expect(paths).toEqual(['/public/compendium/', '/CREDITS.md', ...purePaths]);
});

it('resolves the actual account imports to dependency-free console modules', () => {
  const importedPaths = new Set<string>();
  for (const caller of ['../src/account/page.ts', '../src/components/Account.astro']) {
    const callerUrl = new URL(caller, import.meta.url);
    const source = readFileSync(callerUrl, 'utf8');
    for (const match of source.matchAll(/from ['"](\.\.\/\.\.\/\.\.\/console\/src\/[^'"]+)['"]/g)) {
      importedPaths.add(match[1].replace('../../../console', ''));
      const helper = readFileSync(new URL(match[1], callerUrl), 'utf8');
      expect(helper).not.toMatch(/^\s*import\b|\b(?:from\s*|import\s*\(|require\s*\()['"]/m);
    }
  }
  expect([...importedPaths].sort()).toEqual(purePaths);
});
