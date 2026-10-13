// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import Account from '../src/components/Account.astro';
import AuthEntry from '../src/components/AuthEntry.astro';
import AuthCallback from '../src/components/AuthCallback.astro';
import { mountAccount } from '../src/account/page.ts';
import { mountAuthEntry, completeAuthCallback } from '../src/auth/flow.ts';

it.each(['/console/', '/console/?fight=7&tab=notes#log'])(
  'retains %s through anonymous account, actual OAuth entry/callback, and authenticated account return',
  async (initiatingReturn) => {
    const container = await AstroContainer.create();
    const dom = new JSDOM(await container.renderToString(Account), {
      url: `https://openfray.app/account/?returnTo=${encodeURIComponent(initiatingReturn)}`,
    });
    const window = dom.window as unknown as Window & typeof globalThis;
    const user = {
      id: 'owner',
      email: 'owner@example.invalid',
      app_metadata: {},
      user_metadata: {},
    };
    const session = {
      access_token: 'synthetic-token',
      refresh_token: 'synthetic-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    };
    let signedIn = false;
    const auth = {
      getSession: vi.fn(async () => ({
        data: { session: signedIn ? session : null },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOAuth: vi
        .fn()
        .mockResolvedValue({ data: { url: 'https://provider.invalid/authorize' }, error: null }),
      setSession: vi.fn(async () => {
        signedIn = true;
        return { data: { session }, error: null };
      }),
    };
    const navigate = vi.fn();
    const dependencies = {
      window,
      getClient: () => ({ auth }) as never,
      navigate,
      url: 'https://project.supabase.co',
      publicKey: 'public-key',
      fetch: vi.fn(
        async (input) =>
          new Response(JSON.stringify(String(input).endsWith('/auth/v1/user') ? user : false), {
            status: 200,
          }),
      ),
      readSession: async () => (signedIn ? session : null),
    };
    const disposeAnonymous = mountAccount(window.document.querySelector('main')!, dependencies);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    window.history.replaceState(null, '', navigate.mock.calls[0][0]);
    disposeAnonymous();
    window.document.body.innerHTML = await container.renderToString(AuthEntry, {
      props: { intent: 'sign-in' },
    });
    mountAuthEntry(window.document.querySelector('main')!, {
      window,
      getAuth: () => auth as never,
      navigate,
    });
    window.document.querySelector<HTMLButtonElement>('[data-provider="google"]')!.click();
    await vi.waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalled());
    const callback = new URL(auth.signInWithOAuth.mock.calls[0][0].options.redirectTo);
    callback.hash = 'access_token=synthetic-token&refresh_token=synthetic-refresh';
    window.document.body.innerHTML = await container.renderToString(AuthCallback);
    await completeAuthCallback(
      window.document.querySelector('main')!,
      { window, getAuth: () => auth as never, navigate },
      callback.href,
    );
    window.history.replaceState(null, '', navigate.mock.calls.at(-1)![0]);
    window.document.body.innerHTML = await container.renderToString(Account);
    const disposeAuthenticated = mountAccount(window.document.querySelector('main')!, dependencies);
    await vi.waitFor(() => expect(window.document.querySelector('fieldset')?.disabled).toBe(false));
    window.document.querySelector<HTMLAnchorElement>('[data-account-return]')!.click();
    expect(navigate.mock.calls.at(-1)![0]).toBe(initiatingReturn);
    disposeAuthenticated();
    dom.window.close();
  },
);
