// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import SignIn from '../src/pages/sign-in.astro';
import SignUp from '../src/pages/sign-up.astro';
import Callback from '../src/pages/auth/callback.astro';
import Account from '../src/pages/account.astro';

it.each([
  [SignIn, 'Sign in'],
  [SignUp, 'Create a free account'],
] as const)('renders a direct-entry auth route', async (page, heading) => {
  const container = await AstroContainer.create({ astroConfig: { site: 'https://openfray.app' } });
  const html = await container.renderToString(page);
  const document = new JSDOM(html).window.document;
  expect(document.querySelector('h1')?.textContent).toBe(heading);
  expect(document.querySelectorAll('[data-provider]')).toHaveLength(3);
  for (const button of document.querySelectorAll('[data-provider]')) {
    expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(button.classList.contains('inline-flex')).toBe(true);
  }
  expect(document.querySelector('[data-provider="discord"]')?.className).toContain('bg-[#5865F2]');
});

it('renders the real account fallback route with disabled controls until identity verification', async () => {
  const container = await AstroContainer.create({ astroConfig: { site: 'https://openfray.app' } });
  const document = new JSDOM(await container.renderToString(Account)).window.document;
  expect(document.querySelector('h1')?.textContent).toBe('Account');
  expect(document.querySelector('fieldset')?.disabled).toBe(true);
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Checking');
  expect(document.querySelector('label[for="display-name"]')).not.toBeNull();
  expect(document.querySelector('label[for="account-confirm-email"]')).not.toBeNull();
});

it('scrubs callback material synchronously before any external script can run', async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Callback);
  const dom = new JSDOM(html, {
    url: 'https://openfray.app/auth/callback/?attempt=opaque#error=secret&access_token=secret',
    runScripts: 'dangerously',
  });
  expect(dom.window.location.href).toBe('https://openfray.app/auth/callback/');
  expect(dom.window.document.querySelector('script[src*="fathom"]')).toBeNull();
  expect(dom.window.document.querySelector('h1')?.textContent).toBe('Completing sign-in');
});

it('documents a callback allowlist pattern with one literal escape before the query separator', () => {
  const documentation = readFileSync('docs/development/authentication.md', 'utf8');
  const pattern = documentation.match(/restricted pattern `([^`]+)`/)?.[1];
  expect(pattern).toBe(String.raw`https://openfray.app/auth/callback/\?attempt=*`);
});
