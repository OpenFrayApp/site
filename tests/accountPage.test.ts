// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';
import Account from '../src/components/Account.astro';
import { mountAccount } from '../src/account/page.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
});

/** Render account controls and mock only the authenticated session and network boundaries. */
async function account(
  returnTo = '/console/?fight=7#log',
  signedIn = true,
  grant: unknown = false,
) {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Account);
  const dom = new JSDOM(html, {
    url: `https://openfray.app/account/?returnTo=${encodeURIComponent(returnTo)}`,
  });
  const window = dom.window as unknown as Window & typeof globalThis;
  const user = {
    id: 'owner',
    email: 'owner@example.invalid',
    app_metadata: { provider: 'discord' },
    user_metadata: { full_name: 'Provider name' },
  };
  const session = {
    access_token: 'owner-token',
    refresh_token: 'owner-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
  let event!: (event: string, session: unknown) => void;
  const auth = {
    getSession: vi
      .fn()
      .mockResolvedValue({ data: { session: signedIn ? session : null }, error: null }),
    onAuthStateChange: vi.fn((callback) => {
      event = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
  };
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(grant), { status: 200 }));
  const readUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('/auth/v1/user') && init?.method === 'GET') {
      const result = await readUser(new Headers(init.headers).get('Authorization')?.slice(7));
      return new Response(JSON.stringify(result.data.user), { status: result.error ? 401 : 200 });
    }
    return fetch(input, init);
  };
  const navigate = vi.fn();
  const signOut = vi.fn().mockImplementation(async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as never);
  });
  const dispose = mountAccount(window.document.querySelector('main')!, {
    window,
    getClient: () => ({ auth }) as never,
    url: 'https://project.supabase.co',
    publicKey: 'public-key',
    fetch: fetcher,
    navigate,
    signOut,
    readSession: async () => (await auth.getSession()).data.session as never,
  });
  cleanups.push(() => {
    dispose();
    dom.window.close();
  });
  return {
    window,
    document: window.document,
    auth,
    readUser,
    user,
    session,
    fetch,
    navigate,
    signOut,
    dispose,
    emit: (session: unknown) => {
      auth.getSession.mockResolvedValue({ data: { session }, error: null } as never);
      event('SIGNED_IN', session);
    },
  };
}

it('routes an anonymous account visit through sign-in and retains its validated initiating return', async () => {
  const { navigate, document } = await account(undefined, false);
  await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
  const destination = new URL(navigate.mock.calls[0][0], 'https://openfray.app');
  expect(destination.pathname).toBe('/sign-in/');
  expect(destination.searchParams.get('returnTo')).toBe(
    '/account/?returnTo=/console/%3Ffight%3D7%23log',
  );
  expect(document.querySelector('fieldset')?.disabled).toBe(true);
});

it('shows only the verified current account email and provider with an accessible return', async () => {
  const { document, readUser } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  expect(readUser).toHaveBeenCalledWith('owner-token');
  expect(document.querySelector('[data-account-identity]')?.textContent).toContain(
    'owner@example.invalid',
  );
  expect(document.querySelector('[data-account-provider]')?.textContent).toBe('Discord');
  expect(document.querySelector('a[data-account-return]')?.getAttribute('href')).toBe(
    '/console/?fight=7#log',
  );
  expect(document.querySelectorAll('h1')).toHaveLength(1);
});

it('fences delayed identity reads when the account is replaced or expires', async () => {
  const { document, readUser, user, session, emit } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  let reply!: (value: unknown) => void;
  readUser.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        reply = resolve;
      }) as never,
  );
  emit(session);
  await vi.waitFor(() => expect(reply).toBeDefined());
  const other = { ...user, id: 'other', email: 'other@example.invalid' };
  readUser.mockResolvedValueOnce({ data: { user: other }, error: null });
  emit({ ...session, access_token: 'other-token', user: other });
  await vi.waitFor(() =>
    expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
      'other@example.invalid',
    ),
  );
  reply({ data: { user }, error: null });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
    'other@example.invalid',
  );
  emit(null);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(true));
  expect(document.querySelector('[data-account-identity]')?.textContent).toBe('');
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Sign in');
});

it('refuses signout when live-view revocation fails, then supports an explicit retry', async () => {
  const { document, fetch, signOut, navigate } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  fetch.mockResolvedValueOnce(new Response('{}', { status: 503 }));
  document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Live views'),
  );
  expect(signOut).not.toHaveBeenCalled();
  expect(document.querySelector('[data-account-identity]')?.textContent).toContain(
    'owner@example.invalid',
  );
  fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
  document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
  await vi.waitFor(() => expect(signOut).toHaveBeenCalled());
  expect(fetch.mock.calls.at(-1)?.[0]).toBe(
    'https://project.supabase.co/rest/v1/rpc/stop_all_live_views',
  );
  expect(JSON.parse(fetch.mock.calls.at(-1)?.[1]?.body as string)).toEqual({});
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Signed out');
  expect(navigate).not.toHaveBeenCalled();
});

it('requires the typed current email and preserves irreversible deletion failure until deleted:true', async () => {
  const { document, fetch, signOut } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const confirm = document.querySelector<HTMLInputElement>('[data-account-confirm-email]')!;
  const button = document.querySelector<HTMLButtonElement>('[data-account-delete]')!;
  expect(button.disabled).toBe(true);
  confirm.value = 'someone@example.invalid';
  confirm.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
  expect(button.disabled).toBe(true);
  confirm.value = ' OWNER@example.invalid ';
  confirm.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
  expect(button.disabled).toBe(false);
  fetch.mockResolvedValueOnce(new Response('{"deleted":false}', { status: 200 }));
  button.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'could not be confirmed',
    ),
  );
  expect(confirm.value).toBe(' OWNER@example.invalid ');
  expect(signOut).not.toHaveBeenCalled();
  fetch.mockResolvedValueOnce(new Response('{"deleted":true}', { status: 200 }));
  signOut.mockRejectedValueOnce(new Error('cleanup failed'));
  button.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Account deleted'),
  );
  expect(fetch.mock.calls.at(-1)?.[0]).toBe(
    'https://project.supabase.co/functions/v1/account-delete',
  );
  expect(JSON.parse(fetch.mock.calls.at(-1)?.[1]?.body as string)).toEqual({});
  expect(signOut.mock.calls.at(-1)?.[3]).toBe('local');
  expect(document.querySelector('fieldset')?.disabled).toBe(true);
  expect(document.body.textContent).toContain('can’t be undone');
  expect(document.body.textContent).toContain('shared links');
});

it('edits and clears the provider display name with the shared pure byline checks', async () => {
  const { document, fetch, readUser, user } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const name = document.querySelector<HTMLInputElement>('#display-name')!;
  const form = document.querySelector<HTMLFormElement>('[data-account-name-form]')!;
  expect(name.value).toBe('Provider name');
  name.value = 'OpenFray';
  form.dispatchEvent(
    new document.defaultView!.Event('submit', { bubbles: true, cancelable: true }),
  );
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toContain('reserved'),
  );
  expect(fetch.mock.calls.filter(([url]) => String(url).includes('/auth/v1/user'))).toHaveLength(0);
  name.value = '  Marín / GM  ';
  fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ ...user, user_metadata: { display_name: 'Marín / GM' } }), {
      status: 200,
    }),
  );
  readUser.mockResolvedValueOnce({ data: { user }, error: null }).mockResolvedValueOnce({
    data: { user: { ...user, user_metadata: { display_name: 'Marín / GM' } } },
    error: null,
  });
  form.dispatchEvent(
    new document.defaultView!.Event('submit', { bubbles: true, cancelable: true }),
  );
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Saved.'),
  );
  expect(fetch.mock.calls.at(-1)?.[0]).toBe('https://project.supabase.co/auth/v1/user');
  expect(JSON.parse(fetch.mock.calls.at(-1)?.[1]?.body as string)).toEqual({
    data: { display_name: 'Marín / GM' },
  });
  name.value = '';
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }));
  form.dispatchEvent(
    new document.defaultView!.Event('submit', { bubbles: true, cancelable: true }),
  );
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Custom name cleared'),
  );
  expect(JSON.parse(fetch.mock.calls.at(-1)?.[1]?.body as string)).toEqual({
    data: { display_name: null },
  });
});

it('returns safely for malicious destinations and never forwards URL account targets', async () => {
  const { document, navigate } = await account(
    'https://evil.example/?account=other&access_token=secret',
  );
  document.querySelector<HTMLAnchorElement>('[data-account-return]')!.click();
  expect(navigate).toHaveBeenCalledWith('/account/');
});

it('suppresses stale signout/deletion effects after an identity replacement', async () => {
  for (const action of ['sign-out', 'delete']) {
    const { document, readUser, fetch, signOut, user, session, emit } = await account();
    await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
    if (action === 'delete') {
      const confirm = document.querySelector<HTMLInputElement>('[data-account-confirm-email]')!;
      confirm.value = user.email;
      confirm.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
    }
    let reply!: (value: Response) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          reply = resolve;
        }),
    );
    document.querySelector<HTMLButtonElement>(`[data-account-${action}]`)!.click();
    await vi.waitFor(() => expect(reply).toBeDefined());
    const other = { ...user, id: 'other', email: 'other@example.invalid' };
    readUser.mockResolvedValue({ data: { user: other }, error: null });
    emit({ ...session, access_token: 'other-token', user: other });
    await vi.waitFor(() =>
      expect(document.querySelector('[data-account-identity]')?.textContent).toBe(other.email),
    );
    reply(new Response('{"deleted":true}', { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signOut).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-account-confirm-email]')?.getAttribute('value'),
    ).toBeNull();
    expect(document.querySelector('[data-account-identity]')?.textContent).toBe(other.email);
  }
});

it('announces successful SDK signout instead of treating its own auth event as expiry', async () => {
  const { document, signOut, emit } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  signOut.mockImplementationOnce(async () => {
    emit(null);
  });
  document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Signed out.'),
  );
});

it.each([false, 'true', { allowReserved: true }])(
  'ignores editable grants and malformed reserved capability %j',
  async (grant) => {
    const { document, user, fetch } = await account(undefined, true, grant);
    Object.assign(user.user_metadata, { allowReserved: true, may_use_reserved_byline: true });
    await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
    document.querySelector<HTMLInputElement>('#display-name')!.value = 'OpenFray';
    document
      .querySelector<HTMLFormElement>('[data-account-name-form]')!
      .dispatchEvent(new document.defaultView!.Event('submit', { cancelable: true }));
    await vi.waitFor(() =>
      expect(document.querySelector('[role="status"]')?.textContent).toContain('reserved'),
    );
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/auth/v1/user'))).toHaveLength(
      0,
    );
  },
);

it('allows granted reserved names but still checks byline shape, with the trusted capability RPC', async () => {
  const { document, fetch, readUser, user } = await account(undefined, true, true);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  expect(fetch.mock.calls[0][0]).toBe(
    'https://project.supabase.co/rest/v1/rpc/may_use_reserved_byline',
  );
  expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe(
    'Bearer owner-token',
  );
  const name = document.querySelector<HTMLInputElement>('#display-name')!;
  const form = document.querySelector<HTMLFormElement>('[data-account-name-form]')!;
  name.value = '<script>';
  form.dispatchEvent(new document.defaultView!.Event('submit', { cancelable: true }));
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Use letters');
  name.value = 'OpenFray';
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }));
  readUser.mockResolvedValueOnce({ data: { user }, error: null }).mockResolvedValueOnce({
    data: { user: { ...user, user_metadata: { display_name: 'OpenFray' } } },
    error: null,
  });
  form.dispatchEvent(new document.defaultView!.Event('submit', { cancelable: true }));
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Saved.'),
  );
});

it('suppresses stale profile replies and aborts their request when the current account expires', async () => {
  const { document, fetch, emit, user } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  let reply!: (response: Response) => void;
  fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        reply = resolve;
      }),
  );
  document.querySelector<HTMLInputElement>('#display-name')!.value = 'New name';
  document
    .querySelector<HTMLFormElement>('[data-account-name-form]')!
    .dispatchEvent(new document.defaultView!.Event('submit', { cancelable: true }));
  await vi.waitFor(() => expect(reply).toBeDefined());
  const signal = fetch.mock.calls.at(-1)?.[1].signal;
  emit(null);
  await vi.waitFor(() => expect(signal.aborted).toBe(true));
  reply(new Response(JSON.stringify(user), { status: 200 }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.querySelector('fieldset')?.disabled).toBe(true);
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Sign in');
  expect(document.querySelector<HTMLInputElement>('#display-name')?.value).toBe('');
});

it('replaces a changed verified email and clears deletion confirmation before refusing erasure', async () => {
  const { document, readUser, user, fetch } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const confirm = document.querySelector<HTMLInputElement>('[data-account-confirm-email]')!;
  confirm.value = user.email;
  confirm.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
  readUser.mockResolvedValueOnce({
    data: { user: { ...user, email: 'new@example.invalid' } },
    error: null,
  });
  document.querySelector<HTMLButtonElement>('[data-account-delete]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toContain('email changed'),
  );
  expect(document.querySelector('[data-account-identity]')?.textContent).toBe(
    'new@example.invalid',
  );
  expect(confirm.value).toBe('');
  expect(document.querySelector<HTMLButtonElement>('[data-account-delete]')?.disabled).toBe(true);
  expect(fetch.mock.calls.filter(([url]) => String(url).includes('/account-delete'))).toHaveLength(
    0,
  );
});

it('expires the account controls even without another auth event', async () => {
  vi.useFakeTimers();
  const { document } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  await vi.advanceTimersByTimeAsync(3600001);
  expect(document.querySelector('fieldset')?.disabled).toBe(true);
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Sign in');
});

it('refuses account effects when trusted identity verification fails', async () => {
  const { document, readUser, fetch, signOut } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  readUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'expired' } } as never);
  document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Sign in'),
  );
  expect(
    fetch.mock.calls.filter(([url]) => String(url).includes('/stop_all_live_views')),
  ).toHaveLength(0);
  expect(signOut).not.toHaveBeenCalled();
});

it('shows and updates the existing default shared-encounter license, including clearing the default', async () => {
  const { document, user, readUser, fetch } = await account();
  Object.assign(user.user_metadata, { share_license: 'cc-by-4.0' });
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const license = document.querySelector<HTMLSelectElement>('#share-license-default')!;
  expect(license.value).toBe('cc-by-4.0');
  expect([...license.options].map((option) => option.textContent)).toEqual([
    'No public license stated',
    'CC0 1.0',
    'CC BY 4.0',
    'CC BY-SA 4.0',
    'CC BY-NC 4.0',
    'CC BY-NC-SA 4.0',
    'All rights reserved',
  ]);
  license.value = 'reserved';
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }));
  readUser.mockResolvedValueOnce({ data: { user }, error: null }).mockResolvedValueOnce({
    data: { user: { ...user, user_metadata: { share_license: 'reserved' } } },
    error: null,
  });
  license.dispatchEvent(new document.defaultView!.Event('change', { bubbles: true }));
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Saved.'),
  );
  expect(JSON.parse(fetch.mock.calls.at(-1)?.[1].body)).toEqual({
    data: { share_license: 'reserved' },
  });
  expect(document.querySelector('[data-account-license-hint]')?.textContent).toContain(
    'Nobody may reuse',
  );
  license.value = 'unstated';
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }));
  readUser
    .mockResolvedValueOnce({ data: { user }, error: null })
    .mockResolvedValueOnce({ data: { user: { ...user, user_metadata: {} } }, error: null });
  license.dispatchEvent(new document.defaultView!.Event('change', { bubbles: true }));
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  expect(JSON.parse(fetch.mock.calls.at(-1)?.[1].body)).toEqual({ data: { share_license: null } });
});

it.each(['wrong-user', 'malformed-user'])(
  'fails closed without effects on %s verification',
  async (kind) => {
    const { document, readUser, user, fetch, signOut } = await account();
    await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
    const invalid =
      kind === 'wrong-user' ? { ...user, id: 'other' } : { ...user, app_metadata: [] };
    readUser.mockResolvedValueOnce({ data: { user: invalid }, error: null } as never);
    document.querySelector<HTMLButtonElement>('[data-account-sign-out]')!.click();
    await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(true));
    await vi.waitFor(() =>
      expect(document.querySelector('[role="status"]')?.textContent).toContain('Sign in'),
    );
    expect(signOut).not.toHaveBeenCalled();
    expect(
      fetch.mock.calls.filter(([url]) => String(url).includes('/stop_all_live_views')),
    ).toHaveLength(0);
  },
);

it('resets a custom name to the verified provider fallback on reread and later session reload', async () => {
  const { document, readUser, user, session, emit, fetch } = await account();
  Object.assign(user.user_metadata, { display_name: 'Custom name' });
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const name = document.querySelector<HTMLInputElement>('#display-name')!;
  name.value = '';
  const resetUser = { ...user, user_metadata: { display_name: null, full_name: 'Provider name' } };
  readUser
    .mockResolvedValueOnce({ data: { user }, error: null })
    .mockResolvedValue({ data: { user: resetUser }, error: null } as never);
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(resetUser), { status: 200 }));
  document
    .querySelector<HTMLFormElement>('[data-account-name-form]')!
    .dispatchEvent(new document.defaultView!.Event('submit', { cancelable: true }));
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  expect(JSON.parse(fetch.mock.calls.at(-1)?.[1].body)).toEqual({ data: { display_name: null } });
  expect(name.value).toBe('Provider name');
  expect(document.querySelector('[role="status"]')?.textContent).toBe(
    'Custom name cleared. Your provider name is shown.',
  );
  emit(session);
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  expect(name.value).toBe('Provider name');
});

it('clears the publishing name when the account has no provider fallback', async () => {
  const { document, readUser, user, fetch } = await account();
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  const name = document.querySelector<HTMLInputElement>('#display-name')!;
  name.value = '';
  readUser.mockResolvedValueOnce({ data: { user }, error: null }).mockResolvedValueOnce({
    data: { user: { ...user, user_metadata: {} } },
    error: null,
  } as never);
  fetch.mockResolvedValueOnce(new Response(JSON.stringify(user), { status: 200 }));
  document
    .querySelector<HTMLFormElement>('[data-account-name-form]')!
    .dispatchEvent(new document.defaultView!.Event('submit', { cancelable: true }));
  await vi.waitFor(() => expect(document.querySelector('fieldset')?.disabled).toBe(false));
  expect(name.value).toBe('');
  expect(document.querySelector('[role="status"]')?.textContent).toBe(
    'Cleared. Encounters publish unsigned.',
  );
});
