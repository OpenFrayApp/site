// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('src/pages/features/libraries.astro', 'utf8').replace(/\s+/g, ' ');

describe('Libraries feature page', () => {
  it('targets creature and spell lookup with current totals', () => {
    expect(page).toContain('title="DnD creature and spell libraries — OpenFray"');
    expect(page).toContain('heading="Your DnD creature and spell libraries, beside the fight"');
    expect(page).toContain('Over 2300 creatures and 1900 spells included');
    const description = page.match(/ description="([^"]+)"/)?.[1];
    expect(description).toContain('free DnD 5e compendium');
    expect(description!.length).toBeLessThanOrEqual(160);
    expect(page).not.toContain('2000 creatures');
    expect(page).not.toContain('655 more spell cards');
  });

  it('focuses on choosing books without becoming a settings guide', () => {
    expect(page).toContain('Settings → Libraries');
    expect(page).toContain('Run Basic Rules 2024, Basic Rules 2014, or both');
    expect(page).toContain('Open the console and choose your libraries');
    expect(page).not.toContain('stay in this browser');
    expect(page).not.toContain('Turning a library off filters');
    expect(page).not.toContain('Every included book is used under its own license');
    expect(page).not.toContain('durable roster');
    expect(page).not.toContain('campaigns that carry your house rules');
  });

  it('uses the independently refreshed and cropped site capture', () => {
    const recipe = readFileSync('screenshots/recipes/library-toggles.yaml', 'utf8');
    expect(recipe.indexOf('name: Not now')).toBeLessThan(recipe.indexOf('use: open-settings'));
    const screenshot = readFileSync('src/assets/screenshots/library-toggles.png');
    expect(screenshot.readUInt32BE(16)).toBe(1080);
    expect(screenshot.readUInt32BE(20)).toBe(1860);
    expect(page).toContain('thirteen third-party collections');
    expect(page).toContain('Sort by dropdown');
  });

  it('pairs a compact settings preview with the copy and opens the full capture', () => {
    expect(page).not.toContain('<Split');
    expect(page).toContain('grid items-start gap-8 lg:grid-cols-2');
    expect(page).toContain('lg:h-72');
    expect(page).toContain(
      'Over 2300 creatures and 1900 spells in {shippedLibraries.length + libraries.length} libraries.',
    );
    expect(page).not.toContain('Select the image');
    expect(page).toContain('shot-thumb');
    expect(page).toContain('data-index="0"');
    expect(page).toContain('aria-label="View full library settings screenshot"');
    expect(page).toContain('h-64 w-full object-cover');
    expect(page).toContain('<Lightbox shots={[libraryShot]} />');
  });

  it('keeps the shelf count tied to the shared list and explains reference cards', () => {
    expect(page).toContain('{shippedLibraries.length} third-party libraries');
    expect(page).toContain('shippedLibraries.map');
    expect(page).toContain('libraries.map');
    expect(page).toContain('Same-name spells keep each book’s');
    expect(page).toContain('Supported spells use the console’s casting tools');
    expect(page).toContain('For reference-only spells');
    expect(page).toContain('Credits and licenses');
    expect(page).toContain('href="/credits/"');
    expect(page).toContain('href="/docs/reference/compendium/"');
  });
});
