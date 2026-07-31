// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors
// @vitest-environment node
// Node, not jsdom: the container pulls in esbuild, whose startup invariant trips over
// jsdom's patched Uint8Array. JSDOM is imported directly for parsing instead.

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import ShareLinks from '../src/components/ShareLinks.astro';

// An ampersand in the title is the case worth pinning: it has to survive percent
// encoding into the query, and HTML-entity encoding into the attribute, and come back
// out intact. Brood & Bloom is a real post, so this is not a hypothetical.
const TITLE = 'Brood & Bloom: A free bestiary of parasites';
const URL_ = 'https://openfray.app/news/brood-and-bloom/';

let doc: Document;

beforeAll(async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(ShareLinks, { props: { url: URL_, title: TITLE } });
  doc = new JSDOM(html).window.document;
});

/** Every share anchor, by the host it points at. */
const byHost = () =>
  Object.fromEntries(
    [...doc.querySelectorAll<HTMLAnchorElement>('a[href^="https://"]')].map((a) => [
      new URL(a.href).host,
      a,
    ]),
  );

describe('share links', () => {
  it('offers every platform once', () => {
    expect(Object.keys(byHost()).sort()).toEqual([
      'bsky.app',
      'reddit.com',
      'twitter.com',
      'wa.me',
      'www.facebook.com',
    ]);
  });

  it('carries the post’s own URL to each of them', () => {
    const hosts = byHost();
    expect(new URL(hosts['reddit.com'].href).searchParams.get('url')).toBe(URL_);
    expect(new URL(hosts['twitter.com'].href).searchParams.get('url')).toBe(URL_);
    expect(new URL(hosts['www.facebook.com'].href).searchParams.get('u')).toBe(URL_);
    // Bluesky and WhatsApp take one text field, so the URL rides inside it.
    expect(new URL(hosts['bsky.app'].href).searchParams.get('text')).toContain(URL_);
    expect(new URL(hosts['wa.me'].href).searchParams.get('text')).toContain(URL_);
  });

  it('gets an ampersand in the title through intact', () => {
    // Encoded wrong, "Brood & Bloom: A free bestiary…" either truncates at the ampersand
    // or invents a second query parameter.
    const hosts = byHost();
    expect(new URL(hosts['reddit.com'].href).searchParams.get('title')).toBe(TITLE);
    expect(new URL(hosts['twitter.com'].href).searchParams.get('text')).toBe(TITLE);
    expect(new URL(hosts['bsky.app'].href).searchParams.get('text')).toContain(TITLE);
    expect([...new URL(hosts['reddit.com'].href).searchParams.keys()]).toEqual(['url', 'title']);
  });

  it('names each link by what it does, not by a bare noun', () => {
    // aria-label rather than visible text plus a clipped span: the accessible name is
    // then one attribute, computed the same way everywhere. An earlier version used
    // aria-hidden + sr-only and came out of the accessibility tree with no name at all.
    for (const [host, a] of Object.entries(byHost())) {
      expect(a.getAttribute('aria-label'), host).toMatch(/^Share this post on \w+$/);
      // WCAG Label in Name: the accessible name has to contain the visible word.
      expect(a.getAttribute('aria-label')).toContain(a.textContent!.trim());
    }
  });

  it('opens off-site links without handing the opener over', () => {
    for (const a of Object.values(byHost())) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noreferrer');
    }
  });

  it('pulls nothing from a third party — they are anchors, not widgets', () => {
    // The privacy page says OpenFray sets no cookies and needs no consent banner. An
    // embedded share widget would make both untrue on every post it appeared on.
    //
    // The check is for off-site origins, not for any script at all: the container API
    // externalises a component's own script to a local path, so asserting no
    // `script[src]` would fail on a build artefact rather than on anything shipped.
    expect(doc.querySelector('iframe')).toBeNull();
    const offSite = [...doc.querySelectorAll('script[src], img[src], link[href], source[src]')]
      .map((el) => el.getAttribute('src') ?? el.getAttribute('href'))
      .filter((value): value is string => Boolean(value))
      .filter((value) => /^(https?:)?\/\//.test(value));
    expect(offSite).toEqual([]);
  });
});

describe('the copy button', () => {
  it('carries the URL it will copy', () => {
    const button = doc.querySelector<HTMLButtonElement>('.share-copy');
    expect(button?.dataset.url).toBe(URL_);
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('announces its result rather than carrying a label that would go stale', () => {
    const label = doc.querySelector('.share-copy-label');
    expect(label?.getAttribute('aria-live')).toBe('polite');
    expect(label?.textContent).toBe('Copy link');
    // A fixed aria-label would still read "Copy link" after the text became "Link copied".
    expect(doc.querySelector('.share-copy')?.hasAttribute('aria-label')).toBe(false);
  });

  it('stays hidden until the script can make it work', async () => {
    // Copying needs the clipboard API. news.css hides the button and the script reveals
    // it with data-ready, so it is never in the tab order promising something it can't do.
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../src/styles/news.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.share-copy\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.share-copy\[data-ready\]\s*\{[^}]*display:\s*inline-flex/);
    expect(doc.querySelector('.share-copy')?.hasAttribute('data-ready')).toBe(false);
  });
});
