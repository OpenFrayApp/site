// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Record one of the site's marketing loops against a running console. A take stages
// a small fight through the real UI (the spells are actually cast, so every badge on
// screen has a cause), then films its scene's choreographed moment; the timestamps
// it prints are what scripts/cut-loops.mjs trims with.
//
//   node scripts/record-loops.mjs [console-url] [out-dir] [scene]
//
// Scenes: `swing` (the Ogre's Baned, disadvantaged Greatclub — the tracking hero)
// and `group-save` (the Mage's Fireball at six targets — the rolling hero). Marks
// land beside the take as loops-<scene>-marks.json.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPlaywright } from './lib/playwright.mjs';

const url = process.argv[2] ?? 'http://localhost:5199/console/';
const outDir = process.argv[3] ?? 'screenshots/out';
const scene = process.argv[4] ?? 'swing';
if (!['swing', 'group-save', 'share-link'].includes(scene)) {
  console.error(`Unknown scene: ${scene}`);
  process.exit(1);
}

const VIEWPORT = { width: 1440, height: 900 };

/** The party, small on purpose; each scene brings the foes its moment needs. */
const PARTY = [
  { name: 'Elowen Vale', ac: 12, hp: 22, init: 3 },
  { name: 'Bram Ironfist', ac: 18, hp: 34, init: 1 },
  { name: 'Sister Mirad', ac: 18, hp: 27, init: 0 },
];
const FOES = {
  swing: ['Ogre'],
  'group-save': ['Mage', 'Ogre', 'Hell Hound', 'Quasit', 'Goblin Warrior'],
  'share-link': ['Ogre', 'Quasit'],
};
const ROLLS = [
  { who: 'Elowen Vale', roll: 23 },
  { who: 'Bram Ironfist', roll: 19 },
  { who: 'Sister Mirad', roll: 2 },
  { who: 'Mage', roll: 17 },
  { who: 'Ogre', roll: 14 },
  { who: 'Hell Hound', roll: 11 },
  { who: 'Quasit', roll: 8 },
  { who: 'Goblin Warrior', roll: 5 },
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
for (const foe of FOES[scene]) await addCreature(foe);

await page.getByRole('button', { name: 'Begin' }).click();
await page.getByText('Roll initiative').waitFor();
for (const { who, roll } of ROLLS) {
  const field = page.getByLabel(`Initiative for ${who}`);
  if (await field.count()) await field.fill(String(roll));
}
await page.getByRole('button', { name: 'Start combat' }).click();
await page.waitForTimeout(500);

if (scene === 'swing') await filmSwing();
else if (scene === 'group-save') await filmGroupSave();
else await filmShareLink();
marks.total = at();

const video = await page.video().path();
await context.close();
await browser.close();

writeFileSync(
  join(outDir, `loops-${scene}-marks.json`),
  JSON.stringify({ video, ...marks }, null, 2),
);
console.log(video);
console.log(JSON.stringify(marks, null, 2));

/** Type a new hit-point total into a tracker row, the way the set-hp macro does.
 *  The row is the innermost div holding the name, an AC, and the unlabeled bare-digit
 *  HP button — the button's presence is what rules out the stat pane. */
async function setHp(who, hp) {
  const hpButton = page.locator('button:not([aria-label])').filter({ hasText: /^\d+$/ });
  const row = page
    .locator('div')
    .filter({ hasText: who })
    .filter({ hasText: /AC\s*\d/ })
    .filter({ has: hpButton })
    .last();
  await row.locator('button:not([aria-label])').filter({ hasText: /^\d+$/ }).first().click();
  await page.waitForTimeout(250);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(String(hp), { delay: 60 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
}

// ── Sharing, filmed end to end ─────────────────────────────────────────────
// The whole setup, watched: a lived-in board, the camera pushes to the top-right
// share icon, the panel opens, sharing starts, and the GM opens the player view —
// the screen becomes the table's screen. The final beat rides a same-page
// navigation so the transition stays in frame; the rig does not survive it, which
// is fine, because the player view is the one screen with nothing to point at.
async function filmShareLink() {
  // A little damage and a condition, so the shared board is worth looking at.
  await setHp('Ogre', 44);
  await page.getByText('Ogre', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Apply effect' }).click();
  await page.waitForTimeout(300);
  await dialog().getByRole('button', { name: 'Prone', exact: true }).click();
  await dialog().getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForTimeout(400);
  await page.mouse.move(720, 560, { steps: 20 });
  await page.waitForTimeout(400);

  marks.shareStart = at();
  await page.waitForTimeout(1400);
  const icon = page.getByRole('button', { name: 'Share with players' });
  const iconBox = await icon.boundingBox();
  await camera(1.9, iconBox.x, iconBox.y + 40);
  await clickLike(icon);
  await page.waitForTimeout(600);
  // The panel renders without a dialog role, so its own heading and Start button
  // are the anchors: frame their union, scaled so the whole panel stays in shot.
  const startBtn = page.getByRole('button', { name: 'Start sharing' });
  const headBox = await page.getByText('Player view', { exact: true }).first().boundingBox();
  const startBox = await startBtn.boundingBox();
  const left = Math.min(headBox.x, startBox.x) - 40;
  const right = Math.max(headBox.x + headBox.width, startBox.x + startBox.width) + 40;
  const top = headBox.y - 40;
  const bottom = startBox.y + startBox.height + 60;
  const fit = Math.min(1.7, 1440 / (right - left), 900 / (bottom - top));
  await camera(fit, (left + right) / 2, (top + bottom) / 2);
  await clickLike(startBtn);
  await page.waitForTimeout(1400);
  // Pull wide before the jump, so the cut lands full-frame to full-frame.
  await camera(1);
  // The fight lives in the GM's tab and the broadcast dies with it, which is why
  // the panel's own affordance opens a NEW tab. That tab records its own video;
  // the cutter splices the two takes at the click, the way a tab switch looks.
  const playerPromise = context.waitForEvent('page');
  await clickLike(page.getByRole('link', { name: 'Open the player view in a new tab' }));
  marks.shareEnd = at() + 0.4;
  const player = await playerPromise;
  const tOpen = Date.now();
  await player.getByText('Elowen Vale').first().waitFor();
  await player.waitForTimeout(3000);
  marks.playerHoldEnd = (Date.now() - tOpen) / 1000;
  marks.playerVideo = await player.video().path();
}

// ── The swing, filmed ──────────────────────────────────────────────────────
// Stage the badges (Faerie Fire, the shove's Prone, Bane) through two rounds, then
// film: the whole board first, so the fight is the context; the camera pushes into
// the stat block while the swing is rolled and the dialog names what rode it; then
// it pulls back and pushes into the log, where the receipt landed. Starting and
// ending on the full board is what lets the loop seam.
async function filmSwing() {
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

  // Round 2: the party waits — the loop is the Ogre's turn.
  await next();
  await next();
  await page.waitForTimeout(800);

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
}

// ── The group save, filmed ─────────────────────────────────────────────────
// A fresh fight, and the enemy Mage opens it with a Fireball that does not respect
// sides: the whole board, the cast, six targets picked one by one, every save
// rolled at once — then tight on the outcome rows, where immunity zeroes one line,
// resistance halves another, and the player rows wait for real dice. Nothing is
// applied; the decision stays the GM's.
async function filmGroupSave() {
  await page.waitForTimeout(600);
  await page.mouse.move(720, 560, { steps: 20 });
  await page.waitForTimeout(400);
  marks.groupStart = at();
  await page.waitForTimeout(1300);
  await clickLike(page.getByRole('button', { name: 'Cast spell' }));
  await page.waitForTimeout(600);
  await page.getByLabel('Caster').selectOption({ label: 'Mage' });
  await page.waitForTimeout(300);
  await page.getByPlaceholder('Search spells…').fill('Fireball');
  await page.waitForTimeout(500);
  await clickLike(page.getByRole('button', { name: /^Fireball/ }).first());
  await page.waitForTimeout(900);
  await camera(1.5, 720, 450);
  for (const who of [
    'Bram Ironfist',
    'Elowen Vale',
    'Ogre',
    'Hell Hound',
    'Quasit',
    'Goblin Warrior',
  ]) {
    await clickLike(dialog().getByRole('button', { name: who }).first());
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
  await clickLike(dialog().getByRole('button', { name: 'Roll saves' }));
  await page.waitForTimeout(1600);
  // The rolled dice, for the take gate: a fluke where every d20 matches reads as
  // rigged dice on a page selling honest ones.
  marks.groupDice = await dialog()
    .innerText()
    .then((t) => t.match(/\[[\d, ]+\] → \d+/g))
    .catch(() => null);
  // Tight on the outcomes: the immune line is the one worth pointing at.
  const immune = await dialog().getByText('immune').first().boundingBox();
  await camera(2.2, 720, immune.y + 40);
  const immuneNow = await dialog().getByText('immune').first().boundingBox();
  await page.mouse.move(immuneNow.x - 18, immuneNow.y + immuneNow.height / 2, { steps: 22 });
  await page.waitForTimeout(2800);
  await camera(1);
  await page.waitForTimeout(1000);
  marks.groupEnd = at();
}
