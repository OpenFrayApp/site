// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync('src/layouts/Layout.astro', 'utf8');
const featureLinks = layout.match(/features\.map\([\s\S]*?\)\)\s*\}/)?.[0];

describe('responsive feature navigation', () => {
  it('hides icons and descriptions through tablet widths while retaining desktop content', () => {
    expect(featureLinks).toBeDefined();
    expect(featureLinks?.match(/max-\[1025px\]:hidden/g)).toHaveLength(2);
    expect(featureLinks).toContain('<FeatureIcon');
    expect(featureLinks).toContain('{f.blurb}');
    expect(featureLinks).toContain('href={f.href}');
    expect(featureLinks).toContain('{f.name}');
  });

  it('keeps mobile menu hooks and narrows only the tablet dropdown', () => {
    expect(layout).toContain('nav-toggle');
    expect(layout).toContain('id="topnav"');
    expect(layout).toContain('group-hover:block group-focus-within:block');
    expect(layout).toContain('min-[641px]:max-[1025px]:w-56');
    expect(layout).toContain('max-[640px]:w-full');
  });
});
