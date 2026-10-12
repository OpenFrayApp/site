// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import type { Session, SupabaseClient } from '@supabase/supabase-js';

type Guard = { session: Session; isCurrent: () => boolean; removed: boolean };
type Adapter = ReturnType<typeof accountSessionAdapter>;
const adapters = new WeakMap<SupabaseClient, Adapter>();

/** Wrap native storage and SDK logout only for a bounded account session cleanup. */
export function accountSessionAdapter(url: string, storage: Storage) {
  const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  let guard: Guard | undefined;

  /** Refuse SDK side effects when either memory or native storage has changed identity. */
  function check() {
    if (!guard) return;
    const stored = storage.getItem(key);
    const session = stored ? JSON.parse(stored) : null;
    if (
      !guard.isCurrent() ||
      (session
        ? session.access_token !== guard.session.access_token ||
          session.refresh_token !== guard.session.refresh_token ||
          session.user?.id !== guard.session.user.id
        : !guard.removed)
    )
      throw new Error('Your session changed. Check your account and try again.');
  }

  return {
    readSession: (): Session | null => {
      const stored = storage.getItem(key);
      if (stored === null) return null;
      const value: unknown = JSON.parse(stored);
      if (!value || typeof value !== 'object')
        throw new Error('Stored account session is malformed.');
      const candidate = value as Partial<Session>;
      if (
        typeof candidate.access_token !== 'string' ||
        !candidate.access_token ||
        typeof candidate.refresh_token !== 'string' ||
        !candidate.refresh_token ||
        typeof candidate.expires_at !== 'number' ||
        !Number.isFinite(candidate.expires_at) ||
        !candidate.user ||
        typeof candidate.user !== 'object' ||
        typeof candidate.user.id !== 'string' ||
        !candidate.user.id
      )
        throw new Error('Stored account session is malformed.');
      return candidate as Session;
    },
    storage: {
      getItem: (name: string) => {
        check();
        return storage.getItem(name);
      },
      setItem: (name: string, value: string) => {
        check();
        storage.setItem(name, value);
      },
      removeItem: (name: string) => {
        check();
        storage.removeItem(name);
        if (guard && name === key) guard.removed = true;
      },
    },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      if (guard && String(input).startsWith(`${url.replace(/\/$/, '')}/auth/v1/logout`)) {
        check();
        if (
          new Headers(init?.headers).get('Authorization') !== `Bearer ${guard.session.access_token}`
        )
          throw new Error('Your session changed. Check your account and try again.');
      }
      return fetch(input, init);
    },
    run: async (
      client: SupabaseClient,
      session: Session,
      isCurrent: () => boolean,
      scope: 'global' | 'local',
    ) => {
      if (guard) throw new Error('Account sign-out is already in progress.');
      guard = { session, isCurrent, removed: false };
      try {
        check();
        const result = await client.auth.signOut({ scope });
        if (result.error) throw new Error('Sign-out failed. Check your account and try again.');
      } finally {
        guard = undefined;
      }
    },
  };
}

/** Associate the guarded SDK boundary with its one persistent client. */
export function registerAccountSessionAdapter(client: SupabaseClient, adapter: Adapter) {
  adapters.set(client, adapter);
}

/** Read only the registered client's native session candidate; this is never trusted authorization. */
export function readAccountSession(client: SupabaseClient): Session | null {
  const adapter = adapters.get(client);
  if (!adapter)
    throw new Error('Account session reconciliation is unavailable. Reload and try again.');
  return adapter.readSession();
}

/** Fence SDK sign-out to the captured session and refuse observed replacements. */
export async function signOutAccountSession(
  client: SupabaseClient,
  session: Session,
  isCurrent: () => boolean,
  scope: 'global' | 'local' = 'global',
) {
  const adapter = adapters.get(client);
  if (!adapter) throw new Error('Account sign-out is unavailable. Reload and try again.');
  await adapter.run(client, session, isCurrent, scope);
}
