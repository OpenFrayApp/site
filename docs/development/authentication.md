# Site authentication

The site owns `/sign-in/`, `/sign-up/`, and `/auth/callback/`.
Both entry pages support Google, Discord, and Patreon for new and existing accounts.
Entry intent changes presentation only. This slice has no newsletter controls.

## Release gate

Keep #139 unreleased until #140 supplies `/account/`.
Direct entry and invalid return destinations fall back to that route.
The console keeps account management until #140 moves it to the site.

## Public configuration

Install the pinned `@supabase/supabase-js` version, 2.108.2, in this worktree.
Build the site with these public variables:

| Site variable              | Existing deployment source |
| -------------------------- | -------------------------- |
| `PUBLIC_SUPABASE_URL`      | `VITE_SUPABASE_URL`        |
| `PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_ANON_KEY`   |

Both surfaces must use the same Supabase project and public anon key.
Never supply a service-role or secret key to a browser build.
Missing configuration shows a retry message without starting OAuth.

The browser client uses `persistSession=true`, `autoRefreshToken=true`, and the implicit flow.
It retains the SDK’s default localStorage session key and explicitly uses native localStorage.
Session write failures propagate to the callback’s failure message without success navigation, including quota exhaustion after client initialization.
Both site and console disable automatic URL session detection.
The site explicitly installs callback tokens only after validating the originating attempt.
An existing session does not establish success for a new attempt.

## Provider setup

Document and review the callback allowlist before deployment.
Use the restricted pattern `https://openfray.app/auth/callback/\?attempt=*` to permit the opaque query parameter.
The escaped question mark matches the literal query separator in Supabase’s glob syntax.
Add the equivalent pattern for each approved staging or same-origin preview origin.
Review the pattern against the [redirect URL documentation](https://supabase.com/docs/guides/auth/redirect-urls) before activation.
Do not allow arbitrary external destinations or a production-wide `/**` pattern.
Do not change live configuration as part of source verification.

Keep provider IDs `google`, `discord`, and `custom:patreon`.
Preserve existing verification settings and the Patreon adapter’s confirmation requirements.
These pages do not change provider email verification or identity-linking behavior.

## Return and attempt handling

Links use `returnTo` containing an encoded pathname, query, and fragment.
The site accepts only root-relative same-origin returns beginning with exactly one slash.
It rejects external URLs, credentials, backslashes, control characters, malformed escapes, unsafe encoded separators, and auth-route loops.
It also rejects `access_token`, `refresh_token`, `provider_token`, and `provider_refresh_token` parameters in queries or callback-shaped fragments, including encoded variants.
Ordinary path, query, and fragment content remains intact. Credential removal takes priority over verbatim return preservation.
It validates the stored destination again before final navigation.
Neither the referrer nor a caller-selected callback return controls navigation.

A tab stores one `openfray-oauth-attempt` record in sessionStorage:
`{version: 1, attemptId, returnTo, startedAt}`.
The callback query carries only the opaque attempt identifier.
Attempts expire after ten minutes and are consumed before session installation.
Failures, cancellation, entry reloads, and unmatched callbacks discard attempts.
A retry starts a fresh attempt. A replay cannot install another session.
Storage denial blocks authentication without changing the existing shared session.

The callback scrubs its query and fragment synchronously in the document head.
Its original URL remains in memory until the browser module takes it.
The callback uses a small shell without analytics so external scripts cannot observe auth material.
Tokens are never forwarded to return destinations or written into attempt storage.

## Local verification

Run `npm install` in the site worktree; do not share node_modules.
Run `npm test -- tests/authEntry.test.ts tests/authCallback.test.ts tests/authClient.test.ts tests/authStorage.test.ts tests/authPages.test.ts`, then `npm run build`.
Tests mock OAuth and network responses. They do not authenticate real accounts or send emails.

Separate development ports cannot share localStorage sessions.
The site rejects returns to the console’s separate development origin.
Use an assembled same-origin preview to verify site-to-console session sharing and route reloads.
Do not proxy multiple Vite development servers behind one origin.
Parent deployment owns assembled routing, callback query preservation, and asset-delivery checks.
Console tests own working-board, recovery-copy, and cloud-copy preservation.
