// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { createMarkdownProcessor } from '@astrojs/markdown-remark';

// Compendium strings carry markdown — a stat block's Graft table, a bulleted trait, a
// spell's "Using a Higher-Level Spell Slot" subhead. Rendering them through Astro's own
// pipeline (the one behind .md pages, GFM tables included) keeps these pages matching how
// the console renders the same strings, without a second markdown dependency.

let processor: Awaited<ReturnType<typeof createMarkdownProcessor>> | undefined;

/** Render a markdown string to HTML with the shared processor, built once per build. */
export async function renderMarkdown(markdown: string): Promise<string> {
  processor ??= await createMarkdownProcessor({});
  const { code } = await processor.render(markdown);
  return code;
}
