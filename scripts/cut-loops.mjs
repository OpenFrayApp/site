// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

// Cut the recorded take into the site's marketing loops. Reads the marks
// record-loops.mjs wrote, trims each loop's window, crops it to its subject, and
// encodes mp4 + poster into public/media/.
//
//   node scripts/cut-loops.mjs [marks.json]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const marksFile = process.argv[2] ?? 'screenshots/out/loops-swing-marks.json';
const marks = JSON.parse(readFileSync(marksFile, 'utf8'));
mkdirSync('public/media', { recursive: true });

/** Even-number a value, which yuv420p requires of every crop edge and size. */
const even = (n) => 2 * Math.round(n / 2);

/** Trim, crop to `box` if given, scale to `width`, and encode mp4 + poster. */
function cut(name, { from, to, box, width }) {
  const crop = box ? `crop=${even(box.w)}:${even(box.h)}:${even(box.x)}:${even(box.y)},` : '';
  const filter = `${crop}scale=${even(width)}:-2,format=yuv420p`;
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
  // The poster comes from the cut loop's own tail: seeking the raw take can land
  // past its final frame when a segment ends the recording.
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-sseof',
    '-0.5',
    '-i',
    `public/media/${name}.mp4`,
    '-frames:v',
    '1',
    '-q:v',
    '4',
    '-update',
    '1',
    `public/media/${name}.jpg`,
  ]);
  console.log(`public/media/${name}.mp4`);
}

// The swing, filmed: the whole board, a push into the stat block while the swing is
// rolled with Bane and Prone named under it, a pull back, and a push into the log
// where the receipt landed. The camera moves are in the footage, so no crop.
if (marks.swingStart != null) {
  cut('roll-with-effects', {
    from: marks.swingStart - 0.2,
    to: marks.swingEnd,
    width: 1440,
  });
}

// The group save, filmed: the Mage's Fireball at six targets, every save rolled at
// once, held tight on the outcome rows. Same footage-borne camera, so no crop.
if (marks.groupStart != null) {
  cut('six-saves', {
    from: marks.groupStart - 0.2,
    to: marks.groupEnd,
    width: 1440,
  });
}

// The compendium, filmed: the shelf opens, a search lands, the camera pushes onto
// the badged results, and a stat block fills the pane. Camera in the footage.
if (marks.compStart != null) {
  cut('compendium', {
    from: marks.compStart - 0.2,
    to: marks.compEnd,
    width: 1440,
  });
}

// Sharing, end to end: the board, the push to the share icon, the panel, Start
// sharing — then the cut every tab switch looks like, onto the player view the
// click just opened. Two takes, spliced: the GM page's and the new tab's own.
if (marks.shareStart != null) {
  const enc = (src, from, to, out) =>
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(from),
      '-to',
      String(to),
      '-i',
      src,
      '-vf',
      'scale=1440:-2,format=yuv420p',
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'slow',
      '-an',
      out,
    ]);
  enc(marks.video, marks.shareStart - 0.2, marks.shareEnd, '/tmp/share-a.mp4');
  enc(marks.playerVideo, 0.4, marks.playerHoldEnd, '/tmp/share-b.mp4');
  writeFileSync('/tmp/share-list.txt', "file '/tmp/share-a.mp4'\nfile '/tmp/share-b.mp4'\n");
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    '/tmp/share-list.txt',
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    'public/media/share-link.mp4',
  ]);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-sseof',
    '-0.5',
    '-i',
    'public/media/share-link.mp4',
    '-frames:v',
    '1',
    '-q:v',
    '4',
    '-update',
    '1',
    'public/media/share-link.jpg',
  ]);
  console.log('public/media/share-link.mp4');
}
