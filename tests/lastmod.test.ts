// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors
// @vitest-environment node
// Node, not jsdom: this is filesystem and child-process work with no DOM in it.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations.
import { buildIndex, createLastmod, slugIndex, sourceFor } from '../src/lib/lastmod.mjs';

let root: string;

/** Lay out the parts of the site tree this module reads. */
function fixture(): void {
  root = mkdtempSync(join(tmpdir(), 'lastmod-'));
  mkdirSync(join(root, 'src/content/news'), { recursive: true });
  mkdirSync(join(root, 'src/content/waking-garden'), { recursive: true });
  mkdirSync(join(root, 'src/pages/news'), { recursive: true });
  mkdirSync(join(root, 'src/pages/the-waking-garden'), { recursive: true });

  // A post whose URL is its file name, and one that overrides it.
  writeFileSync(join(root, 'src/content/news/plain-post.mdx'), "---\ntitle: 'A'\n---\n");
  writeFileSync(
    join(root, 'src/content/news/brood-and-bloom.mdx'),
    "---\ntitle: 'B'\nslug: 'brood-bloom-free-bestiary'\n---\n",
  );
  writeFileSync(join(root, 'src/content/waking-garden/chapter-2.mdx'), "---\ntitle: 'C'\n---\n");

  // Both route shapes the site uses.
  writeFileSync(join(root, 'src/pages/privacy.astro'), '<p>legal</p>');
  writeFileSync(join(root, 'src/pages/index.astro'), '<p>home</p>');
  writeFileSync(join(root, 'src/pages/news/index.astro'), '<p>listing</p>');
  writeFileSync(join(root, 'src/pages/the-waking-garden/index.astro'), '<p>book</p>');
}

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('slug index', () => {
  it('maps a declared slug to the file that declares it', () => {
    fixture();
    const index = slugIndex('src/content/news', root);
    expect(index.get('brood-bloom-free-bestiary')).toBe('src/content/news/brood-and-bloom.mdx');
  });

  it('falls back to the file name when a post declares no slug', () => {
    fixture();
    expect(slugIndex('src/content/news', root).get('plain-post')).toBe(
      'src/content/news/plain-post.mdx',
    );
  });
});

describe('resolving a URL to its source', () => {
  it('follows a custom slug to the differently-named file', () => {
    // The whole reason an index is built rather than guessing from the URL: the post at
    // /news/brood-bloom-free-bestiary/ lives in brood-and-bloom.mdx.
    fixture();
    expect(sourceFor('/news/brood-bloom-free-bestiary/', buildIndex(root), root)).toBe(
      'src/content/news/brood-and-bloom.mdx',
    );
  });

  it('finds a book chapter, which is named by its file', () => {
    fixture();
    expect(sourceFor('/the-waking-garden/chapter-2/', buildIndex(root), root)).toBe(
      'src/content/waking-garden/chapter-2.mdx',
    );
  });

  it('gives a collection root its page, not a chapter', () => {
    // /the-waking-garden/ is a page; only the deeper path belongs to the collection.
    fixture();
    expect(sourceFor('/the-waking-garden/', buildIndex(root), root)).toBe(
      'src/pages/the-waking-garden/index.astro',
    );
    expect(sourceFor('/news/', buildIndex(root), root)).toBe('src/pages/news/index.astro');
  });

  it('handles both route shapes and the site root', () => {
    fixture();
    const index = buildIndex(root);
    expect(sourceFor('/privacy/', index, root)).toBe('src/pages/privacy.astro');
    expect(sourceFor('/', index, root)).toBe('src/pages/index.astro');
  });

  it('returns nothing for a URL it cannot place', () => {
    fixture();
    const index = buildIndex(root);
    expect(sourceFor('/news/no-such-post/', index, root)).toBeUndefined();
    expect(sourceFor('/invented/', index, root)).toBeUndefined();
  });
});

describe('the sitemap hook', () => {
  const item = (url: string) => ({ url, changefreq: 'weekly' });

  it('stamps each URL with its own file’s commit date', () => {
    fixture();
    const dates: Record<string, string> = {
      'src/content/news/brood-and-bloom.mdx': '2026-07-31T11:28:24.000Z',
      'src/pages/privacy.astro': '2026-07-31T07:18:47.000Z',
    };
    const serialize = createLastmod({
      root,
      history: () => true,
      run: (file: string) => dates[file],
    });
    expect(serialize(item('https://openfray.app/news/brood-bloom-free-bestiary/')).lastmod).toBe(
      '2026-07-31T11:28:24.000Z',
    );
    expect(serialize(item('https://openfray.app/privacy/')).lastmod).toBe(
      '2026-07-31T07:18:47.000Z',
    );
  });

  it('omits lastmod rather than inventing one for a file with no commits', () => {
    // A post added but not yet committed has no date. Absent beats wrong.
    fixture();
    const serialize = createLastmod({ root, history: () => true, run: () => undefined });
    expect(serialize(item('https://openfray.app/privacy/')).lastmod).toBeUndefined();
  });

  it('omits lastmod for a URL it cannot resolve', () => {
    fixture();
    const serialize = createLastmod({
      root,
      history: () => true,
      run: () => '2026-01-01T00:00:00Z',
    });
    expect(serialize(item('https://openfray.app/invented/')).lastmod).toBeUndefined();
  });

  it('gives up entirely on a shallow checkout', () => {
    // A shallow clone answers every `git log -1` with its single commit, which would
    // stamp every URL with the same date — a uniform lie. Some CI checkouts are shallow.
    fixture();
    const warnings: string[] = [];
    const serialize = createLastmod({
      root,
      history: () => false,
      run: () => '2026-01-01T00:00:00Z',
      warn: (m: string) => warnings.push(m),
    });
    expect(serialize(item('https://openfray.app/privacy/')).lastmod).toBeUndefined();
    expect(warnings.join(' ')).toMatch(/lastmod omitted/);
  });

  it('asks git once per file, however many URLs share it', () => {
    fixture();
    const asked: string[] = [];
    const serialize = createLastmod({
      root,
      history: () => true,
      run: (file: string) => {
        asked.push(file);
        return '2026-01-01T00:00:00Z';
      },
    });
    serialize(item('https://openfray.app/privacy/'));
    serialize(item('https://openfray.app/privacy/'));
    expect(asked).toEqual(['src/pages/privacy.astro']);
  });
});
