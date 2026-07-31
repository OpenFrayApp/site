// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { rssXml } from '../../data/news.ts';

/** The news feed at /news/rss.xml. The document itself is built in data/news.ts, which
 *  is where its escaping is tested; this only supplies the posts and the content type. */
export const GET: APIRoute = async () => {
  const posts = await getCollection('news');
  return new Response(rssXml(posts), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
