// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

// Opens off-site links in a new tab, matching how the footer's links already behave.
// `rel="noreferrer"` also implies noopener, so the new tab gets no handle on this one.
// Internal links (/docs/, /console/, #anchors) are left alone — sending a reader to a
// new tab inside the same site is just disorienting.
const EXTERNAL = /^https?:\/\//i;
const SITE = /^https?:\/\/(www\.)?openfray\.app/i;

export default function rehypeExternalLinks() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      for (const child of node.children) {
        if (child.type === 'element' && child.tagName === 'a') {
          const href = child.properties?.href ?? '';
          if (EXTERNAL.test(href) && !SITE.test(href)) {
            child.properties.target = '_blank';
            child.properties.rel = 'noreferrer';
          }
        }
        walk(child);
      }
    };
    walk(tree);
  };
}
