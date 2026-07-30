// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors
// @vitest-environment node
// Node, not jsdom: this reads the layout and the stylesheet as text. The behaviour
// itself is exercised in a real browser, where `data-show` and the scroll threshold
// can actually run.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layout = readFileSync(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

// `.to-top` is a script hook as well as a style hook: dropping it leaves every computed
// style identical and silently kills the control, which measurement cannot catch.

describe('back to top', () => {
  it('is an anchor to #top, so it works with no JavaScript', () => {
    expect(layout).toMatch(/class="to-top[^"]*"/);
    expect(layout).toMatch(/href="#top"/);
    expect(layout).toMatch(/aria-label="Back to top"/);
  });

  it('has a target to land on', () => {
    expect(layout).toMatch(/id="top"/);
  });

  it('keeps the script hook the reveal depends on', () => {
    expect(layout).toContain("document.querySelector('.to-top')");
    expect(layout).toContain("toggleAttribute('data-show'");
  });

  it('leaves smooth scrolling to readers who have not asked for less motion', () => {
    expect(layout).toContain('prefers-reduced-motion: reduce');
  });

  it('hides by default and shows on data-show, from the stylesheet', () => {
    // Two utilities for one property resolve by Tailwind's output order, so the two
    // states live in one layer where specificity decides. See AGENTS.md.
    expect(css).toMatch(/\.to-top\s*\{[^}]*visibility:\s*hidden/);
    expect(css).toMatch(/\.to-top\[data-show\]\s*\{[^}]*visibility:\s*visible/);
  });

  it('stays off the page when a reader prints one', () => {
    expect(layout).toMatch(/class="to-top[^"]*print:hidden/);
  });
});
