// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import AuthEntry from '../src/components/AuthEntry.astro';
import AuthCallback from '../src/components/AuthCallback.astro';
import { mountAuthEntry, completeAuthCallback } from '../src/auth/flow.ts';

/** Start a real entry attempt with only the external provider and navigation mocked. */
async function attempt(
  intent: 'sign-in' | 'sign-up' = 'sign-in',
  provider = 'google',
  returnTo = '/console/?fight=7#log',
) {
  const container = await AstroContainer.create();
  const html = await container.renderToString(AuthEntry, { props: { intent } });
  const window = new JSDOM(html, {
    url: `https://openfray.app/${intent}/?returnTo=${encodeURIComponent(returnTo)}`,
  }).window as unknown as Window;
  const auth = {
    signInWithOAuth: vi
      .fn()
      .mockResolvedValue({ data: { url: 'https://provider.example/' }, error: null }),
    setSession: vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { id: 'existing-user' } } }, error: null }),
  };
  const navigate = vi.fn();
  const getAuth = vi.fn(() => auth);
  const browser = { window, getAuth, navigate };
  mountAuthEntry(window.document.querySelector('main')!, browser);
  window.document.querySelector<HTMLButtonElement>(`[data-provider="${provider}"]`)!.click();
  await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
  const callbackUrl = auth.signInWithOAuth.mock.calls[0][0].options.redirectTo;
  window.document.body.innerHTML = await container.renderToString(AuthCallback);
  navigate.mockClear();
  getAuth.mockClear();
  const root = window.document.querySelector<HTMLElement>('main')!;
  return { browser, root, auth, callbackUrl };
}

it('completes only the originating attempt, scrubs auth material, and returns without tokens', async () => {
  const { browser, root, auth, callbackUrl } = await attempt();
  browser.window.history.replaceState(
    null,
    '',
    callbackUrl + '#access_token=access&refresh_token=refresh&token_type=bearer',
  );
  await completeAuthCallback(root, browser);
  expect(auth.setSession).toHaveBeenCalledWith({
    access_token: 'access',
    refresh_token: 'refresh',
  });
  expect(browser.window.location.href).toBe('https://openfray.app/auth/callback/');
  expect(browser.navigate).toHaveBeenCalledWith('/console/?fight=7#log');
});

it.each(['sign-in', 'sign-up'] as const)(
  'accepts new and existing users via every provider from %s',
  async (intent) => {
    for (const provider of ['google', 'discord', 'custom:patreon']) {
      for (const id of ['new-user', 'existing-user']) {
        const { browser, root, auth, callbackUrl } = await attempt(intent, provider);
        auth.setSession.mockResolvedValueOnce({ data: { session: { user: { id } } }, error: null });
        browser.window.history.replaceState(
          null,
          '',
          callbackUrl + '#access_token=access&refresh_token=refresh',
        );
        await completeAuthCallback(root, browser);
        expect(browser.navigate).toHaveBeenCalledWith('/console/?fight=7#log');
      }
    }
  },
);

it.each([
  '#error=access_denied&error_description=secret',
  '?error=access_denied',
  '',
  '#access_token=access',
  '#refresh_token=refresh',
  '#access_token=one&access_token=two&refresh_token=refresh',
])(
  'discards cancellation or incomplete callback material %s without installing a session',
  async (material) => {
    const { browser, root, auth, callbackUrl } = await attempt();
    const url = material.startsWith('?')
      ? callbackUrl + '&' + material.slice(1)
      : callbackUrl + material;
    browser.window.history.replaceState(null, '', url);
    await completeAuthCallback(root, browser);
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(browser.getAuth).not.toHaveBeenCalled();
    expect(browser.navigate).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Try signing in again');
    expect(root.textContent).not.toContain('secret');
    expect(root.querySelector('[data-auth-retry]')?.getAttribute('href')).toBe(
      '/sign-in/?returnTo=%2Fconsole%2F%3Ffight%3D7%23log',
    );
    expect(browser.window.location.href).toBe('https://openfray.app/auth/callback/');
  },
);

it('consumes a callback once even if it is replayed or the page reloads', async () => {
  const { browser, root, auth, callbackUrl } = await attempt();
  const url = callbackUrl + '#access_token=access&refresh_token=refresh';
  browser.window.history.replaceState(null, '', url);
  await completeAuthCallback(root, browser);
  browser.navigate.mockClear();
  browser.window.history.replaceState(null, '', url);
  await completeAuthCallback(root, browser);
  expect(auth.setSession).toHaveBeenCalledTimes(1);
  expect(browser.navigate).not.toHaveBeenCalled();
  await completeAuthCallback(root, browser);
  expect(auth.setSession).toHaveBeenCalledTimes(1);
});

it.each(['wrong', 'missing', 'stale', 'future', 'bad-version', 'bad-json', 'duplicate'])(
  'rejects a %s attempt before creating a client, regardless of an existing session',
  async (problem) => {
    const { browser, root, auth, callbackUrl } = await attempt();
    const url = new URL(callbackUrl);
    const storage = browser.window.sessionStorage;
    const stored = JSON.parse(storage.getItem('openfray-oauth-attempt')!);
    if (problem === 'wrong') url.searchParams.set('attempt', 'unrelated-attempt');
    if (problem === 'missing') storage.clear();
    if (problem === 'stale') stored.startedAt = Date.now() - 10 * 60 * 1000;
    if (problem === 'future') stored.startedAt = Date.now() + 60 * 1000;
    if (problem === 'bad-version') stored.version = 2;
    if (['stale', 'future', 'bad-version'].includes(problem))
      storage.setItem('openfray-oauth-attempt', JSON.stringify(stored));
    if (problem === 'bad-json') storage.setItem('openfray-oauth-attempt', '{');
    if (problem === 'duplicate') url.searchParams.append('attempt', stored.attemptId);
    url.hash = 'access_token=access&refresh_token=refresh';
    browser.window.history.replaceState(null, '', url);
    await completeAuthCallback(root, browser);
    expect(browser.getAuth).not.toHaveBeenCalled();
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(browser.navigate).not.toHaveBeenCalled();
    expect(browser.window.location.href).toBe('https://openfray.app/auth/callback/');
  },
);

it.each(['error', 'throw', 'no-session'])(
  'does not treat a %s completion as success and offers a fresh attempt',
  async (problem) => {
    const { browser, root, auth, callbackUrl } = await attempt();
    if (problem === 'throw') auth.setSession.mockRejectedValueOnce(new Error('secret'));
    else
      auth.setSession.mockResolvedValueOnce({
        data: { session: null },
        error: problem === 'error' ? { message: 'secret' } : null,
      });
    browser.window.history.replaceState(
      null,
      '',
      callbackUrl + '#access_token=access&refresh_token=refresh',
    );
    await completeAuthCallback(root, browser);
    expect(browser.navigate).not.toHaveBeenCalled();
    expect(root.querySelector('[data-auth-status]')?.textContent).toContain('Try signing in again');
    expect(root.textContent).not.toContain('secret');
    browser.window.history.replaceState(
      null,
      '',
      callbackUrl + '#access_token=access&refresh_token=refresh',
    );
    await completeAuthCallback(root, browser);
    expect(auth.setSession).toHaveBeenCalledTimes(1);
  },
);

it('revalidates a stored return before navigation', async () => {
  const { browser, root, callbackUrl } = await attempt();
  const storage = browser.window.sessionStorage;
  const stored = JSON.parse(storage.getItem('openfray-oauth-attempt')!);
  stored.returnTo = '//evil.example/';
  storage.setItem('openfray-oauth-attempt', JSON.stringify(stored));
  browser.window.history.replaceState(
    null,
    '',
    callbackUrl + '#access_token=access&refresh_token=refresh',
  );
  await completeAuthCallback(root, browser);
  expect(browser.navigate).toHaveBeenCalledWith('/account/');
});

it.each(['getItem', 'removeItem'])(
  'fails closed when callback storage %s is denied',
  async (method) => {
    const { browser, root, auth, callbackUrl } = await attempt();
    vi.spyOn(Object.getPrototypeOf(browser.window.sessionStorage), method).mockImplementation(
      () => {
        throw new Error('denied');
      },
    );
    browser.window.history.replaceState(
      null,
      '',
      callbackUrl + '#access_token=access&refresh_token=refresh',
    );
    await completeAuthCallback(root, browser);
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(browser.getAuth).not.toHaveBeenCalled();
    expect(browser.navigate).not.toHaveBeenCalled();
    expect(browser.window.location.hash).toBe('');
    vi.restoreAllMocks();
  },
);

it('consumes before the network completes so concurrent replay cannot install twice', async () => {
  const { browser, root, auth, callbackUrl } = await attempt();
  auth.setSession.mockReturnValueOnce(new Promise(() => {}));
  const href = callbackUrl + '#access_token=access&refresh_token=refresh';
  void completeAuthCallback(root, browser, href);
  await completeAuthCallback(root, browser, href);
  expect(auth.setSession).toHaveBeenCalledTimes(1);
});

it('uses the account fallback for direct entry', async () => {
  const { browser, root, callbackUrl } = await attempt('sign-up', 'custom:patreon', '');
  await completeAuthCallback(
    root,
    browser,
    callbackUrl + '#access_token=access&refresh_token=refresh',
  );
  expect(browser.navigate).toHaveBeenCalledWith('/account/');
});

it('discards an abandoned handoff when the entry page reloads, so its later callback cannot install a session', async () => {
  const { browser, root, auth, callbackUrl } = await attempt();
  const container = await AstroContainer.create();
  browser.window.history.replaceState(null, '', '/sign-in/?returnTo=%2Fconsole%2F');
  browser.window.document.body.innerHTML = await container.renderToString(AuthEntry, {
    props: { intent: 'sign-in' },
  });
  mountAuthEntry(browser.window.document.querySelector('main')!, browser);
  await completeAuthCallback(
    root,
    browser,
    callbackUrl + '#access_token=access&refresh_token=refresh',
  );
  expect(auth.setSession).not.toHaveBeenCalled();
  expect(browser.getAuth).not.toHaveBeenCalled();
  expect(browser.navigate).not.toHaveBeenCalled();
});
