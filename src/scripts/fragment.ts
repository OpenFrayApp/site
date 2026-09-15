// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

/** Return the decoded target id from a URL fragment. */
export function fragmentId(hash: string) {
  return decodeURIComponent(hash.slice(1));
}
