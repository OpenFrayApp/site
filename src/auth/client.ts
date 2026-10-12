// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { createClient } from '@supabase/supabase-js';

/** Create the compatible browser session consumer without accepting URL tokens automatically. */
export function createSiteAuth(url: string | undefined, anonKey: string | undefined) {
  if (!url || !anonKey) throw new Error('Sign-in is not configured');
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  }).auth;
}

let auth: ReturnType<typeof createSiteAuth> | undefined;

/** Lazily initialize the site client from public build-time configuration. */
export function getSiteAuth() {
  auth ??= createSiteAuth(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  return auth;
}
