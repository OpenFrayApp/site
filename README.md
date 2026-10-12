# OpenFray site

The marketing site and published libraries served at
[openfray.app](https://openfray.app): the home page, the news, the legal pages, and
the three books OpenFray writes and publishes in full: The Waking Garden,
Brood & Bloom, and On Strong Waters and Potent Simples.

This repo is one part of OpenFray. The console and the handbook live in their own
repos, and [openfray](https://github.com/OpenFrayApp/openfray) ties the
three together into the single deploy that serves the domain. The one thing this repo
needs from outside: a clone of [console](https://github.com/OpenFrayApp/console)
sitting beside it (same parent folder, named `console`). The book pages import its
compendium JSON, and the credits page imports its `CREDITS.md`. The account page
imports its dependency-free `src/lib/byline.ts` and `src/schema/contentLicense.ts`.

Site CI checks out only those paths from console commit
`6f538b07ba6eafe0043b0e376f4c13c0a0d90448`. This reviewed, published snapshot pins
compendium, credits, and account helpers together. To update any of them, review
one published console commit and update the workflow pin and
`tests/checksWorkflow.test.ts` together. Verify the build and tests against that
sparse checkout before publishing the change.

## Running it

```bash
npm install
npm run dev
```

`npm test` runs the site's Vitest suite, including the tests for the build checks.

## Checks and tools

`npm run build` runs the site's own gates before Astro: news slugs, the prose
rules, and CSS specificity. Two heavier tools live in `scripts/` for changes worth
measuring: `measure-css.mjs` snapshots computed styles before and after a CSS
change, and `print-check.mjs` verifies a book's print edition still paginates.
See [Measure CSS changes](./docs/development/measure-css.md) and
[Check the print edition](./docs/development/print-check.md) for the procedures.
The print editions live under each book's `/print` route and never ship.

## Before contributing

Use the shared
[Contributing](https://github.com/OpenFrayApp/openfray/blob/main/CONTRIBUTING.md),
[Verification commands](https://github.com/OpenFrayApp/openfray/blob/main/docs/development/verification.md),
and [Repository file policy](https://github.com/OpenFrayApp/openfray/blob/main/docs/development/repository-files.md)
for branch targets, check scope, and private local files.

Read [AGENTS.md](./AGENTS.md). Every published word follows the parent repo's
STYLE.md.

## License

Code is [AGPL-3.0-or-later](./LICENSE). The books keep their own licensing by
layer, stated on their pages: stat blocks CC-BY-4.0, lore and art reserved.
