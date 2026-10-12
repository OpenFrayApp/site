// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import type { SupabaseClient } from '@supabase/supabase-js';
import { validateReturnTo } from './returnTo.ts';

export interface AuthBrowser {
  window: Window;
  getAuth: () => Pick<SupabaseClient['auth'], 'signInWithOAuth' | 'setSession'>;
  navigate: (destination: string) => void;
}

const attemptKey = 'openfray-oauth-attempt';
type OAuthProvider = 'google' | 'discord' | 'custom:patreon';

/** Connect provider controls to a tab-bound OAuth handoff. */
export function mountAuthEntry(root: HTMLElement, browser: AuthBrowser) {
  const { window, getAuth, navigate } = browser;
  const returnTo = validateReturnTo(
    new URL(window.location.href).searchParams.get('returnTo'),
    window.location.origin,
  );
  const cancelLink = root.querySelector<HTMLAnchorElement>('[data-auth-cancel]')!;
  cancelLink.href = returnTo;
  const switchLink = root.querySelector<HTMLAnchorElement>('[data-auth-switch]')!;
  switchLink.setAttribute(
    'href',
    `${switchLink.getAttribute('href')}?returnTo=${encodeURIComponent(returnTo)}`,
  );
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-provider]')];
  const status = root.querySelector<HTMLElement>('[data-auth-status]')!;
  let busy = false;
  let cancelled = false;
  let handoffGeneration = 0;

  /** Remove an abandoned attempt without assuming browser storage is available. */
  function discardAttempt() {
    try {
      window.sessionStorage.removeItem(attemptKey);
    } catch {
      /* Storage denial blocks the next handoff. */
    }
  }

  /** Restore usable provider controls after a failed or abandoned handoff. */
  function reset() {
    handoffGeneration += 1;
    cancelled = false;
    busy = false;
    buttons.forEach((button) => {
      button.disabled = false;
    });
    discardAttempt();
  }

  reset();
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      reset();
      status.textContent = 'Sign-in canceled. Choose a provider to try again.';
    }
  });
  [cancelLink, switchLink].forEach((link) =>
    link.addEventListener('click', () => {
      cancelled = true;
      discardAttempt();
    }),
  );

  buttons.forEach((button) => {
    button.addEventListener('click', async () => {
      if (busy || cancelled) return;
      busy = true;
      const generation = ++handoffGeneration;
      buttons.forEach((button) => {
        button.disabled = true;
      });
      status.textContent = 'Opening your provider…';
      try {
        const attemptId = window.crypto.randomUUID();
        window.sessionStorage.setItem(
          attemptKey,
          JSON.stringify({ version: 1, attemptId, returnTo, startedAt: Date.now() }),
        );
        const redirectTo = new URL('/auth/callback/', window.location.origin);
        redirectTo.searchParams.set('attempt', attemptId);
        const { data, error } = await getAuth().signInWithOAuth({
          provider: button.dataset.provider as OAuthProvider,
          options: { redirectTo: redirectTo.href, skipBrowserRedirect: true },
        });
        if (error || !data.url) throw new Error('OAuth handoff failed');
        if (!cancelled && generation === handoffGeneration) navigate(data.url);
      } catch {
        if (generation !== handoffGeneration || cancelled) return;
        reset();
        status.textContent =
          'Could not start sign-in. Allow browser storage and choose a provider to try again.';
      }
    });
  });
}

/** Consume a matching tab attempt before explicitly installing its implicit-flow session. */
export async function completeAuthCallback(
  root: HTMLElement,
  browser: AuthBrowser,
  callbackHref = browser.window.location.href,
) {
  const { window, getAuth, navigate } = browser;
  const callback = new URL(callbackHref);
  window.history.replaceState(null, '', '/auth/callback/');
  const status = root.querySelector<HTMLElement>('[data-auth-status]')!;
  try {
    const stored = window.sessionStorage.getItem(attemptKey);
    window.sessionStorage.removeItem(attemptKey);
    const attempt = stored ? JSON.parse(stored) : null;
    if (
      !attempt ||
      attempt.version !== 1 ||
      typeof attempt.attemptId !== 'string' ||
      !/^[\w-]{20,}$/.test(attempt.attemptId) ||
      callback.origin !== window.location.origin ||
      callback.pathname !== '/auth/callback/' ||
      callback.searchParams.getAll('attempt').length !== 1 ||
      attempt.attemptId !== callback.searchParams.get('attempt') ||
      !Number.isFinite(attempt.startedAt) ||
      attempt.startedAt > Date.now() ||
      Date.now() - attempt.startedAt >= 10 * 60 * 1000 ||
      typeof attempt.returnTo !== 'string'
    )
      throw new Error('Unmatched or expired attempt');
    const returnTo = validateReturnTo(attempt.returnTo, window.location.origin);
    root
      .querySelector<HTMLAnchorElement>('[data-auth-retry]')!
      .setAttribute('href', `/sign-in/?returnTo=${encodeURIComponent(returnTo)}`);
    const tokens = new URLSearchParams(callback.hash.slice(1));
    if (
      callback.searchParams.has('error') ||
      tokens.has('error') ||
      tokens.getAll('access_token').length !== 1 ||
      tokens.getAll('refresh_token').length !== 1 ||
      !tokens.get('access_token') ||
      !tokens.get('refresh_token')
    )
      throw new Error('Canceled or incomplete callback');
    const { data, error } = await getAuth().setSession({
      access_token: tokens.get('access_token')!,
      refresh_token: tokens.get('refresh_token')!,
    });
    if (error || !data.session) throw new Error('Incomplete sign-in');
    navigate(validateReturnTo(attempt.returnTo, window.location.origin));
  } catch {
    status.textContent = 'Sign-in was canceled or could not be completed. Try signing in again.';
  }
}
