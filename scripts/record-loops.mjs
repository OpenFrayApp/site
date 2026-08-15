// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Record the site's marketing loops against a running console. One take stages a
// small fight through the real UI (the spells are actually cast, so every badge on
// screen has a cause), then performs each choreographed moment; the timestamps and
// dialog boxes it prints are what scripts/cut-loops.sh trims and crops with.
//
//   node scripts/record-loops.mjs [console-url] [out-dir]
//
// Defaults: http://localhost:5199/console/ and screenshots/out. The raw take lands
// as loops-raw.webm beside a loops-marks.json describing the segments.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPlaywright } from './lib/playwright.mjs';

const url = process.argv[2] ?? 'http://localhost:5199/console/';
const outDir = process.argv[3] ?? 'screenshots/out';

const VIEWPORT = { width: 1440, height: 900 };

/** The cast, small on purpose: the two spellcasters the badges need, the target, and
 *  the Ogre whose swing is the show. */
const PARTY = [
  { name: 'Elowen Vale', ac: 12, hp: 22, init: 3 },
  { name: 'Bram Ironfist', ac: 18, hp: 34, init: 1 },
  { name: 'Sister Mirad', ac: 18, hp: 27, init: 0 },
];
const ROLLS = [
  { who: 'Elowen Vale', roll: 23 },
  { who: 'Bram Ironfist', roll: 19 },
  { who: 'Sister Mirad', roll: 2 },
  { who: 'Ogre', roll: 14 },
];

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir: outDir, size: VIEWPORT },
});
const page = await context.newPage();
const t0 = Date.now();
const at = () => (Date.now() - t0) / 1000;
const marks = {};

await page.goto(url);
await page.getByText('Add creature').first().waitFor();
await page.waitForTimeout(600);

// A visible cursor, or the recording reads as a slideshow: a dot follows the mouse
// and pulses on press, and the loops move to their targets in eased steps.
await page.evaluate(() => {
  const dot = document.createElement('div');
  dot.id = 'fake-cursor';
  dot.style.cssText =
    'position:fixed;z-index:999999;width:16px;height:16px;border-radius:50%;' +
    'pointer-events:none;left:0;top:0;transform:translate(-50%,-50%);' +
    'background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.95);' +
    'box-shadow:0 1px 6px rgb(0 0 0/.6);transition:scale .12s ease';
  document.body.append(dot);
  addEventListener('mousemove', (e) => {
    dot.style.left = `${e.clientX}px`;
    dot.style.top = `${e.clientY}px`;
  });
  addEventListener('mousedown', () => (dot.style.scale = '0.65'));
  addEventListener('mouseup', () => (dot.style.scale = '1'));
});

/** Click the way a hand does: glide to the target, settle, press. For the recorded
 *  moments only — the staging before them is trimmed away and clicks plainly. */
async function clickLike(locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 32 });
  await page.waitForTimeout(260);
  await page.mouse.down();
  await page.waitForTimeout(110);
  await page.mouse.up();
}

/** One player character through the Add PC popover. */
async function addPc({ name, ac, hp, init }) {
  await page.getByRole('button', { name: 'Add PC', exact: true }).click();
  await page.getByLabel('PC name').fill(name);
  await page.getByLabel('AC', { exact: true }).fill(String(ac));
  await page.getByLabel('Max HP').fill(String(hp));
  await page.getByLabel('Initiative modifier').fill(String(init));
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(150);
}

/** One creature from the compendium, anchored to the start of the result name. */
async function addCreature(name) {
  await page.getByRole('button', { name: 'Add creature', exact: true }).click();
  await page.getByPlaceholder('Search creatures…').fill(name);
  await page.waitForTimeout(400);
  await page
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .first()
    .click();
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

/** The last open dialog, where every casting and rolling control lives. */
const dialog = () => page.locator('[role=dialog]').last();

/** Cast a single-target spell from the active combatant and apply its failed save. */
async function cast(spell, target) {
  await page.getByRole('button', { name: 'Cast spell' }).click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder('Search spells…').fill(spell);
  await page.waitForTimeout(400);
  // The result buttons sit outside the dialog role, like the shotlist macro finds them.
  await page
    .getByRole('button', { name: new RegExp(`^${spell}`) })
    .first()
    .click();
  await page.waitForTimeout(700);
  await dialog().getByRole('button', { name: target }).first().click();
  await page.waitForTimeout(200);
  await dialog().getByRole('button', { name: 'Roll saves' }).click();
  await page.waitForTimeout(1000);
  const fail = dialog().getByRole('button', { name: 'Fail', exact: true });
  if (await fail.count()) await fail.first().click();
  await page.waitForTimeout(250);
  await dialog()
    .getByRole('button', { name: new RegExp(`^Apply ${spell}`) })
    .click();
  await page.waitForTimeout(400);
  const close = dialog().getByRole('button', { name: 'Close' });
  if (await close.count()) await close.click();
  await page.waitForTimeout(300);
}

/** Advance the turn. */
async function next() {
  await page.getByRole('button', { name: 'Next turn' }).click();
  await page.waitForTimeout(250);
}

// ── Stage ──────────────────────────────────────────────────────────────────
for (const pc of PARTY) await addPc(pc);
await addCreature('Ogre');

await page.getByRole('button', { name: 'Begin' }).click();
await page.getByText('Roll initiative').waitFor();
for (const { who, roll } of ROLLS) {
  const field = page.getByLabel(`Initiative for ${who}`);
  if (await field.count()) await field.fill(String(roll));
}
await page.getByRole('button', { name: 'Start combat' }).click();
await page.waitForTimeout(500);

// Round 1. Elowen: Faerie Fire on the Ogre.
await cast('Faerie Fire', 'Ogre');
await next();

// Bram: the shove — Prone through the Apply effect box.
await page.getByText('Ogre', { exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Apply effect' }).click();
await page.waitForTimeout(400);
const box = dialog();
await box.getByRole('button', { name: 'Prone', exact: true }).click();
await box.getByRole('button', { name: 'Apply', exact: true }).click();
await page.waitForTimeout(300);
await next();

// The Ogre holds; Sister Mirad: Bane on it.
await next();
await cast('Bane', 'Ogre');
await next();

// Round 2: the party waits — the loops are the Ogre's turn.
await next();
await next();
await page.waitForTimeout(800);

// ── Loop A: the swing ──────────────────────────────────────────────────────
// Park the cursor mid-board so the loop opens with it gliding to the action line.
await page.mouse.move(720, 620, { steps: 20 });
await page.waitForTimeout(400);
marks.swingStart = at();
await clickLike(page.getByText('Greatclub.', { exact: false }).first());
await page.waitForTimeout(900);
await clickLike(dialog().getByRole('button', { name: 'Bram Ironfist' }).first());
await page.waitForTimeout(700);
await clickLike(dialog().getByRole('button', { name: 'Roll attack' }));
await page.waitForTimeout(1200);
marks.swingDialog = await dialog().boundingBox();
await page.waitForTimeout(2600);
marks.swingEnd = at();
const close = dialog().getByRole('button', { name: 'Close' });
if (await close.count()) await close.click();
await page.waitForTimeout(600);

// ── Loop B: the concentration prompt ───────────────────────────────────────
// Elowen holds Faerie Fire; damage lands on her, the board offers the check, and
// one click answers it. The check is not a dialog: it lands inline in the controls
// rail and blocks nothing — which is the point the loop makes.
marks.concStart = at();
const row = page
  .locator('li, div')
  .filter({ hasText: 'Elowen Vale' })
  .filter({ hasText: /AC\s*\d/ })
  .last();
const hp = row.locator('button:not([aria-label])').filter({ hasText: /^\d+$/ }).first();
await hp.click();
await page.waitForTimeout(400);
await page.keyboard.press('ControlOrMeta+a');
await page.keyboard.type('12', { delay: 90 });
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
await page.waitForTimeout(2200);
await clickLike(page.getByRole('button', { name: 'Maintained' }));
await page.waitForTimeout(1600);
marks.concEnd = at();
marks.total = at();

await context.close();
const video = await page.video().path();
await browser.close();

writeFileSync(join(outDir, 'loops-marks.json'), JSON.stringify({ video, ...marks }, null, 2));
console.log(video);
console.log(JSON.stringify(marks, null, 2));
