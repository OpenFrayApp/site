// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Playwright is not a project dependency (its postinstall downloads browsers, which
// would slow every Pages build); it is resolved from an npx/global cache at run time
// and drives the locally installed Chrome. `npx --yes playwright --version` seeds the
// cache when it is missing.
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Resolve the playwright module from the npx cache (or a real install), or exit with the seed command. */
export function loadPlaywright() {
  const require = createRequire(import.meta.url)
  const candidates = ['playwright']
  const npx = join(homedir(), '.npm', '_npx')
  try {
    for (const dir of readdirSync(npx)) {
      candidates.push(join(npx, dir, 'node_modules', 'playwright'))
    }
  } catch {
    // No npx cache — fall through to the plain require attempts.
  }
  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch {
      // Try the next location.
    }
  }
  console.error('Playwright not found. Seed the npx cache once with:')
  console.error('  npx --yes playwright --version')
  process.exit(1)
}
