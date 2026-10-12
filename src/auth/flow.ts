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
        if (!cancelled) navigate(data.url);
      } catch {
        reset();
        status.textContent =
          'Could not start sign-in. Allow browser storage and choose a provider to try again.';
      }
    });
  });
}
