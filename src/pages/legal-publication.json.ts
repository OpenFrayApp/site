// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { legalDates } from '../data/legalDates';

/** Publish the exact legal dates and Git revision alongside the rendered pages. */
export function GET() {
  return Response.json({
    schemaVersion: 1,
    revision: process.env.CF_PAGES_COMMIT_SHA ?? 'local',
    ...legalDates,
  });
}
