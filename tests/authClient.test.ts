// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { afterEach, expect, it, vi } from 'vitest';
import { createSiteAuth } from '../src/auth/client.ts';

afterEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

it('does not automatically accept callback tokens even when a client is initialized', async () => {
  history.replaceState(
    null,
    '',
    '/auth/callback/?attempt=unmatched#access_token=bad&refresh_token=bad',
  );
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const auth = createSiteAuth('https://project-ref.supabase.co', 'public-anon-key');
  expect((await auth.getSession()).data.session).toBeNull();
  expect(localStorage.getItem('sb-project-ref-auth-token')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  auth.stopAutoRefresh();
});

it('persists an explicitly completed session under the compatible SDK default key', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@example.invalid',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  vi.stubGlobal('fetch', fetch);
  const auth = createSiteAuth('https://project-ref.supabase.co', 'public-anon-key');
  const access_token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-1' }))}.c2lnbmF0dXJl`;
  const result = await auth.setSession({ access_token, refresh_token: 'refresh' });
  expect(result.error).toBeNull();
  expect(JSON.parse(localStorage.getItem('sb-project-ref-auth-token')!).user.id).toBe('user-1');
  expect((await auth.getSession()).data.session?.user.id).toBe('user-1');
  auth.stopAutoRefresh();
});

it('fails closed when public configuration is unavailable', () => {
  expect(() => createSiteAuth('', '')).toThrow('Sign-in is not configured');
});
