// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone
// @vitest-environment node

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import SignIn from '../src/pages/sign-in.astro';
import SignUp from '../src/pages/sign-up.astro';
import Callback from '../src/pages/auth/callback.astro';

it.each([
  [SignIn, 'Sign in'],
  [SignUp, 'Create a free account'],
] as const)('renders a direct-entry auth route', async (page, heading) => {
  const container = await AstroContainer.create({ astroConfig: { site: 'https://openfray.app' } });
  const html = await container.renderToString(page);
  const document = new JSDOM(html).window.document;
  expect(document.querySelector('h1')?.textContent).toBe(heading);
  expect(document.querySelectorAll('[data-provider]')).toHaveLength(3);
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
