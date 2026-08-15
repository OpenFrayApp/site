#!/bin/bash
# Cut the site's vignettes from the shot heroes in out/, into the site's assets. Run
# after re-shooting console-hero and apply-effect-hero; each crop is a region of its
# source, so the vignettes always match the full screenshots they open into. Boxes
# are in source pixels (heroes are shot at 2x).
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
SITE=../src/assets/screenshots

# From console-hero.png (3600x2000): the tracker column, the log rail, the lone
# Greatclub entry the pages narrate, and the applied-effects panel whose rows carry
# their durations.
# Three rows only, the chip-carrying Ogre framed by two bare neighbors: the crop is
# evidence for one claim, and wider than tall so it can sit beside prose.
magick "$OUT/console-hero.png" -crop 880x388+40+648 +repage "$SITE/console-rows.png"
magick "$OUT/console-hero.png" -crop 780x994+2800+872 +repage "$SITE/console-log.png"
magick "$OUT/console-hero.png" -crop 764x290+2798+930 +repage "$SITE/greatclub-log.png"
magick "$OUT/console-hero.png" -crop 780x452+2790+380 +repage "$SITE/applied-effects.png"

# From group-save-hero.png (3600x2000): the dice chip and the six outcome rows —
# full damage, halves, the immune zero, the resisted quarter, and the player rows
# waiting for real dice. From cast-spell-hero.png: the spell card alone, uses
# counted, Cast button included.
# The rows crop stays inside the dialog and pads with the dialog's own background,
# right side widest, so the damage inputs get air without dragging the console in.
BG=$(magick "$OUT/group-save-hero.png" -format '%[pixel:p{1300,1000}]' info:)
magick "$OUT/group-save-hero.png" -crop 1330x500+1136+820 +repage \
  -bordercolor "$BG" -border 24 -background "$BG" -gravity East -splice 40x0 \
  "$SITE/save-rows.png"
magick "$OUT/cast-spell-hero.png" -crop 1374x1036+1124+481 +repage "$SITE/spell-card.png"

# From the two player-view shots (2160x1560): the foes as each disclosure level
# shows them — the same rows in words and in exact numbers — and the log as the
# table receives it, entries without dice. The player-view page's tabs compare them.
PVBG=$(magick "$OUT/player-view-hero.png" -format '%[pixel:p{40,1400}]' info:)
magick "$OUT/player-view-hero.png" -crop 990x424+78+664 +repage \
  -bordercolor "$PVBG" -border 20 "$SITE/pv-words.png"
magick "$OUT/player-view-exact.png" -crop 990x424+78+664 +repage \
  -bordercolor "$PVBG" -border 20 "$SITE/pv-exact.png"
magick "$OUT/player-view-hero.png" -crop 990x586+1092+224 +repage \
  -bordercolor "$PVBG" -border 20 "$SITE/pv-log.png"

# The Settings clip rides a viewport-tall wrapper; trim it to the dialog itself.
magick "$OUT/library-toggles.png" -crop 1080x1360+0+0 +repage "$SITE/library-toggles.png"

# From apply-effect-hero.png (1080x1910, already clipped to the modal): its four
# zones, in the order the page tells them.
magick "$OUT/apply-effect-hero.png" -crop 1020x245+30+375 +repage "$SITE/apply-conditions.png"
magick "$OUT/apply-effect-hero.png" -crop 990x290+45+1160 +repage "$SITE/apply-modifier.png"
magick "$OUT/apply-effect-hero.png" -crop 1020x215+30+876 +repage "$SITE/apply-counter.png"
magick "$OUT/apply-effect-hero.png" -crop 1020x175+30+1572 +repage "$SITE/apply-name.png"

echo "vignettes recut into $SITE"
