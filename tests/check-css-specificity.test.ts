// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = resolve(__dirname, '../scripts/check-css-specificity.mjs')
let dir: string

/** Run the specificity check in a fixture directory, returning { status, output }. */
function run(cwd: string): { status: number; output: string } {
  try {
    const out = execFileSync('node', [SCRIPT], { cwd, encoding: 'utf8', stdio: 'pipe' })
    return { status: 0, output: out }
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string }
    return { status: err.status, output: `${err.stdout}${err.stderr}` }
  }
}

/** Create every stylesheet fixture the script reads. All of them, always: the script
 *  reads a fixed list, so a fixture missing one fails on ENOENT rather than on the
 *  rule under test. */
function styles(global: string, book = '', news = ''): void {
  const stylesDir = join(dir, 'src/styles')
  mkdirSync(stylesDir, { recursive: true })
  writeFileSync(join(stylesDir, 'global.css'), global)
  writeFileSync(join(stylesDir, 'book.css'), book)
  writeFileSync(join(stylesDir, 'news.css'), news)
}

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('check-css-specificity', () => {
  it('passes prose defaults wrapped in :where()', () => {
    dir = mkdtempSync(join(tmpdir(), 'css-'))
    styles(':where(.doc) :where(h2) { margin-top: 2rem; }')
    const { status, output } = run(dir)
    expect(status).toBe(0)
    expect(output).toContain('no specificity')
  })

  it('fails a plain descendant prose rule that would out-rank component classes', () => {
    dir = mkdtempSync(join(tmpdir(), 'css-'))
    styles('.book-body h3 { color: red; }')
    const { status, output } = run(dir)
    expect(status).toBe(1)
    expect(output).toContain('.book-body h3')
  })

  it('allows a rule whose tail is a class — that is a deliberate override', () => {
    dir = mkdtempSync(join(tmpdir(), 'css-'))
    styles('.doc .callout { border: 1px solid; }\n.doc { padding: 1rem; }')
    const { status } = run(dir)
    expect(status).toBe(0)
  })

  it('ignores selectors inside comments', () => {
    dir = mkdtempSync(join(tmpdir(), 'css-'))
    styles('/* .doc h2 { would-be-bad } */ :where(.doc) :where(p) { margin: 0; }')
    const { status } = run(dir)
    expect(status).toBe(0)
  })

  it('checks the book stylesheet too', () => {
    dir = mkdtempSync(join(tmpdir(), 'css-'))
    styles(':where(.doc) :where(p) { margin: 0; }', '.book-body td { padding: 0; }')
    const { status, output } = run(dir)
    expect(status).toBe(1)
    expect(output).toContain('book.css')
  })

  it('checks the news stylesheet, and its container', () => {
    dir = mkdtempSync(join(tmpdir(), 'css-'))
    styles(':where(.doc) :where(p) { margin: 0; }', '', '.post-body h2 { font-size: 2rem; }')
    const { status, output } = run(dir)
    expect(status).toBe(1)
    expect(output).toContain('news.css')
    expect(output).toContain('.post-body h2')
  })
})
