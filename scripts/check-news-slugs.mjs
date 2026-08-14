// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Guards the one thing a news post's schema cannot see: two posts claiming one slug.
//
// A post's URL is its `slug` frontmatter, or its file name when it has none. Astro's
// glob loader keys the collection on that, so a collision means one post overwrites the
// other — it drops out of the listing, the feed and the sitemap, and its URL serves the
// other post. The loader logs a warning and the build still succeeds, which on a hosted
// build nobody is watching is the same as no warning at all.
//
// The per-entry schema in src/content.config.ts checks the shape of a slug; only
// something that sees every post at once can check they are distinct. That is this.
import { globSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'

const POSTS = 'src/content/news/*.mdx'
const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The value of a top-level frontmatter field, unquoted. Not a YAML parser: the schema
 *  is the real one, and this needs a single scalar off the front of the file. */
function field(source, name) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!block) return undefined
  const line = block[1].match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
  return line ? line[1].trim().replace(/^['"]|['"]$/g, '') : undefined
}

const problems = []
const claims = new Map()

for (const file of globSync(POSTS).sort()) {
  const source = readFileSync(file, 'utf8')
  const declared = field(source, 'slug')
  const slug = declared ?? basename(file, '.mdx')

  if (!SHAPE.test(slug)) {
    problems.push(
      `${file}\n    ${declared ? 'slug' : 'file name'} "${slug}" is not URL-safe — ` +
        'lowercase letters, digits and single hyphens only.',
    )
    continue
  }

  const claimed = claims.get(slug)
  if (claimed) {
    problems.push(
      `${file}\n    slug "${slug}" is already taken by ${claimed}. ` +
        'One of the two would silently disappear from the site.',
    )
    continue
  }
  claims.set(slug, file)
}

if (problems.length) {
  console.error(`\nNews slug problems (${problems.length}):\n`)
  for (const problem of problems) console.error(`  ${problem}\n`)
  console.error('A post is served at its `slug`, or at its file name when it has none.\n')
  process.exit(1)
}

console.log(`News slug check: ${claims.size} post(s), all distinct and URL-safe.`)
