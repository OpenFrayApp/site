// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Verifies the print edition paginates: opens /the-waking-garden/print/ in headless
// Chrome, waits for Paged.js to finish, and reports pages and reference resolution.
// Start the site dev server first (`npm run dev -w site`), then:
//
//   node scripts/print-check.mjs [url]
//
// Exits non-zero on a pagination failure, a timeout, an unresolved reference, or a
// word-map warning — so it can gate a change to the book or the site's styles.
import { loadPlaywright } from './lib/playwright.mjs'

const url = process.argv[2] ?? 'http://localhost:4321/the-waking-garden/print/'
const TIMEOUT_MS = 180_000

const { chromium } = loadPlaywright()
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()

const warnings = []
page.on('console', (message) => {
  const text = message.text()
  if (/^Print:/.test(text)) warnings.push(text)
  if (message.type() === 'info' && /^Paged\.js:/.test(text)) console.log(text)
})

await page.goto(url, { waitUntil: 'load' })

let timedOut = false
try {
  // print.astro sets dataset.pages when pagination completes (or 'failed' on a throw).
  await page.waitForFunction(() => document.body.dataset.pages != null, null, {
    timeout: TIMEOUT_MS,
  })
} catch {
  timedOut = true
}
const pages = await page.evaluate(() => document.body.dataset.pages)
await browser.close()

if (timedOut) {
  console.error(`Print check: pagination did not finish within ${TIMEOUT_MS / 1000}s.`)
  process.exit(1)
}
if (pages === 'failed') {
  console.error('Print check: Paged.js threw — open the page in a browser for the error.')
  process.exit(1)
}
for (const warning of warnings) console.error(warning)
if (warnings.length > 0) process.exit(1)

console.log(`Print check: ${pages} pages, no warnings.`)
