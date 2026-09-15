// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { fragmentId } from './fragment.ts';

/** Open the stat-block fold inside the current fragment target. */
function openTargetedStatBlock(root: Document) {
  const hash = root.defaultView?.location.hash;
  if (!hash) return;

  const target = root.getElementById(fragmentId(hash));
  const fold = target?.querySelector<HTMLDetailsElement>('.statblock details');
  if (fold) fold.open = true;
}

/** Open a stat block for the initial fragment and each later fragment change. */
export function setupTargetedStatBlock(root: Document = document) {
  openTargetedStatBlock(root);
  root.defaultView?.addEventListener('hashchange', () => openTargetedStatBlock(root));
}
