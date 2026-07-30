// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest';
import { creature, creatures } from '../src/data/broodAndBloom.ts';

describe('Brood & Bloom creature lookup', () => {
  it('finds a creature case-insensitively', () => {
    expect(creature('latchling').name).toBe('Latchling');
  });

  it('throws on a typo so the build fails instead of rendering a blank card', () => {
    expect(() => creature('No Such Creature')).toThrow(/Brood & Bloom: no creature named/);
  });

  it('holds the full 58-creature v2 bestiary under the book’s source id', () => {
    expect(creatures).toHaveLength(58);
    for (const c of creatures) expect(c.source).toBe('openfray-brood-and-bloom');
  });

  it('carries the Lazaret trio the book’s Lazaret chapter renders', () => {
    for (const name of ['Lazaret Registrar', 'Lazaret Lector', 'Lazaret Prosector']) {
      expect(creature(name).type).toBe('humanoid');
    }
  });
});
