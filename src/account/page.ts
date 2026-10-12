// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { validateReturnTo } from '../auth/returnTo.ts';
import { signOutAccountSession } from './signOut.ts';
import { accountRequests } from './requests.ts';
import { bylineError, BYLINE_MAX } from '../../../console/src/lib/byline.ts';

type Dependencies = {
  window: Window;
  getClient: () => SupabaseClient;
  url: string | undefined;
  publicKey: string | undefined;
  fetch: typeof fetch;
  navigate: (destination: string) => void;
  signOut?: typeof signOutAccountSession;
};
const CHANGED = 'Your session changed. Sign in again to manage your account.';

/** Mount the site-owned account boundary with validated navigation and verified identity generations. */
export function mountAccount(root: HTMLElement, dependencies: Dependencies) {
  const { window, navigate, getClient } = dependencies;
  const returnTo = validateReturnTo(
    new URL(window.location.href).searchParams.get('returnTo'),
    window.location.origin,
  );
  const accountDestination =
    returnTo === '/account/' ? '/account/' : `/account/?returnTo=${encodeURIComponent(returnTo)}`;
  const signInDestination = `/sign-in/?returnTo=${encodeURIComponent(accountDestination)}`;
  const returnLink = root.querySelector<HTMLAnchorElement>('[data-account-return]')!;
  const signInLink = root.querySelector<HTMLAnchorElement>('[data-account-sign-in]')!;
  const status = root.querySelector<HTMLElement>('[data-account-status]')!;
  const fieldset = root.querySelector<HTMLFieldSetElement>('fieldset')!;
  const identity = root.querySelector<HTMLElement>('[data-account-identity]')!;
  const provider = root.querySelector<HTMLElement>('[data-account-provider]')!;
  returnLink.href = returnTo;
  signInLink.href = signInDestination;
  const requests = accountRequests(dependencies.url, dependencies.publicKey, dependencies.fetch);
  const onReturn = (event: Event) => {
    event.preventDefault();
    navigate(validateReturnTo(returnTo, window.location.origin));
  };
  returnLink.addEventListener('click', onReturn);
  let client: SupabaseClient;
  let generation = 0;
  let session: Session | null = null;
  let user: User | null = null;
  let disposed = false;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let operation = new AbortController();
  let allowReserved = false;
  let endingGeneration: number | null = null;
  let endedGeneration: number | null = null;
  const nameInput = root.querySelector<HTMLInputElement>('#display-name')!;
  const nameForm = root.querySelector<HTMLFormElement>('[data-account-name-form]')!;
  nameInput.maxLength = BYLINE_MAX + 1;
  const confirmEmail = root.querySelector<HTMLInputElement>('[data-account-confirm-email]')!;
  const deleteButton = root.querySelector<HTMLButtonElement>('[data-account-delete]')!;
  const deleteForm = root.querySelector<HTMLFormElement>('[data-account-delete-form]')!;

  /** Require a nonempty verified email before permitting irreversible deletion. */
  function confirmed(email = user?.email) {
    return !!email && confirmEmail.value.trim().toLowerCase() === email.toLowerCase();
  }

  /** Update the deletion affordance as the typed current email changes. */
  function updateConfirmation() {
    deleteButton.disabled = !confirmed();
  }
  confirmEmail.addEventListener('input', updateConfirmation);

  /** Test whether an asynchronous reply still belongs to the current unexpired generation. */
  function current(captured: number) {
    return (
      !disposed &&
      captured === generation &&
      !!session &&
      (!session.expires_at || session.expires_at * 1000 > Date.now())
    );
  }

  /** Replace account identity immediately, then verify it without accepting metadata as authorization. */
  async function observe(next: Session | null, initial = false) {
    const captured = ++generation;
    operation.abort();
    operation = new AbortController();
    clearTimeout(expiry);
    session = next;
    user = null;
    allowReserved = false;
    nameInput.value = '';
    confirmEmail.value = '';
    deleteButton.disabled = true;
    fieldset.disabled = true;
    identity.textContent = '';
    provider.textContent = '';
    signInLink.hidden = false;
    if (!next || (next.expires_at && next.expires_at * 1000 <= Date.now())) {
      session = null;
      status.textContent = CHANGED;
      if (initial) navigate(signInDestination);
      return;
    }
    status.textContent = 'Checking your account…';
    try {
      const verified = await client.auth.getUser(next.access_token);
      if (!current(captured)) return;
      if (verified.error || !verified.data.user || verified.data.user.id !== next.user.id)
        throw new Error(CHANGED);
      const grant = await requests
        .reservedByline(next.access_token, operation.signal)
        .catch(() => false);
      if (!current(captured)) return;
      allowReserved = grant === true;
      user = verified.data.user;
      const metadata = user.user_metadata;
      const name = metadata.display_name ?? metadata.full_name ?? metadata.name;
      nameInput.value = typeof name === 'string' ? name : '';
      identity.textContent = user.email ?? 'No account email available';
      const providerId = user.app_metadata.provider;
      provider.textContent =
        (
          { google: 'Google', discord: 'Discord', 'custom:patreon': 'Patreon' } as Record<
            string,
            string
          >
        )[providerId ?? ''] ?? 'identity provider';
      fieldset.disabled = false;
      signInLink.hidden = true;
      status.textContent = '';
      if (next.expires_at)
        expiry = setTimeout(
          () => {
            void observe(null);
          },
          Math.min(next.expires_at * 1000 - Date.now(), 2147483647),
        );
    } catch {
      if (current(captured))
        status.textContent =
          'Your account could not be verified. Sign in again or reload to retry.';
    }
  }

  /** Verify the captured identity again before a privileged effect, including its native current session. */
  async function verifiedCurrent(captured: number) {
    if (!current(captured) || !session || !user) throw new Error(CHANGED);
    const expected = session;
    const stored = await client.auth.getSession();
    if (!current(captured)) throw new Error(CHANGED);
    if (
      stored.error ||
      stored.data.session?.access_token !== expected.access_token ||
      stored.data.session?.refresh_token !== expected.refresh_token ||
      stored.data.session?.user.id !== expected.user.id
    ) {
      void observe(stored.data.session);
      throw new Error(CHANGED);
    }
    const verified = await client.auth.getUser(expected.access_token);
    if (!current(captured) || verified.error || verified.data.user?.id !== expected.user.id)
      throw new Error(CHANGED);
    return { session: expected, user: verified.data.user };
  }

  /** Save one display name with the publishing validator and re-read the authenticated profile. */
  async function saveName(event: Event) {
    event.preventDefault();
    if (fieldset.disabled || !user) return;
    const name = nameInput.value.trim();
    const problem = name ? bylineError(name, { allowReserved }) : null;
    if (problem) {
      status.textContent = problem;
      return;
    }
    const captured = generation;
    fieldset.disabled = true;
    status.textContent = 'Saving…';
    try {
      const verified = await verifiedCurrent(captured);
      const result = await requests.updateProfile(verified.session.access_token, operation.signal, {
        display_name: name || null,
      });
      if (!current(captured)) return;
      if (result?.id !== verified.user.id)
        throw new Error('Your profile could not be saved. Reload and try again.');
      const updated = await client.auth.getUser(verified.session.access_token);
      if (!current(captured)) return;
      if (updated.error || updated.data.user?.id !== verified.user.id)
        throw new Error('Your profile could not be verified. Reload to check it.');
      user = updated.data.user;
      fieldset.disabled = false;
      status.textContent = name ? 'Saved.' : 'Cleared. Encounters publish unsigned.';
    } catch (error) {
      if (!current(captured)) return;
      fieldset.disabled = false;
      status.textContent =
        error instanceof Error ? error.message : 'Your profile could not be saved. Try again.';
    }
  }
  nameForm.addEventListener('submit', saveName);

  /** Revoke live-view publication before asking the guarded SDK to end the same verified session. */
  async function signOut() {
    if (fieldset.disabled || !user) return;
    const captured = generation;
    fieldset.disabled = true;
    status.textContent = 'Signing out…';
    try {
      const verified = await verifiedCurrent(captured);
      try {
        await requests.stopLiveViews(verified.session.access_token, operation.signal);
      } catch {
        throw new Error(
          'Live views could not be stopped. You are still signed in. Try signing out again.',
        );
      }
      if (!current(captured)) return;
      endingGeneration = captured;
      await (dependencies.signOut ?? signOutAccountSession)(client, verified.session, () =>
        current(captured),
      );
      endingGeneration = null;
      if (!current(captured) && endedGeneration !== captured) return;
      await observe(null);
      status.textContent = 'Signed out.';
    } catch (error) {
      if (!current(captured)) return;
      fieldset.disabled = false;
      status.textContent = error instanceof Error ? error.message : 'Sign-out failed. Try again.';
    } finally {
      endingGeneration = null;
    }
  }
  /** Invoke existing empty-body erasure, require its explicit success, then clean up only this local session. */
  async function deleteAccount(event: Event) {
    event.preventDefault();
    if (fieldset.disabled || !confirmed()) return;
    const captured = generation;
    fieldset.disabled = true;
    status.textContent = 'Deleting account…';
    try {
      const verified = await verifiedCurrent(captured);
      if (!confirmed(verified.user.email))
        throw new Error(
          'Your account email changed. Check it and type your current email to confirm.',
        );
      const result = await requests
        .deleteAccount(verified.session.access_token, operation.signal)
        .catch(() => null);
      if (!current(captured)) return;
      if (result?.deleted !== true)
        throw new Error(
          'Account deletion could not be confirmed. Check your account before trying again.',
        );
      endingGeneration = captured;
      await (dependencies.signOut ?? signOutAccountSession)(
        client,
        verified.session,
        () => current(captured),
        'local',
      ).catch(() => {});
      endingGeneration = null;
      if (!current(captured) && endedGeneration !== captured) return;
      await observe(null);
      status.textContent =
        'Account deleted. If session cleanup failed, sign in again before using another account.';
    } catch (error) {
      if (!current(captured)) return;
      fieldset.disabled = false;
      status.textContent =
        error instanceof Error ? error.message : 'Account deletion failed. Try again.';
    } finally {
      endingGeneration = null;
    }
  }
  deleteForm.addEventListener('submit', deleteAccount);
  const signOutButton = root.querySelector<HTMLButtonElement>('[data-account-sign-out]')!;
  signOutButton.addEventListener('click', signOut);

  try {
    client = getClient();
  } catch {
    status.textContent = 'Accounts are unavailable. Check browser storage and reload to retry.';
    return () => returnLink.removeEventListener('click', onReturn);
  }
  const subscription = client.auth.onAuthStateChange((event, next) => {
    endedGeneration = !next && endingGeneration === generation ? endingGeneration : null;
    void observe(next, event === 'INITIAL_SESSION' && generation === 0);
  }).data.subscription;
  const initialGeneration = generation;
  void client.auth
    .getSession()
    .then(({ data, error }) => {
      if (disposed || generation !== initialGeneration) return;
      if (error) {
        status.textContent = 'Your session could not be read. Sign in again or reload to retry.';
        return;
      }
      void observe(data.session, true);
    })
    .catch(() => {
      if (!disposed) status.textContent = 'Your session could not be read. Reload to retry.';
    });
  return () => {
    disposed = true;
    generation++;
    operation.abort();
    signOutButton.removeEventListener('click', signOut);
    confirmEmail.removeEventListener('input', updateConfirmation);
    deleteForm.removeEventListener('submit', deleteAccount);
    nameForm.removeEventListener('submit', saveName);
    clearTimeout(expiry);
    subscription.unsubscribe();
    returnLink.removeEventListener('click', onReturn);
  };
}
