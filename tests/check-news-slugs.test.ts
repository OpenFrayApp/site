// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = resolve(__dirname, '../scripts/check-news-slugs.mjs')
let dir: string

/** Run the slug check in a fixture directory, returning { status, output }. */
function run(cwd: string): { status: number; output: string } {
  try {
    const out = execFileSync('node', [SCRIPT], { cwd, encoding: 'utf8', stdio: 'pipe' })
    return { status: 0, output: out }
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string }
    return { status: err.status, output: `${err.stdout}${err.stderr}` }
  }
}

/** Write a post fixture. `slug` omitted means the file name is the slug. */
function post(name: string, slug?: string): void {
  const posts = join(dir, 'src/content/news')
  mkdirSync(posts, { recursive: true })
  const front = ['---', "title: 'A post'", ...(slug ? [`slug: '${slug}'`] : []), '---', '', 'Body.']
  writeFileSync(join(posts, `${name}.mdx`), front.join('\n'))
}

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('check-news-slugs', () => {
  it('passes posts that fall back to their file names', () => {
    dir = mkdtempSync(join(tmpdir(), 'slugs-'))
    post('openfray-is-in-beta')
    post('the-tithe-barn')
    const { status, output } = run(dir)
    expect(status).toBe(0)
    expect(output).toContain('2 post(s), all distinct and URL-safe')
  })

  it('passes a post that overrides its file name', () => {
    dir = mkdtempSync(join(tmpdir(), 'slugs-'))
    post('2026-07-31-openfray-is-in-beta', 'beta')
    const { status } = run(dir)
    expect(status).toBe(0)
  })

  it('fails when two posts claim one slug', () => {
    // The loader keys the collection on the slug, so a collision drops a post from the
    // site with only a warning. That is the whole reason this check exists.
    dir = mkdtempSync(join(tmpdir(), 'slugs-'))
    post('the-tithe-barn')
    post('openfray-is-in-beta', 'the-tithe-barn')
    const { status, output } = run(dir)
    expect(status).toBe(1)
    expect(output).toContain('already taken by')
    expect(output).toContain('silently disappear')
  })

  it('fails when a post collides with another post’s file name', () => {
    dir = mkdtempSync(join(tmpdir(), 'slugs-'))
    post('beta')
    post('release-notes', 'beta')
    expect(run(dir).status).toBe(1)
  })

  it('fails on a slug that would build a broken URL', () => {
    // "Hello World!" builds a directory with a space and an exclamation mark in it, and
    // Astro reports nothing at all.
    dir = mkdtempSync(join(tmpdir(), 'slugs-'))
    post('a-post', 'Hello World!')
    const { status, output } = run(dir)
    expect(status).toBe(1)
    expect(output).toContain('not URL-safe')
  })

  it('rejects the shapes that look plausible but are not kebab-case', () => {
    for (const slug of ['Beta', 'beta_notes', 'beta--notes', '-beta', 'beta-']) {
      dir = mkdtempSync(join(tmpdir(), 'slugs-'))
      post('a-post', slug)
      expect(run(dir).status, `"${slug}" should be rejected`).toBe(1)
      rmSync(dir, { recursive: true, force: true })
    }
    dir = mkdtempSync(join(tmpdir(), 'slugs-'))
  })

  it('catches an unsafe file name too, not only an unsafe slug', () => {
    dir = mkdtempSync(join(tmpdir(), 'slugs-'))
    post('Draft Post')
    const { status, output } = run(dir)
    expect(status).toBe(1)
    expect(output).toContain('file name')
  })

  it('is happy with no posts at all', () => {
    dir = mkdtempSync(join(tmpdir(), 'slugs-'))
    mkdirSync(join(dir, 'src/content/news'), { recursive: true })
    expect(run(dir).status).toBe(0)
  })
})
