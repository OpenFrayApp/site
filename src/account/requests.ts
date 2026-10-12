// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

/** Send narrowly scoped account effects using only the verified caller’s captured bearer token. */
export function accountRequests(
  url: string | undefined,
  publicKey: string | undefined,
  fetcher: typeof fetch,
) {
  /** Dispatch one authenticated request without resolving a different SDK session after an await. */
  async function request(
    path: string,
    token: string,
    signal: AbortSignal,
    body: object = {},
    method = 'POST',
  ) {
    if (!url || !publicKey) throw new Error('Accounts are unavailable. Reload and try again.');
    signal.throwIfAborted();
    const response = await fetcher(`${url.replace(/\/$/, '')}${path}`, {
      method,
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new Error('Account request failed. Please try again.');
    return response.json();
  }
  return {
    reservedByline: (token: string, signal: AbortSignal) =>
      request('/rest/v1/rpc/may_use_reserved_byline', token, signal),
    updateProfile: (
      token: string,
      signal: AbortSignal,
      data: { display_name?: string | null; share_license?: string | null },
    ) => request('/auth/v1/user', token, signal, { data }, 'PUT'),
    stopLiveViews: (token: string, signal: AbortSignal) =>
      request('/rest/v1/rpc/stop_all_live_views', token, signal),
    deleteAccount: (token: string, signal: AbortSignal) =>
      request('/functions/v1/account-delete', token, signal),
  };
}
