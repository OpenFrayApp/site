// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { createClient } from '@supabase/supabase-js';
import { accountSessionAdapter, registerAccountSessionAdapter } from '../account/signOut.ts';

/** Create the compatible browser session consumer without accepting URL tokens automatically. */
export function createSiteClient(url: string | undefined, anonKey: string | undefined) {
  if (!url || !anonKey) throw new Error('Sign-in is not configured');
  try {
    window.localStorage.setItem('openfray-auth-storage-check', '');
    window.localStorage.removeItem('openfray-auth-storage-check');
  } catch {
    throw new Error('Browser storage is unavailable');
  }
  const adapter = accountSessionAdapter(url, window.localStorage);
  const client = createClient(url, anonKey, {
    global: { fetch: adapter.fetch },
    auth: {
      // Bypass the SDK's quota probe and memory fallback so session write failures propagate.
      storage: adapter.storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  });
  registerAccountSessionAdapter(client, adapter);
  return client;
}

/** Preserve the auth-only factory contract used by OAuth callers. */
export function createSiteAuth(url: string | undefined, anonKey: string | undefined) {
  return createSiteClient(url, anonKey).auth;
}

let client: ReturnType<typeof createSiteClient> | undefined;

/** Lazily initialize the site client from public build-time configuration. */
export function getSiteClient() {
  client ??= createSiteClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
  return client;
}

/** Return the shared client’s auth interface without creating another session consumer. */
export function getSiteAuth() {
  return getSiteClient().auth;
}
