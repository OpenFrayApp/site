// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Guards the one CSS mistake this site keeps making.
//
// A prose container rule written as a plain descendant selector — `.book-body h3`,
// `.doc ul` — has specificity (0,1,1). A component's own class — `.sb-name`,
// `.book-contents` — has (0,1,0). So the prose rule silently wins inside any component
// nested in the prose, and the component loses a property it looked like it had set.
// That produced seven separate bugs before it was understood: a CTA with an unreadable
// label, two lists indented, a sidebar whose nesting rendered inverted, a stat block
// with 1.9rem of phantom padding, blue creature names, and white-on-blue links.
//
// The fix is to wrap prose defaults in :where(), which drops them to zero specificity so
// any component rule wins. This check fails the build if one is written the old way.
//
// If you need a rule that really should beat components, give it a class of its own
// rather than relying on a descendant selector's accidental weight.
import { readFileSync } from 'node:fs';

const FILES = ['src/styles/global.css', 'src/styles/book.css', 'src/styles/news.css'];
const CONTAINERS = ['.book-body', '.doc', '.post-body', '.book-sidebar', '.hero'];

const problems = [];

for (const file of FILES) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/([^{}]+)\{/g)) {
    const selector = match[1].replace(/\s+/g, ' ').trim();
    for (const part of selector.split(',')) {
      const sel = part.trim();
      if (!CONTAINERS.some((c) => sel.startsWith(c))) continue;
      if (sel.includes(':where(')) continue;
      const tokens = sel.split(' ');
      const tail = tokens.at(-1);
      // A bare type selector at the end — no class, no id, no attribute.
      if (tokens.length > 1 && /^[a-z][a-z0-9]*$/.test(tail)) {
        problems.push(`${file}: ${sel}`);
      }
    }
  }
}

if (problems.length) {
  console.error(
    `\nPlain descendant prose rules that out-rank component classes (${problems.length}):\n`,
  );
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nWrap them: `.doc h2 {` becomes `:where(.doc) :where(h2) {`.\n');
  process.exit(1);
}

console.log('CSS specificity check: prose defaults carry no specificity.');
