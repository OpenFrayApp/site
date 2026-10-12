// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

/** Validate and canonicalize a root-relative return without allowing auth loops. */
export function validateReturnTo(value: string | null, origin: string): string {
  const fallback = '/account/';
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (/%(?![\da-f]{2})/i.test(value)) return fallback;
  try {
    let decoded = value;
    do {
      if (/[\\\x00-\x1f\x7f]/.test(decoded) || /%(?:2f|5c|0[\da-f]|1[\da-f]|7f)/i.test(decoded))
        return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded || !/%[\da-f]{2}/i.test(next)) break;
      decoded = next;
    } while (true);
    const url = new URL(value, origin);
    if (url.origin !== origin || url.username || url.password) return fallback;
    const pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase();
    if (['/sign-in', '/sign-up', '/auth/callback'].includes(pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
