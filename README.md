# OpenFray site

The marketing site and published libraries served at
[openfray.app](https://openfray.app): the home page, the news, the legal pages, and
the three books OpenFray writes and publishes in full — The Waking Garden,
Brood & Bloom, and On Strong Waters and Potent Simples.

This repo is one part of OpenFray. The console and the handbook live in their own
repos, and [openfray.app](https://github.com/OpenFrayApp/openfray.app) ties the
three together into the single deploy that serves the domain. Day-to-day work
happens from a checkout of that parent repo, where all three parts sit side by
side — the book pages import the compendium JSON from the `console` sibling at
build time, so the stat blocks can never drift from what the app ships.

## Running it

From a parent-repo checkout:

```bash
npm install
npm run dev -w site
```

`npm test -w site` runs the site's Vitest suite.

## Before contributing

Read [AGENTS.md](./AGENTS.md). Every published word follows the parent repo's
STYLE.md.

## License

Code is [AGPL-3.0-or-later](./LICENSE). The books keep their own licensing by
layer, stated on their pages: stat blocks CC-BY-4.0, lore and art reserved.
