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

# From apply-effect-hero.png (1080x1910, already clipped to the modal): its four
# zones, in the order the page tells them.
magick "$OUT/apply-effect-hero.png" -crop 1020x245+30+375 +repage "$SITE/apply-conditions.png"
magick "$OUT/apply-effect-hero.png" -crop 990x290+45+1160 +repage "$SITE/apply-modifier.png"
magick "$OUT/apply-effect-hero.png" -crop 1020x215+30+876 +repage "$SITE/apply-counter.png"
magick "$OUT/apply-effect-hero.png" -crop 1020x175+30+1572 +repage "$SITE/apply-name.png"

echo "vignettes recut into $SITE"
