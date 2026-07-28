// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import rehypeTableScroll from './src/plugins/rehype-table-scroll.mjs';
import rehypeExternalLinks from './src/plugins/rehype-external-links.mjs';

// The marketing site for openfray.app. Builds to site/dist, which the root build
// (scripts/assemble-site.mjs) merges into the site root of dist/, alongside the app
// at dist/console and the handbook at dist/docs. Directory build format gives clean
// URLs (/privacy, /terms) plus a root 404.html that Cloudflare Pages serves.
export default defineConfig({
  site: 'https://openfray.app',
  // MDX backs the bestiary chapters under /the-waking-garden: their prose is Markdown,
  // but each creature entry is a <Creature> component rendering the shipped compendium
  // JSON, so the stat blocks can't drift from what the console loads.
  integrations: [mdx(), sitemap()],
  // MDX inherits these, so chapter tables get their scroll wrapper and off-site links
  // open in a new tab without every page having to remember.
  markdown: { rehypePlugins: [rehypeTableScroll, rehypeExternalLinks] },
  // Each part runs its own dev server on a fixed port (see AGENTS.md). Serving all
  // three through one origin was tried and abandoned: two Vite dev servers can't share
  // an origin, because each emits root-relative asset URLs (/node_modules/…,
  // /@vite/client) that the other one then tries to serve.
  server: { port: 4321 },
});
