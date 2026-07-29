// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { getViteConfig } from 'astro/config';

// getViteConfig loads astro.config.mjs, so .astro components resolve and render
// in tests via the experimental Container API.
export default getViteConfig({
  test: {
    // DOM transforms and component markup need a document; jsdom throughout.
    environment: 'jsdom',
  },
});
