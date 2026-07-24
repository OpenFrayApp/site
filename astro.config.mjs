// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The marketing site for openfray.app. Builds to site/dist, which the root build
// (scripts/assemble-site.mjs) merges into the site root of dist/, alongside the app
// at dist/console and the handbook at dist/docs. Directory build format gives clean
// URLs (/privacy, /terms) plus a root 404.html that Cloudflare Pages serves.
export default defineConfig({
  site: 'https://openfray.app',
  integrations: [sitemap()],
  // Each part runs its own dev server on a fixed port (see AGENTS.md). Serving all
  // three through one origin was tried and abandoned: two Vite dev servers can't share
  // an origin, because each emits root-relative asset URLs (/node_modules/…,
  // /@vite/client) that the other one then tries to serve.
  server: { port: 4321 },
});
