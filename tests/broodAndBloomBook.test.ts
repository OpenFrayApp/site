// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { creatures } from '../src/data/broodAndBloom.ts';

const contentDirectory = resolve('src/content/brood-and-bloom');

/** Read every Brood & Bloom chapter source by its content id. */
async function chapters() {
  const entries = new Map<string, string>();

  for (const path of await readdir(contentDirectory)) {
    if (path.endsWith('.mdx')) {
      entries.set(basename(path, '.mdx'), await readFile(resolve(contentDirectory, path), 'utf8'));
    }
  }

  return entries;
}

/** Read a front-matter field whose value is a single-quoted string or number. */
function frontMatter(source: string, field: string) {
  return source.match(new RegExp(`^${field}: '?([^'\n]+)'?$`, 'm'))?.[1];
}

/** Find the stat-block names rendered directly by a chapter. */
function creatureNames(source: string) {
  return [...source.matchAll(/<Creature\b[^>]*name="([^"]+)"/g)].map(([, name]) => name);
}

/** Collapse authored line wrapping so prose contracts read as sentences. */
function normalized(source: string) {
  return source.replace(/\s+/g, ' ');
}

describe('Brood & Bloom book integrity', () => {
  it('keeps the overview, chapters, and appendices in one unique contiguous reading order', async () => {
    const entries = await chapters();
    const order = [...entries.entries()]
      .map(([id, source]) => ({ id, order: Number(frontMatter(source, 'order')) }))
      .sort((a, b) => a.order - b.order);

    expect(order).toEqual([
      { id: 'overview', order: 0 },
      { id: 'chapter-1', order: 1 },
      { id: 'chapter-2', order: 2 },
      { id: 'chapter-3', order: 3 },
      { id: 'chapter-4', order: 4 },
      { id: 'chapter-5', order: 5 },
      { id: 'chapter-6', order: 6 },
      { id: 'chapter-7', order: 7 },
      { id: 'appendix-a', order: 8 },
      { id: 'appendix-b', order: 9 },
      { id: 'appendix-c', order: 10 },
    ]);
  });

  it('uses sentence case for chapter and appendix titles', async () => {
    const entries = await chapters();

    expect(frontMatter(entries.get('chapter-7')!, 'title')).toBe('Alchemy & magic');
    expect(frontMatter(entries.get('appendix-a')!, 'title')).toBe('Index: by Challenge Rating');
    expect(frontMatter(entries.get('appendix-b')!, 'title')).toBe('Index: by type');
    expect(frontMatter(entries.get('appendix-c')!, 'title')).toBe('Index: alchemy & magic');
  });

  it('matches declared brood counts, stat-block placements, and the verified total', async () => {
    const entries = await chapters();
    const declaredCounts = new Map([
      ['chapter-2', { count: 3, declaration: 'three officers' }],
      ['chapter-3', { count: 6, declaration: 'six creatures' }],
      ['chapter-4', { count: 15, declaration: 'fifteen creatures' }],
      ['chapter-5', { count: 24, declaration: 'twenty-four creatures' }],
      ['chapter-6', { count: 19, declaration: 'nineteen creatures' }],
    ]);
    const placements = [...declaredCounts].flatMap(([id, { count }]) => {
      const names = creatureNames(entries.get(id)!);
      expect(names).toHaveLength(count);
      return names;
    });

    for (const [id, { declaration }] of declaredCounts) {
      if (declaration) {
        expect(frontMatter(entries.get(id)!, 'description')).toContain(declaration);
      }
    }
    expect(placements).toHaveLength(creatures.length);
    expect(new Set(placements)).toEqual(new Set(creatures.map((creature) => creature.name)));
  });

  it('sends readers from the overview to every prerequisite, brood, and appendix lookup', async () => {
    const overview = (await chapters()).get('overview')!;

    expect(overview).toContain(
      '**[Chapter 3](/brood-and-bloom/chapter-3/)** is the people. It covers the cult',
    );
    expect(overview).toContain(
      '**[Chapter 7](/brood-and-bloom/chapter-7/)** holds the alchemy and the',
    );

    for (const destination of [
      '/brood-and-bloom/chapter-1/',
      '/brood-and-bloom/chapter-2/',
      '/brood-and-bloom/chapter-3/',
      '/brood-and-bloom/chapter-4/',
      '/brood-and-bloom/chapter-5/',
      '/brood-and-bloom/chapter-6/',
      '/brood-and-bloom/chapter-7/',
      '/brood-and-bloom/appendix-a/',
      '/brood-and-bloom/appendix-b/',
      '/brood-and-bloom/appendix-c/',
    ]) {
      expect(overview).toContain(`](${destination})`);
    }
  });

  it('resolves tied Inquiline lines and names exact stages in shared magic guidance', async () => {
    const sharedRules = normalized((await chapters()).get('chapter-1')!);

    expect(sharedRules).toContain(
      'If the highest scores tie across rows, the Game Master chooses which tied score sets the line.',
    );
    expect(sharedRules).toContain('| Heal | Removes 3d4 Depth at stages 0–2, or 2d4 at stage 3');
    expect(sharedRules).toContain(
      '| Lesser Restoration | Detaches a lesser parasite, and removes 1d4 Depth at stages 0–2 | Removes 3 Spore Load, and cures stage 1 or reduces stage 2 to stage 1',
    );
    expect(sharedRules).toContain(
      '| Greater Restoration | Removes 2d4 Depth at stages 0–2, or 1d4 at stage 3 | Cures stages 1–2, or reduces stage 3 to stage 2',
    );
  });

  it('defines Inquiline diagnosis, physician training, expulsion, and pre-onset surgery', async () => {
    const inquiline = normalized((await chapters()).get('chapter-4')!);

    expect(inquiline).toContain(
      'Any creature can make this check; proficiency in Medicine is not required.',
    );
    expect(inquiline).toContain(
      'In this chapter, a trained physician is a creature proficient in Medicine.',
    );
    expect(inquiline).toContain(
      'Chantry Expulsion cannot begin while the host has an unexpended spell slot, is affected by ongoing magic, or occupies a magical aura or location.',
    );
    expect(inquiline).toContain(
      'Carrying an unused magic item or having an unused magical feature does not restart the process.',
    );
    expect(inquiline).toContain(
      'Treat a graft with no presented disease as stage 0 when calculating this Difficulty Class.',
    );
  });

  it('makes Inquiline disease stages cumulative and bounds Zone of Truth', async () => {
    const inquiline = normalized((await chapters()).get('chapter-4')!);

    expect(inquiline).toContain(
      'Disease-stage effects are cumulative unless a later stage explicitly replaces an earlier value.',
    );
    expect(inquiline).toContain(
      'Zone of Truth tests whether an Amanuensis speaks sincerely, not whether its account is factually accurate.',
    );
    expect(inquiline).not.toContain('beyond the reach of anything but surgery');
    expect(inquiline).not.toContain('extraction comes first, always');
  });
});
