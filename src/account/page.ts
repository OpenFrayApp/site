// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { validateReturnTo } from '../auth/returnTo.ts';
import { readAccountSession, signOutAccountSession } from './signOut.ts';
import { accountRequests, type AccountUser } from './requests.ts';
import { bylineError, BYLINE_MAX } from '../../../console/src/lib/byline.ts';
import {
  isContentLicense,
  LICENSE_HINTS,
  LICENSES_FROM_SCRATCH,
} from '../../../console/src/schema/contentLicense.ts';

type Dependencies = {
  window: Window;
  getClient: () => SupabaseClient;
  url: string | undefined;
  publicKey: string | undefined;
  fetch: typeof fetch;
  navigate: (destination: string) => void;
  signOut?: typeof signOutAccountSession;
  readSession?: (client: SupabaseClient) => Session | null | Promise<Session | null>;
};
const CHANGED = 'Your session changed. Sign in again to manage your account.';

/** Read the existing custom-name override and provider fallback without treating metadata as authority. */
function displayName(user: AccountUser) {
  const metadata = user.user_metadata;
  const name = metadata.display_name ?? metadata.full_name ?? metadata.name;
  return typeof name === 'string' ? name : '';
}

/** Compare observed session credentials without deriving authorization from stored metadata. */
function sameSession(left: Session, right: Session) {
  return (
    left.user.id === right.user.id &&
    left.access_token === right.access_token &&
    left.refresh_token === right.refresh_token
  );
}

/** Mount the site-owned account boundary with validated navigation and verified identity generations. */
export function mountAccount(root: HTMLElement, dependencies: Dependencies) {
  const { window, navigate, getClient } = dependencies;
  const returnTo = validateReturnTo(
    new URL(window.location.href).searchParams.get('returnTo'),
    window.location.origin,
  );
  // The strict OAuth validator rejects escaped slashes even inside nested query values.
  const accountDestination =
    returnTo === '/account/'
      ? '/account/'
      : `/account/?returnTo=${encodeURIComponent(returnTo).replace(/%2F/g, '/')}`;
  const signInDestination = `/sign-in/?returnTo=${encodeURIComponent(accountDestination)}`;
  const consoleReturnTo = /^\/console(?:\/|$)/.test(
    new URL(returnTo, window.location.origin).pathname,
  )
    ? returnTo
    : '/console/';
  const signedOutDestination = `/sign-in/?returnTo=${encodeURIComponent(consoleReturnTo)}`;
  const returnLink = root.querySelector<HTMLAnchorElement>('[data-account-return]')!;
  const signInLink = root.querySelector<HTMLAnchorElement>('[data-account-sign-in]')!;
  const status = root.querySelector<HTMLElement>('[data-account-status]')!;
  const fieldset = root.querySelector<HTMLFieldSetElement>('fieldset')!;
  const signOutButton = root.querySelector<HTMLButtonElement>('[data-account-sign-out]')!;
  /** Lock account actions together while keeping the console return link reachable. */
  function setControlsDisabled(disabled: boolean) {
    fieldset.disabled = disabled;
    signOutButton.disabled = disabled;
  }
  const identity = root.querySelector<HTMLElement>('[data-account-identity]')!;
  const provider = root.querySelector<HTMLElement>('[data-account-provider]')!;
  returnLink.href = consoleReturnTo;
  signInLink.href = signInDestination;
  const requests = accountRequests(dependencies.url, dependencies.publicKey, dependencies.fetch);
  /** Revalidate the initiating destination immediately before the return action. */
  const onReturn = (event: Event) => {
    event.preventDefault();
    navigate(validateReturnTo(consoleReturnTo, window.location.origin));
  };
  returnLink.addEventListener('click', onReturn);
  let client: SupabaseClient;
  let generation = 0;
  let session: Session | null = null;
  let user: AccountUser | null = null;
  let disposed = false;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let operation = new AbortController();
  let allowReserved = false;
  let endingGeneration: number | null = null;
  let endedGeneration: number | null = null;
  let endingMessage = '';
  let authEventGeneration = 0;
  const licenseSelect = root.querySelector<HTMLSelectElement>('#share-license-default')!;
  const licenseHint = root.querySelector<HTMLElement>('[data-account-license-hint]')!;
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
    licenseSelect.value = 'unstated';
    licenseHint.textContent = '';
    confirmEmail.value = '';
    deleteButton.disabled = true;
    setControlsDisabled(true);
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
      const verified = await requests.verifyUser(next.access_token, operation.signal);
      if (!current(captured)) return;
      if (verified.id !== next.user.id) throw new Error(CHANGED);
      if (await refreshReplacement(captured, next)) return;
      const grant = await requests
        .reservedByline(next.access_token, operation.signal)
        .catch(() => false);
      if (!current(captured) || (await refreshReplacement(captured, next))) return;
      allowReserved = grant === true;
      user = verified;
      const metadata = user.user_metadata;
      nameInput.value = displayName(user);
      const license = isContentLicense(metadata.share_license)
        ? metadata.share_license
        : 'unstated';
      licenseSelect.value = license;
      licenseHint.textContent = LICENSE_HINTS[license];
      identity.textContent = user.email ?? 'No account email available';
      const providerId = user.app_metadata.provider;
      provider.textContent =
        (
          { google: 'Google', discord: 'Discord', 'custom:patreon': 'Patreon' } as Record<
            string,
            string
          >
        )[providerId ?? ''] ?? 'identity provider';
      setControlsDisabled(false);
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
      if (current(captured) && !(await refreshReplacement(captured, next)))
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
      void observe(stored.error ? null : stored.data.session);
      throw new Error(CHANGED);
    }
    let verified: AccountUser;
    try {
      verified = await requests.verifyUser(expected.access_token, operation.signal);
      if (
        !current(captured) ||
        verified.id !== expected.user.id ||
        (await refreshReplacement(captured, expected))
      )
        throw new Error(CHANGED);
    } catch {
      if (current(captured) && !(await refreshReplacement(captured, expected))) void observe(null);
      throw new Error(CHANGED);
    }
    if (user.email !== verified.email) {
      confirmEmail.value = '';
      deleteButton.disabled = true;
    }
    user = verified;
    identity.textContent = user.email ?? 'No account email available';
    return { session: expected, user };
  }

  /** Re-read native SDK state before applying an account reply to an unannounced replacement or renewal. */
  async function refreshReplacement(captured: number, expected: Session, allowMissing = false) {
    if (!current(captured)) return true;
    const before = generation;
    let actual: Session | null;
    try {
      actual = await (dependencies.readSession ?? readAccountSession)(client);
    } catch {
      if (!disposed && before === generation) {
        void observe(null);
        status.textContent = 'Your session could not be read. Sign in again or reload to retry.';
      }
      return true;
    }
    if (disposed || before !== generation) return true;
    if ((!actual && !allowMissing) || (actual && !sameSession(actual, expected))) {
      void observe(actual);
      return true;
    }
    return false;
  }

  /** Accept a null event only after native storage confirms absence, retaining any present current identity. */
  async function reconcileNull(eventGeneration: number, initial: boolean) {
    const captured = generation;
    let actual: Session | null;
    try {
      actual = await (dependencies.readSession ?? readAccountSession)(client);
    } catch {
      if (!disposed && generation === captured && authEventGeneration === eventGeneration) {
        endedGeneration = null;
        void observe(null);
        status.textContent = 'Your session could not be read. Sign in again or reload to retry.';
      }
      return;
    }
    if (disposed || generation !== captured || authEventGeneration !== eventGeneration) return;
    if (actual) {
      endedGeneration = null;
      if (!session || !sameSession(actual, session) || !current(captured))
        void observe(actual, initial);
      return;
    }
    endedGeneration = endingGeneration === captured ? captured : null;
    void observe(null, initial);
    if (endedGeneration !== null) status.textContent = endingMessage;
  }

  /** Publish a cleanup outcome only after reconciling native identity, including after an own null event. */
  async function finishCleanup(
    captured: number,
    expected: Session | null,
    message: string,
    allowExpected = false,
    destination?: string,
  ) {
    if (!current(captured) && endedGeneration !== captured) return;
    for (let attempt = 0; attempt < 2; attempt++) {
      const before = generation;
      let actual: Session | null;
      try {
        actual = await (dependencies.readSession ?? readAccountSession)(client);
      } catch {
        if (!disposed && generation === before) {
          void observe(null);
          status.textContent = 'Your session could not be read. Sign in again or reload to retry.';
        }
        return;
      }
      if (disposed) return;
      if (generation !== before) {
        if (attempt === 0 && endedGeneration === captured && !session) continue;
        return;
      }
      if (actual && (!allowExpected || !expected || !sameSession(actual, expected))) {
        endedGeneration = null;
        void observe(actual);
        return;
      }
      void observe(null);
      status.textContent = message;
      if (destination) navigate(destination);
      return;
    }
  }

  /** Save one display name with the publishing validator and re-read the authenticated profile. */
  async function saveName(event: Event) {
    event.preventDefault();
    if (fieldset.disabled || !user || !session) return;
    const expected = session;
    const name = nameInput.value.trim();
    const problem = name ? bylineError(name, { allowReserved }) : null;
    if (problem) {
      status.textContent = problem;
      return;
    }
    const captured = generation;
    setControlsDisabled(true);
    status.textContent = 'Saving…';
    try {
      const verified = await verifiedCurrent(captured);
      const result = await requests.updateProfile(verified.session.access_token, operation.signal, {
        display_name: name || null,
      });
      if (!current(captured) || (await refreshReplacement(captured, verified.session))) return;
      if (result.id !== verified.user.id)
        throw new Error('Your profile could not be saved. Reload and try again.');
      const updated = await requests.verifyUser(verified.session.access_token, operation.signal);
      if (!current(captured) || (await refreshReplacement(captured, verified.session))) return;
      if (
        updated.id !== verified.user.id ||
        (updated.user_metadata.display_name ?? null) !== (name || null)
      )
        throw new Error('Your profile could not be verified. Reload to check it.');
      user = updated;
      nameInput.value = displayName(user);
      setControlsDisabled(false);
      status.textContent = name
        ? 'Saved.'
        : nameInput.value
          ? 'Custom name cleared. Your provider name is shown.'
          : 'Cleared. Encounters publish unsigned.';
    } catch (error) {
      if (!current(captured) || (await refreshReplacement(captured, expected))) return;
      setControlsDisabled(false);
      status.textContent =
        error instanceof Error ? error.message : 'Your profile could not be saved. Try again.';
    }
  }
  nameForm.addEventListener('submit', saveName);

  /** Save only an existing offered license, clearing the metadata for an unstated default. */
  async function saveLicense() {
    const license = licenseSelect.value;
    if (
      fieldset.disabled ||
      !user ||
      !session ||
      !isContentLicense(license) ||
      !LICENSES_FROM_SCRATCH.includes(license)
    )
      return;
    const expected = session;
    const captured = generation;
    setControlsDisabled(true);
    status.textContent = 'Saving…';
    try {
      const verified = await verifiedCurrent(captured);
      const result = await requests.updateProfile(verified.session.access_token, operation.signal, {
        share_license: license === 'unstated' ? null : license,
      });
      if (!current(captured) || (await refreshReplacement(captured, verified.session))) return;
      if (result.id !== verified.user.id)
        throw new Error('Your preference could not be saved. Reload and try again.');
      const updated = await requests.verifyUser(verified.session.access_token, operation.signal);
      if (!current(captured) || (await refreshReplacement(captured, verified.session))) return;
      if (
        updated.id !== verified.user.id ||
        (updated.user_metadata.share_license ?? null) !== (license === 'unstated' ? null : license)
      )
        throw new Error('Your preference could not be verified. Reload to check it.');
      user = updated;
      licenseHint.textContent = LICENSE_HINTS[license];
      setControlsDisabled(false);
      status.textContent = 'Saved.';
    } catch (error) {
      if (!current(captured) || (await refreshReplacement(captured, expected))) return;
      setControlsDisabled(false);
      const previous = isContentLicense(user?.user_metadata.share_license)
        ? user.user_metadata.share_license
        : 'unstated';
      licenseSelect.value = previous;
      status.textContent =
        error instanceof Error ? error.message : 'Your preference could not be saved. Try again.';
    }
  }
  licenseSelect.addEventListener('change', saveLicense);

  /** Revoke live-view publication before asking the guarded SDK to end the same verified session. */
  async function signOut() {
    if (fieldset.disabled || !user) return;
    const captured = generation;
    setControlsDisabled(true);
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
      if (!current(captured) || (await refreshReplacement(captured, verified.session))) return;
      endingGeneration = captured;
      endingMessage = 'Signed out.';
      await (dependencies.signOut ?? signOutAccountSession)(client, verified.session, () =>
        current(captured),
      );
      await finishCleanup(captured, verified.session, 'Signed out.', false, signedOutDestination);
    } catch (error) {
      if (endedGeneration === captured && !session) {
        await finishCleanup(captured, null, 'Signed out.', false, signedOutDestination);
        return;
      }
      if (!current(captured) || !session || (await refreshReplacement(captured, session))) return;
      setControlsDisabled(false);
      status.textContent = error instanceof Error ? error.message : 'Sign-out failed. Try again.';
    } finally {
      endingGeneration = null;
    }
  }
  /** Invoke existing empty-body erasure, require its explicit success, then clean up only this local session. */
  async function deleteAccount(event: Event) {
    event.preventDefault();
    if (fieldset.disabled || !confirmed() || !session) return;
    const expected = session;
    const captured = generation;
    setControlsDisabled(true);
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
      if (result !== true)
        throw new Error(
          'Account deletion could not be confirmed. Check your account before trying again.',
        );
      if (await refreshReplacement(captured, verified.session)) return;
      endingGeneration = captured;
      endingMessage =
        'Account deleted. If session cleanup failed, sign in again before using another account.';
      await (dependencies.signOut ?? signOutAccountSession)(
        client,
        verified.session,
        () => current(captured),
        'local',
      ).catch(() => {});
      await finishCleanup(captured, verified.session, endingMessage, true);
    } catch (error) {
      if (!current(captured) || (await refreshReplacement(captured, expected))) return;
      setControlsDisabled(false);
      status.textContent =
        error instanceof Error ? error.message : 'Account deletion failed. Try again.';
    } finally {
      endingGeneration = null;
    }
  }
  deleteForm.addEventListener('submit', deleteAccount);
  signOutButton.addEventListener('click', signOut);

  let subscription: { unsubscribe: () => void } | undefined;

  /** Release page-owned listeners, pending requests, and expiry when leaving the account boundary. */
  function dispose() {
    disposed = true;
    generation++;
    operation.abort();
    signOutButton.removeEventListener('click', signOut);
    confirmEmail.removeEventListener('input', updateConfirmation);
    deleteForm.removeEventListener('submit', deleteAccount);
    nameForm.removeEventListener('submit', saveName);
    licenseSelect.removeEventListener('change', saveLicense);
    clearTimeout(expiry);
    subscription?.unsubscribe();
    returnLink.removeEventListener('click', onReturn);
  }

  try {
    client = getClient();
  } catch {
    status.textContent = 'Accounts are unavailable. Check browser storage and reload to retry.';
    return dispose;
  }
  subscription = client.auth.onAuthStateChange((event, next) => {
    const eventGeneration = ++authEventGeneration;
    const initial = event === 'INITIAL_SESSION' && generation === 0;
    if (next) {
      endedGeneration = null;
      void observe(next, initial);
    } else {
      void reconcileNull(eventGeneration, initial);
    }
  }).data.subscription;
  const initialGeneration = generation;
  const initialAuthEventGeneration = authEventGeneration;
  void client.auth
    .getSession()
    .then(({ data, error }) => {
      if (
        disposed ||
        generation !== initialGeneration ||
        authEventGeneration !== initialAuthEventGeneration
      )
        return;
      if (error) {
        status.textContent = 'Your session could not be read. Sign in again or reload to retry.';
        return;
      }
      void observe(data.session, true);
    })
    .catch(() => {
      if (
        !disposed &&
        generation === initialGeneration &&
        authEventGeneration === initialAuthEventGeneration
      )
        status.textContent = 'Your session could not be read. Reload to retry.';
    });
  return dispose;
}
