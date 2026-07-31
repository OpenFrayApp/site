// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { SITE } from './seo.ts';

/** What a post is. An update is a release note; an adventure is something to run. */
export type NewsKind = 'update' | 'adventure';

/** The badge each kind carries on its card and above its title. */
export const KIND_LABEL: Record<NewsKind, string> = {
  update: 'Update',
  adventure: 'Adventure',
};

/** The frontmatter every post carries, as the pages and the feed read it. */
export interface NewsData {
  title: string;
  description: string;
  date: Date;
  kind: NewsKind;
  levels?: string;
  length?: string;
}

/** A collection entry reduced to what these helpers need, so they stay testable. */
export interface NewsPost {
  id: string;
  data: NewsData;
}

export const NEWS_BASE = '/news';

/** The path a post is served at. */
export const postPath = (id: string) => `${NEWS_BASE}/${id}/`;

/** The absolute URL of a post, for the feed and the JSON-LD. */
export const postUrl = (id: string) => `${SITE}${postPath(id)}`;

// Dates come out of the frontmatter as UTC midnight, so every reader gets the day the
// post says it is. Reading them back with local getters would move a post to the day
// before west of Greenwich, which is how a dateline and a feed drift apart.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The dateline a post prints: "Jul 31, 2026". Month first, per the house's American
 *  convention, and abbreviated so it sits on one line in the listing's narrow rail. */
export const formatDate = (date: Date) =>
  `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;

/** The machine-readable form for `<time datetime>`: "2026-07-31". */
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Newest first, with the id breaking a tie so two posts on one day never swap order
 *  between builds. Returns a new array; the caller's is untouched. */
export const byNewest = <T extends NewsPost>(posts: T[]): T[] =>
  [...posts].sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id),
  );

/** The one-line summary under a card's title: an adventure's level band and running
 *  time, joined; an update has neither and gets nothing. */
export const postMeta = (data: NewsData) => [data.levels, data.length].filter(Boolean).join(' · ');

// 200 words a minute is the usual desk-reading figure. The number is a courtesy, not a
// measurement — it only has to tell a reader "a coffee" from "a lunch break".
const WORDS_PER_MINUTE = 200;

/**
 * Rough minutes to read a post, from its raw markdown body. Strips the things a reader
 * never reads word by word — MDX imports, fenced code, tags, and markdown punctuation —
 * so a post heavy in roster tables isn't credited with the pipe characters.
 */
export const readingTime = (body: string): number => {
  const words = body
    .replace(/^---[\s\S]*?\n---/, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^import\s[\s\S]*?$/gm, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_>|`~[\]()·—–-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
};

/** The reading time as the listing prints it. */
export const readingTimeLabel = (body: string) => `${readingTime(body)} min read`;

/** Escape the five characters that would otherwise close a tag or an entity in XML. */
export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** RFC 822 date, which is what RSS 2.0 wants in pubDate — not the ISO form. */
export const rfc822 = (date: Date) => date.toUTCString();

/**
 * The whole feed document for the news section. Built by hand rather than pulling in a
 * dependency: the section has one author and no enclosures, so the format is a dozen
 * lines, and building it here keeps it under test.
 */
export const rssXml = (posts: NewsPost[]) => {
  const items = byNewest(posts).map((post) =>
    [
      '    <item>',
      `      <title>${escapeXml(post.data.title)}</title>`,
      `      <link>${escapeXml(postUrl(post.id))}</link>`,
      `      <guid isPermaLink="true">${escapeXml(postUrl(post.id))}</guid>`,
      `      <pubDate>${rfc822(post.data.date)}</pubDate>`,
      `      <category>${escapeXml(KIND_LABEL[post.data.kind])}</category>`,
      `      <description>${escapeXml(post.data.description)}</description>`,
      '    </item>',
    ].join('\n'),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>OpenFray news</title>',
    `    <link>${SITE}${NEWS_BASE}/</link>`,
    '    <description>Updates to the OpenFray combat console, and short adventures to run with it.</description>',
    '    <language>en</language>',
    `    <atom:link href="${SITE}${NEWS_BASE}/rss.xml" rel="self" type="application/rss+xml"/>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
};
