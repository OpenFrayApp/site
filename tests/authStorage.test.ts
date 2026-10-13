// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';
import AuthEntry from '../src/components/AuthEntry.astro';
import AuthCallback from '../src/components/AuthCallback.astro';
import { createSiteAuth } from '../src/auth/client.ts';
import { completeAuthCallback, mountAuthEntry } from '../src/auth/flow.ts';

afterEach(() => vi.unstubAllGlobals());

it.each(['before initialization', 'after initialization', 'during callback verification'])(
  'shows failure instead of returning to the console when storage fills %s',
  async (quotaTiming) => {
    const container = await AstroContainer.create();
    const dom = new JSDOM(
      await container.renderToString(AuthEntry, { props: { intent: 'sign-in' } }),
      {
        url: 'https://openfray.app/sign-in/?returnTo=%2Fconsole%2F',
        storageQuota: 5000,
      },
    );
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('localStorage', dom.window.localStorage);
    vi.stubGlobal('BroadcastChannel', undefined);
    /** Leave enough localStorage for the site's empty probe, but not the SDK probe or session. */
    function fillQuota() {
      dom.window.localStorage.setItem(
        'unrelated-device-data',
        'x'.repeat(5000 - 60 - 'unrelated-device-data'.length),
      );
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (quotaTiming === 'during callback verification') fillQuota();
        return new Response(
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
        );
      }),
    );
    if (quotaTiming === 'before initialization') fillQuota();
    const auth = createSiteAuth('https://quota-test.supabase.co', 'public-test-key');
    await auth.getSession();
    if (quotaTiming === 'after initialization') fillQuota();
    const navigate = vi.fn();
    const browser = { window: dom.window as unknown as Window, getAuth: () => auth, navigate };
    try {
      mountAuthEntry(dom.window.document.querySelector('main')!, browser);
      dom.window.document.querySelector<HTMLButtonElement>('[data-provider="google"]')!.click();
      await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
      const callback = new URL(navigate.mock.calls[0][0]).searchParams.get('redirect_to')!;
      const accessToken = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-1' }))}.c2lnbmF0dXJl`;
      dom.window.history.replaceState(
        null,
        '',
        `${callback}#access_token=${accessToken}&refresh_token=refresh`,
      );
      dom.window.document.body.innerHTML = await container.renderToString(AuthCallback);
      navigate.mockClear();
      const root = dom.window.document.querySelector<HTMLElement>('main')!;
      await completeAuthCallback(root, browser);
      expect(root.querySelector('[data-auth-status]')?.textContent).toContain(
        'could not be completed',
      );
      expect(navigate).not.toHaveBeenCalled();
      expect(dom.window.localStorage.getItem('sb-quota-test-auth-token')).toBeNull();
      expect(dom.window.location.href).toBe('https://openfray.app/auth/callback/');
      expect(dom.window.sessionStorage.getItem('openfray-oauth-attempt')).toBeNull();
    } finally {
      auth.stopAutoRefresh();
      dom.window.close();
    }
  },
);
