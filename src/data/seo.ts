// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

// Search metadata for the marketing site, mirroring the handbook's Head.astro so both
// halves of openfray.app describe themselves the same way. Starlight emits most of this
// for /docs; the site's own Layout has to build it by hand.

/** Site-wide search terms, in the words readers actually type. Per-page keywords are
 *  layered on top. House forms only — no ampersand marks, which are WotC's. */
export const baseKeywords = [
  'Dungeons and Dragons',
  'Dungeons and Dragons 5e',
  'DnD 5e',
  '5th edition',
  '5e',
  'DnD 2024',
  '5.5 edition',
  'initiative tracker',
  'DnD initiative tracker',
  'Dungeons and Dragons initiative tracker',
  'combat tracker',
  'Dungeons and Dragons combat tracker',
  'DnD encounter tracker',
  'Game Master tools',
  'tabletop RPG',
  'TTRPG',
  'OpenFray',
];

export const SITE = 'https://openfray.app';
export const WEBSITE_ID = `${SITE}/#website`;
export const PUBLISHER_ID = `${SITE}/#publisher`;

/** The site and publisher nodes every page's JSON-LD graph refers back to. */
export const websiteNodes = [
  {
    '@type': 'Organization',
    '@id': PUBLISHER_ID,
    name: 'OpenFray',
    url: `${SITE}/`,
  },
  {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'OpenFray',
    url: `${SITE}/`,
    description:
      'A free, browser-based Dungeons and Dragons 5e (5th edition) combat console and initiative tracker for Game Masters.',
    inLanguage: 'en',
    publisher: { '@id': PUBLISHER_ID },
  },
];

export interface Crumb {
  name: string;
  url: string;
}

/** A JSON-LD BreadcrumbList node; relative crumb URLs get the site origin prefixed. */
export const breadcrumbs = (items: Crumb[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: item.url.startsWith('http') ? item.url : `${SITE}${item.url}`,
  })),
});
