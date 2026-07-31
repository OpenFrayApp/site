// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

// `lastmod` for the sitemap, taken from the last commit that touched the page's source
// file. A file's history is the only honest answer to "when did this page last change" —
// a build timestamp would mark every page as modified on every deploy, which is exactly
// the signal Google says it stops trusting.
//
// Everything here fails soft. A URL whose source can't be resolved, a file with no
// commits yet, or a checkout without history all yield no lastmod for that entry rather
// than a wrong one, because a date that is present and wrong is worse than one that is
// absent.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const PAGES = 'src/pages';

/** The content collections that own a URL prefix, and the directory behind each. */
const COLLECTIONS = [
  { prefix: 'news', dir: 'src/content/news', slugged: true },
  { prefix: 'the-waking-garden', dir: 'src/content/waking-garden', slugged: false },
  { prefix: 'brood-and-bloom', dir: 'src/content/brood-and-bloom', slugged: false },
];

/** `git log` for one file, or undefined when git has nothing to say about it. */
function gitLastCommit(file, cwd) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || undefined;
  } catch {
    // No git, not a repository, or the command failed — no lastmod, no build failure.
    return undefined;
  }
}

/**
 * Whether the checkout has enough history to date files apart. A shallow clone answers
 * every `git log -1` with the one commit it has, which would stamp every URL with the
 * same date — a uniform lie rather than a useful signal. Some CI checkouts are shallow
 * by default, so this is worth asking before trusting any of it.
 */
export function hasUsableHistory(cwd) {
  try {
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return shallow === 'false';
  } catch {
    return false;
  }
}

/** The `slug` frontmatter field, when an entry overrides its file name. */
function declaredSlug(source) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = block?.[1].match(/^slug:\s*(.+)$/m);
  return line ? line[1].trim().replace(/^['"]|['"]$/g, '') : undefined;
}

/**
 * URL slug → source file, for one collection directory. Only collections whose entries
 * may override their slug need reading; the books are named by their file.
 */
export function slugIndex(dir, root = '.') {
  const index = new Map();
  const full = join(root, dir);
  if (!existsSync(full)) return index;
  for (const file of readdirSync(full).filter((f) => f.endsWith('.mdx'))) {
    const path = join(dir, file);
    const slug = declaredSlug(readFileSync(join(root, path), 'utf8')) ?? basename(file, '.mdx');
    index.set(slug, path);
  }
  return index;
}

/** Every slugged collection's index, read once rather than per URL. */
export function buildIndex(root = '.') {
  const indexes = new Map();
  for (const collection of COLLECTIONS) {
    if (collection.slugged) indexes.set(collection.prefix, slugIndex(collection.dir, root));
  }
  return indexes;
}

/**
 * The source file behind a built URL, or undefined when nothing obvious owns it.
 *
 * A collection entry is checked before a page, because `/the-waking-garden/` is a page
 * while `/the-waking-garden/chapter-1/` is a chapter, and only the deeper path belongs
 * to the collection.
 */
export function sourceFor(pathname, indexes, root = '.') {
  const segments = pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);

  if (segments.length >= 2) {
    const collection = COLLECTIONS.find((c) => c.prefix === segments[0]);
    if (collection) {
      const slug = segments.slice(1).join('/');
      const mapped = collection.slugged
        ? indexes.get(collection.prefix)?.get(slug)
        : join(collection.dir, `${slug}.mdx`);
      if (mapped && existsSync(join(root, mapped))) return mapped;
    }
  }

  // A route is either `pages/x.astro` or `pages/x/index.astro`; the site uses both.
  const name = segments.length ? segments.join('/') : 'index';
  for (const candidate of [`${PAGES}/${name}.astro`, `${PAGES}/${name}/index.astro`]) {
    if (existsSync(join(root, candidate))) return candidate;
  }
  return undefined;
}

/**
 * A `serialize` hook for @astrojs/sitemap that adds `lastmod` from git. Returns the item
 * untouched when it can't date it, which drops the field rather than inventing one.
 */
export function createLastmod({
  root = '.',
  run = gitLastCommit,
  warn = console.warn,
  history = hasUsableHistory,
} = {}) {
  if (!history(root)) {
    warn('[sitemap] no usable git history — lastmod omitted rather than guessed.');
    return (item) => item;
  }

  const indexes = buildIndex(root);
  const cache = new Map();

  return (item) => {
    const { pathname } = new URL(item.url);
    const source = sourceFor(pathname, indexes, root);
    if (!source) return item;

    if (!cache.has(source)) cache.set(source, run(source, root));
    const committed = cache.get(source);
    return committed ? { ...item, lastmod: committed } : item;
  };
}
