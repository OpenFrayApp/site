// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest';
import { spell, spells } from '../src/data/strongWatersSpells.ts';

describe('Strong Waters spell lookup', () => {
  it('finds a spell case-insensitively', () => {
    expect(spell('steady fire').name).toBe('Steady Fire');
  });

  it('throws on a typo so the build fails instead of rendering a blank card', () => {
    expect(() => spell('No Such Spell')).toThrow(/Strong Waters: no spell named/);
  });

  it('holds all 11 spells under the book’s source id', () => {
    expect(spells).toHaveLength(11);
    for (const s of spells) expect(s.source).toBe('openfray-strong-waters');
  });

  it('carries the two spells the book’s second chapter promises by name', () => {
    const names = spells.map((s) => s.name);
    expect(names).toContain('Steady Fire');
    expect(names).toContain('Hasten the Root');
  });
});
