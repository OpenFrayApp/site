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
// The screencast captures at CSS viewport size whatever the device scale, so the
// recording matches the viewport 1:1. The camera's punch-ins stay crisp because the
// browser re-rasters the transformed page live — the zoom is rendered, not scaled
// in post.
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

// Two pieces of film kit. A visible cursor, or the recording reads as a slideshow: a
// dot follows the mouse and pulses on press. And a camera rig: the app is wrapped so
// it can be scaled and panned with an eased transition, while the dot stays outside
// the rig, glued to the real pointer. Element positions move with the transform and
// Playwright reads them post-transform, so interactions keep landing while zoomed.
await page.evaluate(() => {
  const rig = document.createElement('div');
  rig.id = 'camera-rig';
  rig.style.cssText = 'transform-origin:0 0;transition:transform .95s cubic-bezier(.45,0,.25,1)';
  while (document.body.firstChild) rig.append(document.body.firstChild);
  document.body.append(rig);
  document.documentElement.style.overflow = 'hidden';
  // Mid-transition the page's edge can slide into frame; painted console-black, the
  // exposed sliver reads as motion instead of a gray flicker.
  document.documentElement.style.background = '#020617';
  document.body.style.background = '#020617';

  const dot = document.createElement('div');
  dot.id = 'fake-cursor';
  dot.style.cssText =
    'position:fixed;z-index:999999;width:24px;height:24px;border-radius:50%;' +
    'pointer-events:none;left:0;top:0;transform:translate(-50%,-50%);' +
    'background:rgba(255,255,255,.35);border:2.5px solid rgba(255,255,255,.95);' +
    'box-shadow:0 1px 8px rgb(0 0 0/.6);transition:scale .12s ease';
  document.body.append(dot);
  addEventListener('mousemove', (e) => {
    dot.style.left = `${e.clientX}px`;
    dot.style.top = `${e.clientY}px`;
  });
  addEventListener('mousedown', () => (dot.style.scale = '0.65'));
  addEventListener('mouseup', () => (dot.style.scale = '1'));
});

/** Move the camera: center the viewport point (cx, cy) at the given scale, eased,
 *  clamped so the window never slides off the page into black. camera(1) pulls back
 *  to the whole board. */
async function camera(scale, cx = VIEWPORT.width / 2, cy = VIEWPORT.height / 2) {
  const clamp = (v, half, max) => Math.min(Math.max(v, half), max - half);
  cx = clamp(cx, VIEWPORT.width / scale / 2, VIEWPORT.width);
  cy = clamp(cy, VIEWPORT.height / scale / 2, VIEWPORT.height);
  await page.evaluate(
    ({ scale, cx, cy, vw, vh }) => {
      const rig = document.getElementById('camera-rig');
      rig.style.transform =
        scale === 1
          ? 'none'
          : `translate(${vw / 2 - cx * scale}px, ${vh / 2 - cy * scale}px) scale(${scale})`;
    },
    { scale, cx, cy, vw: VIEWPORT.width, vh: VIEWPORT.height },
  );
  await page.waitForTimeout(1100);
}

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

// ── Loop A: the swing, filmed ──────────────────────────────────────────────
// The whole board first, so the fight is the context; then the camera pushes into
// the stat block while the swing is rolled and the dialog names what rode it; then
// it pulls back and pushes into the log, where the receipt landed. Starting and
// ending on the full board is what lets the loop seam.
await page.mouse.move(720, 620, { steps: 20 });
await page.waitForTimeout(400);
marks.swingStart = at();
await page.waitForTimeout(1300);
const club = page.getByText('Greatclub.', { exact: false }).first();
const clubBox = await club.boundingBox();
await camera(1.55, 720, clubBox.y + 30);
await clickLike(club);
await page.waitForTimeout(700);
// The dialog opens centered on the board; re-aim without changing scale, a pan.
await camera(1.55, 720, 450);
await clickLike(dialog().getByRole('button', { name: 'Bram Ironfist' }).first());
await page.waitForTimeout(600);
await clickLike(dialog().getByRole('button', { name: 'Roll attack' }));
await page.waitForTimeout(1400);
// Tight on the roll line itself, aimed at the rendered text rather than a guess: a
// first-time viewer is told where to look — the two dice, the kept one, and Bane
// and Prone named right under them, with the cursor resting beside the causes.
const rollLine = await dialog().getByText('vs AC 18').boundingBox();
marks.swingDice = await dialog()
  .getByText(/\[\d+, \d+\]/)
  .first()
  .textContent()
  .catch(() => null);
await camera(2.7, rollLine.x + rollLine.width / 2 + 40, rollLine.y + 30);
// The causes' box is measured after the camera settles: the dot lives outside the
// rig, so it only aligns with what it points at in post-transform coordinates.
const causes = await dialog().getByText('Prone: disadvantage').boundingBox();
await page.mouse.move(causes.x - 20, causes.y + causes.height / 2, { steps: 22 });
await page.waitForTimeout(2600);
await camera(1);
await clickLike(dialog().getByRole('button', { name: 'Close' }));
await page.waitForTimeout(400);
// The other side: the receipt at the top of the log, the cursor resting beside it.
await camera(2.1, 1240, 290);
await page.mouse.move(1240, 320, { steps: 26 });
await page.waitForTimeout(2400);
await camera(1);
await page.waitForTimeout(900);
marks.swingEnd = at();
marks.total = at();

await context.close();
const video = await page.video().path();
await browser.close();

writeFileSync(join(outDir, 'loops-marks.json'), JSON.stringify({ video, ...marks }, null, 2));
console.log(video);
console.log(JSON.stringify(marks, null, 2));
