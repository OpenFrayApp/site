// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Snapshots the browser's used values so a CSS change can be verified by measurement —
// every regression worth catching on the site has been invisible to the eye and obvious
// in the numbers (see AGENTS.md, "How the site is styled"). qain captures and diffs; this
// wraps it in the two things its CLI cannot do here: force the site's localStorage theme,
// and wait for the page to settle.
//
//   node scripts/measure-css.mjs snapshot <url> <out.json> [options]
//     --theme light|dark          force the theme before any page script runs
//     --states hover,focus        also capture these pseudo-states
//     --wait-for <css>            wait for this selector before capturing
//     --wait <ms>                 extra settle time after fonts load
//     --replay                    record text rectangles, for `diff --replay`
//     --no-rules                  skip rule capture (faster, no file:line causes)
//
// A page is captured after `load`, `--wait-for`, `document.fonts.ready` and `--wait`, in
// that order — what `qain snap` waits for. Anything that streams in later needs one of
// the two flags; neither this nor qain guesses.
//
//   node scripts/measure-css.mjs diff <before.json> <after.json> [options]
//     --omit-derived              only the causes, not what merely moved
//     --html <file>               also write a standalone report
//     --replay <file>             also write a before/after fade, if both carry --replay
//
// Snapshot before the change, snapshot after, diff. `diff` exits non-zero when anything
// moved, so it chains with &&. The files are plain qain snapshots — `npx @qain/cli diff`
// reads them too.
import { readFileSync, writeFileSync } from 'node:fs'
import {
  capture,
  diff as diffSnapshots,
  formatHtml,
  formatText,
  renderReplayDiff,
} from '@qain/core'
import { loadPlaywright } from './lib/playwright.mjs'

const VIEWPORT = { width: 1280, height: 900 }

/** Read `--flag value` and bare `--flag` pairs out of an argument list. */
function parseFlags(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const next = argv[i + 1]
    flags[argv[i].slice(2)] = next && !next.startsWith('--') ? next : true
  }
  return flags
}

/** Capture a settled page as a qain snapshot, with the site's theme forced if asked. */
async function snapshot(url, outFile, flags) {
  const { chromium } = loadPlaywright()
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: VIEWPORT })
  if (typeof flags.theme === 'string') {
    await page.addInitScript((theme) => localStorage.setItem('openfray-theme', theme), flags.theme)
  }
  await page.goto(url, { waitUntil: 'load' })
  if (typeof flags['wait-for'] === 'string') await page.waitForSelector(flags['wait-for'])
  await page.evaluate(() => document.fonts.ready)
  if (typeof flags.wait === 'string') await page.waitForTimeout(Number(flags.wait))

  const session = await page.context().newCDPSession(page)
  const snap = await capture(session, {
    rules: flags['no-rules'] !== true,
    replay: flags.replay === true,
    states: typeof flags.states === 'string' ? flags.states.split(',') : [],
  })
  await browser.close()

  writeFileSync(outFile, JSON.stringify(snap))
  for (const warning of snap.warnings) console.warn(`qain: ${warning}`)
  const nodes = snap.states[0]?.nodes.length ?? 0
  const states = snap.states.map((state) => state.state).join(', ')
  console.log(`Measured ${nodes} elements on ${url} (${states}) → ${outFile}`)
}

/** Compare two snapshots, print the report, and exit non-zero when anything changed. */
function diff(beforeFile, afterFile, flags) {
  const before = JSON.parse(readFileSync(beforeFile, 'utf8'))
  const after = JSON.parse(readFileSync(afterFile, 'utf8'))
  const result = diffSnapshots(before, after, { omitDerived: flags['omit-derived'] === true })

  if (typeof flags.html === 'string') writeFileSync(flags.html, formatHtml(result))
  if (typeof flags.replay === 'string') {
    writeFileSync(flags.replay, renderReplayDiff(before, after, result))
  }

  if (result.changes.length === 0) {
    console.log('No computed-style changes.')
    return
  }
  console.log(formatText(result, { color: Boolean(process.stdout.isTTY) }))
  process.exitCode = 1
}

const [mode, a, b] = process.argv.slice(2)
const flags = parseFlags(process.argv.slice(5))
if (mode === 'snapshot' && a && b) {
  await snapshot(a, b, flags)
} else if (mode === 'diff' && a && b) {
  diff(a, b, flags)
} else {
  console.error('Usage: measure-css.mjs snapshot <url> <out.json> [--theme light|dark]')
  console.error('                                                 [--states hover,focus]')
  console.error('                                                 [--wait-for <css>] [--wait <ms>]')
  console.error('                                                 [--replay] [--no-rules]')
  console.error('       measure-css.mjs diff <before.json> <after.json> [--omit-derived]')
  console.error('                                                       [--html <file>]')
  console.error('                                                       [--replay <file>]')
  process.exit(1)
}
