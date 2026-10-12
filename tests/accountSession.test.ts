// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';
import Account from '../src/components/Account.astro';
import { mountAccount } from '../src/account/page.ts';
import { createSiteClient } from '../src/auth/client.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Exercise account DOM behavior through the installed SDK with HTTP responses intercepted. */
async function sdkAccount(signedIn: boolean) {
  const container = await AstroContainer.create();
  const dom = new JSDOM(await container.renderToString(Account), {
    url: 'https://openfray.app/account/',
  });
  const window = dom.window as unknown as Window & typeof globalThis;
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', window.document);
  let user = {
    id: 'owner',
    email: 'owner@example.invalid',
    aud: 'authenticated',
    app_metadata: { provider: 'google' },
    user_metadata: { name: 'Owner' },
    created_at: '2026-01-01',
  };
  const fetch = vi.fn().mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === '/auth/v1/user') return new Response(JSON.stringify(user), { status: 200 });
    if (path === '/rest/v1/rpc/may_use_reserved_byline')
      return new Response('false', { status: 200 });
    if (path === '/rest/v1/rpc/stop_all_live_views' || path === '/auth/v1/logout')
      return new Response('null', { status: 200 });
    throw new Error(`Unexpected fixture request: ${path}`);
  });
  vi.stubGlobal('fetch', fetch);
  const url = signedIn ? 'https://sdk-account.supabase.co' : 'https://sdk-anonymous.supabase.co';
  const client = createSiteClient(url, 'public-key');
  if (signedIn) {
    const access_token = `${btoa('{"alg":"HS256","typ":"JWT"}')}.${btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=+$/, '')}.c2lnbmF0dXJl`;
    expect(
      (await client.auth.setSession({ access_token, refresh_token: 'synthetic-refresh' })).error,
    ).toBeNull();
  }
  const navigate = vi.fn();
  const dispose = mountAccount(window.document.querySelector('main')!, {
    window,
    getClient: () => client,
    url,
    publicKey: 'public-key',
    fetch,
    navigate,
  });
  cleanups.push(() => {
    dispose();
    client.auth.stopAutoRefresh();
    dom.window.close();
  });
  /** Emulate another tab replacing native session storage before its auth event reaches this page. */
  function replaceStoredIdentity(sameUser = false) {
    const key = 'sb-sdk-account-auth-token';
    const previous = JSON.parse(window.localStorage.getItem(key)!);
    if (!sameUser) user = { ...user, id: 'replacement', email: 'replacement@example.invalid' };
    const access_token = `${btoa('{"alg":"HS256","typ":"JWT"}')}.${btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 7200 })).replace(/=+$/, '')}.c2lnbmF0dXJl`;
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...previous, user, access_token, refresh_token: 'replacement-refresh' }),
    );
  }
  return { client, window, fetch, navigate, document: window.document, replaceStoredIdentity };
}

it('handles SDK INITIAL_SESSION for an anonymous direct account visit', async () => {
  const { navigate, fetch } = await sdkAccount(false);
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/sign-in/?returnTo=%2Faccount%2F'));
  expect(fetch).not.toHaveBeenCalled();
});

it('revokes live views then clears the shared SDK session and announces signout', async () => {
  const { client, document, window, fetch } = await sdkAccount(true);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Signed out.'),
  );
  const paths = fetch.mock.calls.map(([input]) => new URL(String(input)).pathname);
  expect(paths.indexOf('/rest/v1/rpc/stop_all_live_views')).toBeLessThan(
    paths.indexOf('/auth/v1/logout'),
  );
  expect((await client.auth.getSession()).data.session).toBeNull();
  expect(window.localStorage.getItem('sb-sdk-account-auth-token')).toBeNull();
  expect(document.querySelector('fieldset')?.disabled).toBe(true);
});

it('preserves and displays a replacement native identity after a stale SDK logout reply', async () => {
  const { client, document, fetch, replaceStoredIdentity } = await sdkAccount(true);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const events: string[] = [];
  const subscription = client.auth.onAuthStateChange((event) => {
    events.push(event);
  }).data.subscription;
  cleanups.push(() => subscription.unsubscribe());
  const defaultFetch = fetch.getMockImplementation()!;
  fetch.mockImplementation(async (input, init) => {
    if (new URL(String(input)).pathname === '/auth/v1/logout') {
      replaceStoredIdentity();
      return new Response('null', { status: 200 });
    }
    return defaultFetch(input, init);
  });
  document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
      'replacement@example.invalid',
    ),
  );
  expect((await client.auth.getSession()).data.session?.user.id).toBe('replacement');
  expect(events).not.toContain('SIGNED_OUT');
  expect(document.querySelector('[role="status"]')?.textContent).not.toBe('Signed out.');
});

it('preserves a replacement identity when deletion cleanup is interrupted before SDK broadcast', async () => {
  const { client, document, window, fetch, replaceStoredIdentity } = await sdkAccount(true);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const previous = window.localStorage.getItem('sb-sdk-account-auth-token')!;
  const nativeRemove = window.Storage.prototype.removeItem;
  vi.spyOn(window.Storage.prototype, 'removeItem').mockImplementation(function (
    this: Storage,
    key: string,
  ) {
    nativeRemove.call(this, key);
    if (key === 'sb-sdk-account-auth-token') {
      window.localStorage.setItem(key, previous);
      replaceStoredIdentity();
    }
  });
  const defaultFetch = fetch.getMockImplementation()!;
  fetch.mockImplementation(async (input, init) => {
    if (new URL(String(input)).pathname === '/functions/v1/account-delete')
      return new Response('{"deleted":true}', { status: 200 });
    return defaultFetch(input, init);
  });
  const confirm = document.querySelector<HTMLInputElement>('[data-account-confirm-email]')!;
  confirm.value = 'owner@example.invalid';
  confirm.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector<HTMLButtonElement>('[data-account-delete]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
      'replacement@example.invalid',
    ),
  );
  expect((await client.auth.getSession()).data.session?.user.id).toBe('replacement');
  expect(confirm.value).toBe('');
  expect(document.querySelector('[role="status"]')?.textContent).not.toContain('Account deleted');
});

it('preserves a replacement native session after delayed session_not_found verification', async () => {
  const { client, document, fetch, replaceStoredIdentity } = await sdkAccount(true);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const events: string[] = [];
  const subscription = client.auth.onAuthStateChange((event) => {
    events.push(event);
  }).data.subscription;
  cleanups.push(() => subscription.unsubscribe());
  const defaultFetch = fetch.getMockImplementation()!;
  let reply!: (response: Response) => void;
  fetch.mockImplementationOnce((input, init) => {
    if (new URL(String(input)).pathname === '/auth/v1/user')
      return new Promise<Response>((resolve) => {
        reply = resolve;
      });
    return defaultFetch(input, init);
  });
  document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
  await vi.waitFor(() => expect(reply).toBeDefined());
  replaceStoredIdentity();
  reply(
    new Response('{"code":"session_not_found","message":"fixture bearer expired"}', {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
    }),
  );
  await vi.waitFor(() =>
    expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
      'replacement@example.invalid',
    ),
  );
  expect((await client.auth.getSession()).data.session?.user.id).toBe('replacement');
  expect(events).not.toContain('SIGNED_OUT');
  expect(document.querySelector('[role="status"]')?.textContent).not.toContain('fixture bearer');
});

it.each([false, true])(
  'does not dispatch revocation after a successful stale verification of replaced or renewed identity (%s)',
  async (sameUser) => {
    const { client, document, fetch, replaceStoredIdentity } = await sdkAccount(true);
    await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
    const defaultFetch = fetch.getMockImplementation()!;
    let reply!: (response: Response) => void;
    fetch.mockImplementationOnce((input, init) => {
      if (new URL(String(input)).pathname === '/auth/v1/user')
        return new Promise<Response>((resolve) => {
          reply = resolve;
        });
      return defaultFetch(input, init);
    });
    const previous = (await client.auth.getSession()).data.session!;
    document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
    await vi.waitFor(() => expect(reply).toBeDefined());
    replaceStoredIdentity(sameUser);
    reply(new Response(JSON.stringify(previous.user), { status: 200 }));
    await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
    expect((await client.auth.getSession()).data.session?.refresh_token).toBe(
      'replacement-refresh',
    );
    expect(
      fetch.mock.calls.filter(
        ([input]) => new URL(String(input)).pathname === '/rest/v1/rpc/stop_all_live_views',
      ),
    ).toHaveLength(0);
    expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
      sameUser ? 'owner@example.invalid' : 'replacement@example.invalid',
    );
  },
);

it('aborts stale account verification on a real SDK same-user session renewal without signing out the renewed session', async () => {
  const { client, document, window, fetch, replaceStoredIdentity } = await sdkAccount(true);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  let reply!: (response: Response) => void;
  let signal!: AbortSignal;
  fetch.mockImplementationOnce((_input, init) => {
    signal = init.signal;
    return new Promise<Response>((resolve) => {
      reply = resolve;
    });
  });
  document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
  await vi.waitFor(() => expect(reply).toBeDefined());
  replaceStoredIdentity(true);
  const renewed = JSON.parse(window.localStorage.getItem('sb-sdk-account-auth-token')!);
  expect((await client.auth.setSession(renewed)).error).toBeNull();
  expect(signal.aborted).toBe(true);
  reply(new Response('{"code":"session_not_found"}', { status: 403 }));
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  expect((await client.auth.getSession()).data.session?.refresh_token).toBe('replacement-refresh');
  expect(
    fetch.mock.calls.filter(([input]) => new URL(String(input)).pathname === '/auth/v1/logout'),
  ).toHaveLength(0);
});

it('does not apply a late confirmed deletion reply to a replacement native session', async () => {
  const { client, document, window, fetch, replaceStoredIdentity } = await sdkAccount(true);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const defaultFetch = fetch.getMockImplementation()!;
  let reply!: (response: Response) => void;
  fetch.mockImplementation(async (input, init) => {
    if (new URL(String(input)).pathname === '/functions/v1/account-delete')
      return new Promise<Response>((resolve) => {
        reply = resolve;
      });
    return defaultFetch(input, init);
  });
  const confirm = document.querySelector<HTMLInputElement>('[data-account-confirm-email]')!;
  confirm.value = 'owner@example.invalid';
  confirm.dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector<HTMLButtonElement>('[data-account-delete]')!.click();
  await vi.waitFor(() => expect(reply).toBeDefined());
  replaceStoredIdentity();
  reply(new Response('{"deleted":true}', { status: 200 }));
  await vi.waitFor(() =>
    expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
      'replacement@example.invalid',
    ),
  );
  expect((await client.auth.getSession()).data.session?.user.id).toBe('replacement');
  expect(confirm.value).toBe('');
  expect(document.querySelector('[role="status"]')?.textContent).not.toContain('Account deleted');
});

it.each(['sign-out', 'delete'])(
  'preserves B stored after final SDK auxiliary-user removal during A %s',
  async (action) => {
    const { client, document, window, fetch, replaceStoredIdentity } = await sdkAccount(true);
    await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
    const previous = window.localStorage.getItem('sb-sdk-account-auth-token')!;
    const nativeRemove = window.Storage.prototype.removeItem;
    let interleaved = false;
    vi.spyOn(window.Storage.prototype, 'removeItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      nativeRemove.call(this, key);
      if (key === 'sb-sdk-account-auth-token-user' && !interleaved) {
        interleaved = true;
        window.localStorage.setItem('sb-sdk-account-auth-token', previous);
        replaceStoredIdentity();
      }
    });
    if (action === 'delete') {
      const defaultFetch = fetch.getMockImplementation()!;
      fetch.mockImplementation(async (input, init) =>
        new URL(String(input)).pathname === '/functions/v1/account-delete'
          ? new Response('{"deleted":true}', { status: 200 })
          : defaultFetch(input, init),
      );
      const confirm = document.querySelector<HTMLInputElement>('[data-account-confirm-email]')!;
      confirm.value = 'owner@example.invalid';
      confirm.dispatchEvent(new window.Event('input', { bubbles: true }));
    }
    document.querySelector<HTMLButtonElement>(`[data-account-${action}]`)!.click();
    await vi.waitFor(() => expect(interleaved).toBe(true));
    await vi.waitFor(() =>
      expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
        'replacement@example.invalid',
      ),
    );
    expect((await client.auth.getSession()).data.session?.user.id).toBe('replacement');
    expect(document.querySelector('fieldset')?.disabled).toBe(false);
    expect(document.querySelector('[role="status"]')?.textContent).not.toMatch(
      /Signed out|Account deleted/,
    );
  },
);

it('ignores a delayed old cross-tab SIGNED_OUT after B has been verified', async () => {
  const { client, document, window, replaceStoredIdentity } = await sdkAccount(true);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  replaceStoredIdentity();
  const replacement = JSON.parse(window.localStorage.getItem('sb-sdk-account-auth-token')!);
  await client.auth.setSession(replacement);
  await vi.waitFor(() =>
    expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
      'replacement@example.invalid',
    ),
  );
  let delivered = false;
  const subscription = client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') delivered = true;
  }).data.subscription;
  cleanups.push(() => subscription.unsubscribe());
  const channel = new BroadcastChannel('sb-sdk-account-auth-token');
  channel.postMessage({ event: 'SIGNED_OUT', session: null });
  await vi.waitFor(() => expect(delivered).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, 0));
  channel.close();
  expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
    'replacement@example.invalid',
  );
  expect(document.querySelector('fieldset')?.disabled).toBe(false);
  expect((await client.auth.getSession()).data.session?.user.id).toBe('replacement');
});
