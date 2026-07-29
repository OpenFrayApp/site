// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

// Wraps every markdown table in <div class="table-scroll">.
//
// Without a wrapper the only way to stop a wide table scrolling the whole page is
// `display: block; overflow-x: auto` on the table itself — but a block-level table no
// longer stretches to its container, so `width: 100%` stops filling and every table
// renders shrink-to-fit. The wrapper takes the overflow so the table can stay a real
// table and fill the column.
export default function rehypeTableScroll() {
  return (tree) => {
    /** Recurse the tree, swapping each table for a div.table-scroll that wraps it. */
    const walk = (node) => {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === 'element' && child.tagName === 'table') {
          node.children[i] = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['table-scroll'] },
            children: [child],
          };
        } else {
          walk(child);
        }
      }
    };
    walk(tree);
  };
}
