Guidance for AI agents (and humans) working on the OpenFray site.

This repo is one of three parts of OpenFray, tied together by the
[openfray.app](https://github.com/OpenFrayApp/openfray.app) parent repo. The full
working agreements live in
[that repo's AGENTS.md](https://github.com/OpenFrayApp/openfray.app/blob/main/AGENTS.md),
and every published word follows
[STYLE.md](https://github.com/OpenFrayApp/openfray.app/blob/main/STYLE.md) beside it.
**Read both before working here.**

What is specific to this repo: the Astro site with Tailwind v4, its tests in
`tests/`, the book pages (whose stat blocks render from the compendium JSON in the
`console` sibling — edit the data in the
[compendium](https://github.com/OpenFrayApp/compendium) repo, never here), and the
print editions under each book's `/print` route, which never ship. Editing the
Terms or Privacy pages? Bump the "Last updated" date in the same change.
