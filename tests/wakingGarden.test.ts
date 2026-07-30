// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest';
import { creature, creatures } from '../src/data/wakingGarden.ts';

describe('The Waking Garden creature lookup', () => {
  it('finds a creature case-insensitively', () => {
    const first = creatures[0];
    expect(creature(first.name.toUpperCase()).name).toBe(first.name);
  });

  it('throws on a typo so the build fails instead of rendering a blank card', () => {
    expect(() => creature('No Such Creature')).toThrow(/no creature named/);
  });

  it('is tagged with the book’s own source id throughout', () => {
    for (const c of creatures) expect(c.source).toBe('openfray-waking-garden');
  });
});
