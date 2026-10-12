// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import type { User } from '@supabase/supabase-js';

export type AccountUser = Pick<User, 'id' | 'email' | 'app_metadata' | 'user_metadata'>;

/** Validate the fields this account boundary consumes from the authenticated user endpoint. */
function accountUser(value: unknown): AccountUser {
  if (!value || typeof value !== 'object')
    throw new Error('Your account could not be verified. Sign in again or reload to retry.');
  const user = value as Record<string, unknown>;
  if (
    typeof user.id !== 'string' ||
    !user.id ||
    (user.email != null && typeof user.email !== 'string') ||
    !user.app_metadata ||
    typeof user.app_metadata !== 'object' ||
    Array.isArray(user.app_metadata) ||
    !user.user_metadata ||
    typeof user.user_metadata !== 'object' ||
    Array.isArray(user.user_metadata)
  )
    throw new Error('Your account could not be verified. Sign in again or reload to retry.');
  return {
    id: user.id,
    email: typeof user.email === 'string' ? user.email : undefined,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
  };
}

/** Send narrowly scoped account effects using only the verified caller’s captured bearer token. */
export function accountRequests(
  url: string | undefined,
  publicKey: string | undefined,
  fetcher: typeof fetch,
) {
  /** Dispatch one authenticated request without resolving or replacing a different SDK session after an await. */
  async function request(
    path: string,
    token: string,
    signal: AbortSignal,
    body: object = {},
    method = 'POST',
  ): Promise<unknown> {
    if (!url || !publicKey) throw new Error('Accounts are unavailable. Reload and try again.');
    try {
      signal.throwIfAborted();
      const response = await fetcher(`${url.replace(/\/$/, '')}${path}`, {
        method,
        headers: {
          apikey: publicKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
        signal,
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      throw new Error('Account request failed. Sign in again or retry.');
    }
  }
  return {
    verifyUser: async (token: string, signal: AbortSignal) =>
      accountUser(await request('/auth/v1/user', token, signal, {}, 'GET')),
    reservedByline: (token: string, signal: AbortSignal) =>
      request('/rest/v1/rpc/may_use_reserved_byline', token, signal),
    updateProfile: async (
      token: string,
      signal: AbortSignal,
      data: { display_name?: string | null; share_license?: string | null },
    ) => accountUser(await request('/auth/v1/user', token, signal, { data }, 'PUT')),
    stopLiveViews: (token: string, signal: AbortSignal) =>
      request('/rest/v1/rpc/stop_all_live_views', token, signal),
    deleteAccount: async (token: string, signal: AbortSignal) => {
      const result = await request('/functions/v1/account-delete', token, signal);
      return (
        !!result && typeof result === 'object' && 'deleted' in result && result.deleted === true
      );
    },
  };
}
