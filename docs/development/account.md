# Site account management

The site owns `/account/`, including account identity, display name, default shared-encounter license, sign-out, and account deletion.
Device settings, Shared links, and encounter controls stay in the console.
Tutorial suppression remains a console preference without an account-page control.

## Authentication and navigation

The page uses `getSiteClient()`, the same persistent Supabase singleton as `getSiteAuth()`.
Anonymous visits enter `/sign-in/` with an account destination carrying the validated initiating return.
The return action validates the destination again before navigation.
No account identifier, recipient override, referrer, or session token controls the destination or mutation target.

Account controls stay disabled until an explicit-bearer `GET /auth/v1/user` verifies the current identity.
Auth events, expiry, and identity replacement invalidate pending replies and abort account requests.
Each action checks the current session and verifies the captured bearer identity again before dispatch.
Metadata supplies display values and preferences only.
The reserved-byline capability comes from `may_use_reserved_byline`, with failures denying the capability.
The page imports the console’s pure byline validator and dependency-free `schema/contentLicense.ts` without importing compendium data.
Clearing a custom display name writes `null`, preserving the existing provider-name fallback.
The page shows the verified effective name after saving; accounts with a provider fallback remain named.

## Account effects

Profile writes use authenticated, abortable `PUT /auth/v1/user` requests.
They carry only the changed metadata and the verified caller’s bearer token.
The page re-reads the trusted user after a write without installing a captured session.
The SDK’s `updateUser` method can restore an outdated session after an asynchronous request, so account writes do not use it.
The SDK’s `getUser(token)` can remove a replacement session when an old token returns `session_not_found`.
Account verification uses the abortable request adapter instead and validates the returned user fields.
The page checks native SDK state after asynchronous account replies to fence replacements whose auth event has not arrived.

Sign-out first revokes `stop_all_live_views`.
Revocation failure keeps the account signed in and offers retry guidance.
The SDK logout transport and native storage adapter guard only an explicit account cleanup operation.
The guard refuses logout or removal when it observes a replaced or renewed session.
The SDK defaults to lockless coordination; native localStorage comparison and removal are separate operations.
The guard does not provide atomic comparison/removal across unrelated tabs.
Already-dispatched server effects cannot be recalled when a session changes during network transit.
Outside cleanup, the adapter delegates to native storage and preserves storage errors and the SDK’s default key.

Deletion requires the typed current verified email.
The page calls the existing `account-delete` function with an empty body and requires `deleted:true`.
Failure preserves the confirmation and does not report success.
Confirmed deletion attempts local SDK sign-out even if session cleanup fails.
Deletion is irreversible and removes shared links as well as the account’s data.
The console owns authenticated erasure integration; admin owns service-mail delivery.
This page does not redesign either boundary.

## Verification and release

Run the site account, auth, full suite, build, and format checks with mocked authentication and HTTP boundaries.
SDK cleanup tests use the installed SDK with synthetic sessions and intercepted HTTP requests.
Do not use production identities, send email, mutate fixtures, or change provider configuration.

Account modules provide the presentation boundary for later newsletter controls.
This ticket adds no newsletter fields or endpoints.
Independent review, cross-tab race assessment, handbook wording, screenshots, and assembled authenticated verification remain parent-coordinated release gates.
Console integration tests own working-board, recovery-copy, and cloud-copy preservation across account departures and returns.
Separate development origins cannot share the browser session; use an assembled same-origin preview for that gate.
