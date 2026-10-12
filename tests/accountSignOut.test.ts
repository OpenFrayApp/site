// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { afterEach, expect, it, vi } from 'vitest';
import { createSiteClient } from '../src/auth/client.ts';
import { signOutAccountSession } from '../src/account/signOut.ts';

const key = 'sb-guarded-auth-token';
const clients: ReturnType<typeof createSiteClient>[] = [];
afterEach(() => {
  clients.forEach((client) => client.auth.stopAutoRefresh());
  clients.length = 0;
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Install a synthetic session through the real SDK and mock only its HTTP boundary. */
async function identity() {
  const user = {
    id: 'owner',
    aud: 'authenticated',
    email: 'owner@example.invalid',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01',
  };
  const fetch = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
  vi.stubGlobal('fetch', fetch);
  const client = createSiteClient('https://guarded.supabase.co', 'public-key');
  clients.push(client);
  const token = `${btoa('{"alg":"HS256","typ":"JWT"}')}.${btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=+$/, '')}.c2lnbmF0dXJl`;
  const installed = await client.auth.setSession({
    access_token: token,
    refresh_token: 'refresh-owner',
  });
  expect(installed.error).toBeNull();
  const session = (await client.auth.getSession()).data.session!;
  const events: string[] = [];
  client.auth.onAuthStateChange((event) => {
    events.push(event);
  });
  return { client, session, fetch, events };
}

it('does not remove or broadcast signout for a replacement that arrives during logout', async () => {
  const { client, session, fetch, events } = await identity();
  const replacement = {
    ...session,
    access_token: 'replacement-token',
    refresh_token: 'replacement-refresh',
    user: { ...session.user, id: 'replacement' },
  };
  fetch.mockImplementationOnce(async () => {
    localStorage.setItem(key, JSON.stringify(replacement));
    return new Response('{}', { status: 200 });
  });
  await expect(signOutAccountSession(client, session, () => true)).rejects.toThrow('changed');
  expect(JSON.parse(localStorage.getItem(key)!).user.id).toBe('replacement');
  expect(events).not.toContain('SIGNED_OUT');
  expect((await client.auth.getSession()).data.session?.user.id).toBe('replacement');
});

it('signs out the unchanged session through SDK storage and events', async () => {
  const { client, session, events } = await identity();
  await signOutAccountSession(client, session, () => true);
  expect(localStorage.getItem(key)).toBeNull();
  expect(events).toContain('SIGNED_OUT');
  expect((await client.auth.getSession()).data.session).toBeNull();
});

it('refuses a same-user token renewal before SDK logout dispatch', async () => {
  const { client, session, fetch, events } = await identity();
  localStorage.setItem(
    key,
    JSON.stringify({ ...session, access_token: 'renewed', refresh_token: 'renewed-refresh' }),
  );
  fetch.mockClear();
  await expect(signOutAccountSession(client, session, () => true)).rejects.toThrow('changed');
  expect(fetch).not.toHaveBeenCalled();
  expect(events).not.toContain('SIGNED_OUT');
  expect(JSON.parse(localStorage.getItem(key)!).access_token).toBe('renewed');
});

it('refuses a replacement acquired while SDK signout waits on its session lock', async () => {
  const { client, session, fetch, events } = await identity();
  let release!: (response: Response) => void;
  fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const pendingUpdate = client.auth.updateUser({ data: { display_name: 'Pending' } });
  await vi.waitFor(() => expect(release).toBeDefined());
  const signout = signOutAccountSession(client, session, () => true);
  const refusal = expect(signout).rejects.toThrow('changed');
  release(
    new Response(JSON.stringify({ ...session.user, id: 'replacement' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  await pendingUpdate;
  await refusal;
  expect(events).not.toContain('SIGNED_OUT');
  expect(JSON.parse(localStorage.getItem(key)!).user.id).toBe('replacement');
});

it('halts cleanup before SDK broadcasts if a replacement appears between storage removals', async () => {
  const { client, session, events } = await identity();
  const replacement = {
    ...session,
    access_token: 'replacement',
    user: { ...session.user, id: 'replacement' },
  };
  const nativeRemove = Storage.prototype.removeItem;
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (
    this: Storage,
    name: string,
  ) {
    nativeRemove.call(this, name);
    if (name === key) this.setItem(key, JSON.stringify(replacement));
  });
  await expect(signOutAccountSession(client, session, () => true, 'local')).rejects.toThrow(
    'changed',
  );
  expect(events).not.toContain('SIGNED_OUT');
  expect((await client.auth.getSession()).data.session?.user.id).toBe('replacement');
});
