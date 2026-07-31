// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors
// @vitest-environment node
// Node, not jsdom: these are pure functions over frontmatter, plus two files read as
// text to pin the hooks the section depends on.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  KIND_LABEL,
  byNewest,
  escapeXml,
  formatDate,
  isoDate,
  postMeta,
  postPath,
  postUrl,
  readingTime,
  readingTimeLabel,
  rfc822,
  rssXml,
  type NewsPost,
} from '../src/data/news.ts';

/** A post with just enough frontmatter for the helpers, so a test reads as its case. */
const post = (id: string, date: string, over: Partial<NewsPost['data']> = {}): NewsPost => ({
  id,
  data: {
    title: id,
    description: `About ${id}.`,
    date: new Date(date),
    kind: 'update',
    ...over,
  },
});

describe('news dates', () => {
  it('prints the day the frontmatter says, not the reader’s local one', () => {
    // Frontmatter dates parse as UTC midnight. Read back with local getters, this is
    // July 30 anywhere west of Greenwich — the dateline and the feed would disagree.
    expect(formatDate(new Date('2026-07-31'))).toBe('Jul 31, 2026');
    expect(isoDate(new Date('2026-07-31'))).toBe('2026-07-31');
  });

  it('puts the month first and abbreviates it, so it fits the listing’s rail', () => {
    expect(formatDate(new Date('2026-01-05'))).toBe('Jan 5, 2026');
    expect(formatDate(new Date('2026-12-25'))).toBe('Dec 25, 2026');
  });

  it('gives RSS an RFC 822 pubDate, not the ISO form', () => {
    expect(rfc822(new Date('2026-07-31'))).toBe('Fri, 31 Jul 2026 00:00:00 GMT');
  });
});

describe('news ordering', () => {
  it('puts the newest post first', () => {
    const ordered = byNewest([post('older', '2026-01-01'), post('newer', '2026-06-01')]);
    expect(ordered.map((p) => p.id)).toEqual(['newer', 'older']);
  });

  it('breaks a same-day tie by id, so the order never changes between builds', () => {
    const a = byNewest([post('b', '2026-07-31'), post('a', '2026-07-31')]);
    const b = byNewest([post('a', '2026-07-31'), post('b', '2026-07-31')]);
    expect(a.map((p) => p.id)).toEqual(['a', 'b']);
    expect(b.map((p) => p.id)).toEqual(a.map((p) => p.id));
  });

  it('leaves the caller’s array alone', () => {
    const input = [post('older', '2026-01-01'), post('newer', '2026-06-01')];
    byNewest(input);
    expect(input.map((p) => p.id)).toEqual(['older', 'newer']);
  });
});

describe('news metadata', () => {
  it('joins an adventure’s level band and running time', () => {
    expect(
      postMeta(post('x', '2026-07-31', { levels: 'Levels 2–3', length: 'One session' }).data),
    ).toBe('Levels 2–3 · One session');
  });

  it('is empty for an update, which has neither', () => {
    expect(postMeta(post('x', '2026-07-31').data)).toBe('');
  });

  it('drops a missing half rather than leaving a dangling separator', () => {
    expect(postMeta(post('x', '2026-07-31', { levels: 'Levels 2–3' }).data)).toBe('Levels 2–3');
  });

  it('routes posts under /news/ with a trailing slash, as the style guide requires', () => {
    expect(postPath('the-tithe-barn')).toBe('/news/the-tithe-barn/');
    expect(postUrl('the-tithe-barn')).toBe('https://openfray.app/news/the-tithe-barn/');
  });

  it('labels both kinds', () => {
    expect(KIND_LABEL.update).toBe('Update');
    expect(KIND_LABEL.adventure).toBe('Adventure');
  });
});

describe('reading time', () => {
  it('counts prose at 200 words a minute', () => {
    expect(readingTime('word '.repeat(200))).toBe(1);
    expect(readingTime('word '.repeat(1200))).toBe(6);
  });

  it('never reads as zero minutes, however short the post', () => {
    expect(readingTime('One line.')).toBe(1);
    expect(readingTime('')).toBe(1);
  });

  it('does not credit a roster table’s pipes and dashes as words', () => {
    const table = ['| Creature | № | CR |', '| --- | :-: | :-: |', '| Snaproot | 2 | 1/4 |'].join(
      '\n',
    );
    // Nine words of content, not the thirty-odd tokens the raw markdown splits into.
    expect(readingTime(table + ' ' + 'word '.repeat(191))).toBe(1);
  });

  it('skips MDX imports, fenced code, and tags', () => {
    const body = [
      "import Note from '../../components/Note.astro';",
      '```js',
      'const noise = "not prose";',
      '```',
      '<Note type="Running it">Real words here.</Note>',
    ].join('\n');
    expect(readingTime(body)).toBe(1);
    expect(readingTime(body + ' ' + 'word '.repeat(600))).toBe(3);
  });

  it('labels itself the way the listing prints it', () => {
    expect(readingTimeLabel('word '.repeat(800))).toBe('4 min read');
  });
});

describe('the news feed', () => {
  const feed = rssXml([
    post('second', '2026-01-01'),
    post('first', '2026-06-01', { kind: 'adventure', title: 'The tithe barn' }),
  ]);

  it('is a well-formed RSS 2.0 channel', () => {
    expect(feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(feed).toContain('<rss version="2.0"');
    expect(feed).toContain('<title>OpenFray news</title>');
    expect(feed).toContain('<link>https://openfray.app/news/</link>');
  });

  it('points at itself, which is what a reader uses to resubscribe', () => {
    expect(feed).toContain('href="https://openfray.app/news/rss.xml" rel="self"');
  });

  it('carries every post, newest first', () => {
    expect(feed.indexOf('The tithe barn')).toBeLessThan(feed.indexOf('<title>second</title>'));
    expect(feed.match(/<item>/g)).toHaveLength(2);
  });

  it('tags each item with its kind', () => {
    expect(feed).toContain('<category>Adventure</category>');
    expect(feed).toContain('<category>Update</category>');
  });

  it('escapes markup in a title instead of emitting it', () => {
    const hostile = rssXml([
      post('x', '2026-07-31', { title: 'Brood & Bloom <b>v2</b>', description: 'A "quoted" line' }),
    ]);
    expect(hostile).toContain('<title>Brood &amp; Bloom &lt;b&gt;v2&lt;/b&gt;</title>');
    expect(hostile).toContain('A &quot;quoted&quot; line');
    // The only real tags left are the feed's own.
    expect(hostile).not.toContain('<b>');
  });

  it('escapes all five XML characters', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('is stable for an empty section', () => {
    const empty = rssXml([]);
    expect(empty).toContain('<channel>');
    expect(empty).not.toContain('<item>');
  });
});

describe('the section is reachable', () => {
  const layout = readFileSync(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
  const newsLayout = readFileSync(
    new URL('../src/layouts/NewsLayout.astro', import.meta.url),
    'utf8',
  );
  const css = readFileSync(new URL('../src/styles/news.css', import.meta.url), 'utf8');
  const global = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  it('has a nav entry, so the posts are not orphans', () => {
    expect(layout).toContain('href="/news/"');
  });

  it('advertises the feed from every page’s head', () => {
    expect(layout).toContain('type="application/rss+xml"');
    expect(layout).toContain('href="/news/rss.xml"');
  });

  it('gives a post’s markdown tables somewhere to scroll', () => {
    // rehype-table-scroll wraps every markdown table; without a rule for the wrapper,
    // a wide roster table scrolls the whole page sideways instead.
    expect(css).toMatch(/\.post-body \.table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('sizes posts without touching the containers other pages use', () => {
    // `.doc` styles the legal and listing pages; a post reads longer and larger, so it
    // has its own container. Moving `.doc` instead would have moved those pages too.
    expect(css).toMatch(/\.post-body\s*\{[^}]*font-size/);
    expect(global).not.toContain('.post-body');
  });

  it('restores the preflight defaults its prose relies on', () => {
    // Preflight strips these and news.css is the only stylesheet a post loads, so the
    // restoration has to be in here or headings render regular and lists lose markers.
    expect(css).toMatch(/:where\(\.post-body\) :where\(h2, h3, h4\)\s*\{[^}]*font-weight: bold/);
    expect(css).toMatch(/:where\(\.post-body\) :where\(ul\)\s*\{[^}]*list-style: disc/);
  });

  it('keys the reading rail’s highlight off aria-current, not a class', () => {
    // The stylesheet and the accessibility tree then cannot drift apart.
    expect(newsLayout).toContain("setAttribute('aria-current', 'true')");
    expect(css).toContain("aria-current='true'");
  });

  it('colours the current entry with a utility, because the stylesheet would lose', () => {
    // Site CSS lives in @layer components and utilities beat that layer whatever the
    // specificity, so a colour in news.css loses to the `text-muted` on the same anchor.
    // This cost the accent its colour once already — the bar showed, the text did not.
    expect(newsLayout).toContain('aria-[current=true]:text-accent');
    expect(css).not.toMatch(/a\[aria-current='true'\]\s*\{[^}]*color:/);
  });

  it('leaves the rail working without JavaScript', () => {
    expect(newsLayout).toMatch(/href=\{`#\$\{h\.slug\}`\}/);
  });
});
