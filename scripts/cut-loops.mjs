// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Cut the recorded take into the site's marketing loops. Reads the marks
// record-loops.mjs wrote, trims each loop's window, crops it to its subject, and
// encodes mp4 + poster into public/media/.
//
//   node scripts/cut-loops.mjs [marks.json]
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const marksFile = process.argv[2] ?? 'screenshots/out/loops-marks.json';
const marks = JSON.parse(readFileSync(marksFile, 'utf8'));
mkdirSync('public/media', { recursive: true });

/** Even-number a value, which yuv420p requires of every crop edge and size. */
const even = (n) => 2 * Math.round(n / 2);

/** Trim, crop, and encode one loop, with a poster from its held ending. */
function cut(name, { from, to, box }) {
  const filter = `crop=${even(box.w)}:${even(box.h)}:${even(box.x)}:${even(box.y)},format=yuv420p`;
  const args = [
    '-loglevel',
    'error',
    '-y',
    '-ss',
    String(from),
    '-to',
    String(to),
    '-i',
    marks.video,
  ];
  execFileSync('ffmpeg', [
    ...args,
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-preset',
    'slow',
    '-movflags',
    '+faststart',
    '-an',
    `public/media/${name}.mp4`,
  ]);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-ss',
    String(to - 0.4),
    '-i',
    marks.video,
    '-vf',
    filter,
    '-frames:v',
    '1',
    '-q:v',
    '4',
    `public/media/${name}.jpg`,
  ]);
  console.log(`public/media/${name}.mp4`);
}

// The swing: the attack dialog from the Greatclub click to the held result, cropped
// to the dialog the recorder measured, with a halo of backdrop around it.
const d = marks.swingDialog;
cut('roll-with-effects', {
  from: marks.swingStart - 0.2,
  to: marks.swingEnd,
  box: { x: d.x - 16, y: d.y - 16, w: d.width + 32, h: d.height + 32 },
});

// The concentration check: the controls rail and the log's head, where the damage
// entry lands and the DC 10 answer appears. The region is the console's right rail
// at the recorder's 1440x900 viewport.
cut('concentration-prompt', {
  from: marks.concStart + 1.2,
  to: marks.concStart + 8.2,
  box: { x: 1024, y: 76, w: 416, h: 384 },
});
