// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../scripts/check-prose.mjs', import.meta.url));

/** Run the prose gate against an isolated documentation fixture. */
function check(file: string) {
  const directory = mkdtempSync(join(tmpdir(), 'openfray-site-prose-'));
  try {
    const path = join(directory, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '# Fixture\n\nNew — wording.\n');
    return spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('prose check scope', () => {
  it.each(['README.md', 'docs/development/print-check.md', 'src/content/news/release.mdx'])(
    'checks public prose in %s',
    (file) => {
      expect(check(file).status).toBe(1);
    },
  );

  it.each([
    'docs/marketing/product-marketing.md',
    '.claude/skills/example/SKILL.md',
    'src/content/waking-garden/chapter.mdx',
  ])('excludes private context and book prose in %s', (file) => {
    expect(check(file).status).toBe(0);
  });
});
