#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Nicola Mustone

# Keep the full library list and sort control, trimming the viewport-height wrapper.
set -euo pipefail
cd "$(dirname "$0")"

magick out/library-toggles.png -crop 1080x1860+0+0 +repage \
  ../src/assets/screenshots/library-toggles.png
