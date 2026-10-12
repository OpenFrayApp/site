// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import AuthEntry from '../src/components/AuthEntry.astro';
import { mountAuthEntry } from '../src/auth/flow.ts';

/** Render the entry page and connect its browser behavior to a mocked provider boundary. */
async function entry(
  intent: 'sign-in' | 'sign-up' = 'sign-in',
  returnTo = '/console/?fight=7#log',
) {
  const container = await AstroContainer.create();
  const html = await container.renderToString(AuthEntry, { props: { intent } });
  const dom = new JSDOM(html, {
    url: `https://openfray.app/${intent}/?returnTo=${encodeURIComponent(returnTo)}`,
  });
  const window = dom.window as unknown as Window;
  const document = window.document;
  const auth = {
    signInWithOAuth: vi
      .fn()
      .mockResolvedValue({ data: { url: 'https://provider.example/authorize' }, error: null }),
    setSession: vi.fn(),
  };
  const navigate = vi.fn();
  mountAuthEntry(document.querySelector('main')!, { window, getAuth: () => auth, navigate });
  return { auth, navigate, window, document };
}

it('hands Google authentication to the provider with an attempt-bound site callback', async () => {
  const { auth, navigate, document } = await entry();
  document.querySelector<HTMLButtonElement>('[data-provider="google"]')!.click();
  await vi.waitFor(() =>
    expect(navigate).toHaveBeenCalledWith('https://provider.example/authorize'),
  );
  const options = auth.signInWithOAuth.mock.calls[0][0];
  expect(options.provider).toBe('google');
  expect(options.options.skipBrowserRedirect).toBe(true);
  const callback = new URL(options.options.redirectTo);
  expect(callback.pathname).toBe('/auth/callback/');
  expect(callback.searchParams.get('attempt')).toMatch(/^[\w-]{20,}$/);
  expect(callback.searchParams.has('returnTo')).toBe(false);
});

it.each([
  '',
  'https://evil.example/console/',
  '//evil.example/',
  '///evil.example/',
  '/\\evil.example/',
  '/console/\n',
  '/console/%',
  '/console/%zz',
  '/console/%C0%AF',
  '/%2f%2fevil.example/',
  '/%5cevil.example/',
  '/console/%00',
  '/console/%7f',
  '/%252f%252fevil.example/',
  '/sign-in/',
  '/sign-up?x=1',
  '/auth/callback/#secret',
  '/console/../sign-in/',
  '/sign%2din/',
  '/auth/callback',
])('offers the account fallback for unsafe or looping return %j', async (returnTo) => {
  const { document } = await entry('sign-in', returnTo);
  expect(document.querySelector('a[data-auth-cancel]')?.getAttribute('href')).toBe('/account/');
});

it('preserves a same-origin path, query, and fragment across entry switching and cancellation', async () => {
  const { document } = await entry();
  expect(document.querySelector('a[data-auth-cancel]')?.getAttribute('href')).toBe(
    '/console/?fight=7#log',
  );
  expect(document.querySelector('a[data-auth-switch]')?.getAttribute('href')).toBe(
    '/sign-up/?returnTo=%2Fconsole%2F%3Ffight%3D7%23log',
  );
});

it.each(['sign-in', 'sign-up'] as const)(
  'offers every provider and accessible notices on %s without newsletter fields',
  async (intent) => {
    const { document } = await entry(intent);
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.body.textContent).toContain(
      intent === 'sign-in' ? 'First time here?' : 'Already have an account?',
    );
    expect(document.body.textContent).toContain('at least 13');
    expect(document.querySelector('a[href="/terms/"]')).not.toBeNull();
    expect(document.querySelector('a[href="/privacy/"]')).not.toBeNull();
    expect(document.querySelectorAll('input')).toHaveLength(0);
    expect([...document.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Continue with Google',
      'Continue with Discord',
      'Continue with Patreon',
    ]);
  },
);

it.each(['google', 'discord', 'custom:patreon'])(
  'recovers a failed %s handoff with a fresh retry',
  async (provider) => {
    const { auth, navigate, document } = await entry('sign-up');
    auth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: { message: 'provider offline' },
    });
    const button = document.querySelector<HTMLButtonElement>(`[data-provider="${provider}"]`)!;
    button.click();
    await vi.waitFor(() =>
      expect(document.querySelector('[role="status"]')?.textContent).toContain('try again'),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    const failedAttempt = new URL(
      auth.signInWithOAuth.mock.calls[0][0].options.redirectTo,
    ).searchParams.get('attempt');
    button.click();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(auth.signInWithOAuth.mock.calls[1][0].provider).toBe(provider);
    expect(
      new URL(auth.signInWithOAuth.mock.calls[1][0].options.redirectTo).searchParams.get('attempt'),
    ).not.toBe(failedAttempt);
  },
);

it('does not contact the provider when tab storage is denied', async () => {
  const { auth, navigate, document, window } = await entry();
  vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  // jsdom storage methods are defined on the prototype.
  vi.spyOn(Object.getPrototypeOf(window.sessionStorage), 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  document.querySelector<HTMLButtonElement>('[data-provider="google"]')!.click();
  await vi.waitFor(() =>
    expect(document.querySelector('[role="status"]')?.textContent).toContain('try again'),
  );
  expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

it('blocks repeat clicks while the provider handoff is pending', async () => {
  const { auth, document } = await entry();
  auth.signInWithOAuth.mockReturnValue(new Promise(() => {}));
  document.querySelector<HTMLButtonElement>('[data-provider="google"]')!.click();
  document.querySelector<HTMLButtonElement>('[data-provider="discord"]')!.click();
  expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1);
  expect([...document.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
});
