// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest';
import { spell, spells } from '../src/data/broodAndBloomSpells.ts';

describe('Brood & Bloom spell lookup', () => {
  it('finds a spell case-insensitively', () => {
    expect(spell('bloom interdict').name).toBe('Bloom Interdict');
  });

  it('throws on a typo so the build fails instead of rendering a blank card', () => {
    expect(() => spell('No Such Spell')).toThrow(/Brood & Bloom: no spell named/);
  });

  it('holds all 23 spells under the book’s source id', () => {
    expect(spells).toHaveLength(23);
    for (const s of spells) expect(s.source).toBe('openfray-brood-and-bloom');
  });

  it('keeps the possessive spelled with the curly apostrophe the chapter types', () => {
    // A straight apostrophe here and a curly one in the MDX is a build-time throw, and
    // the two are indistinguishable on screen — so it is pinned rather than eyeballed.
    expect(spells.map((s) => s.name)).toContain('Prosector’s Purgation');
  });
});
