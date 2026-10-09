// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

export const legalDates = { terms: '2026-10-08', privacy: '2026-10-08' } as const;

/** Format a normalized legal date independently of the build server's time zone. */
export function legalDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
