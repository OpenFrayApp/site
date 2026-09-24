# OpenFray 1.3 release post draft

Status: unpublished. This file is outside Astro’s content collections and public assets.
Do not move it into `src/content/news/` until the maintainer approves production
release and publication. Confirm the publication date then.

## Publication metadata

- **Title:** OpenFray 1.3
- **Description:** Search references from the header, choose creature labels and tracker colors, and recover an interrupted fight. Compatible with 5.5e and 5e.
- **Slug:** `openfray-1-3-release`
- **Kind:** `release`
- **Date:** Pending maintainer confirmation

## Review sources and publication checks

The draft follows [the parent changelog on develop](https://github.com/OpenFrayApp/openfray/blob/develop/CHANGELOG.md)
and [the coordinated release candidate](https://github.com/OpenFrayApp/openfray/pull/36).
Behavior was checked against console `d7d5ed5` and handbook `e9da56b`.
Recheck the final release scope before publication.

Keep the security and recovery material together as one new feature area.
The draft uses no screenshots: existing site capture recipes do not cover the new
search or tracker settings. Any images added before publication must come from
verified captures using the site’s pipeline.

The post below uses release-day wording for review only. At publication, supply the
confirmed date and verify that the unified changelog on `main` contains 1.3.0.
Copy only the post body and the confirmed metadata into the news collection.

---

Version 1.3.0 brings reference search to the header, new ways to tell creatures apart,
and recovery for an interrupted fight. The [console](/console/) is free, runs in your
browser, and needs no account to run a fight.

## Find the spell while the table waits

Search from the header for a creature, spell, condition, saved character, or console
navigation. Results scroll, and the search shortcut can be changed in **Settings**.

The search includes creatures from every enabled library and the available spells.
You can cast a spell found there even with an empty encounter, before adding anyone
to the tracker.

## Keep the goblins straight

Three goblins can read Goblin 1, 2, and 3; Goblin I, II, and III; or Goblin A, B, and C.
Choose **Creature labels** on the **Tracker** tab in **Settings**.
Removing one leaves the others’ labels unchanged, so Goblin C keeps its letter when
Goblin B leaves the board.

Changing the style affects new labels. Existing labels and names you typed stay as
they are.

You can also choose the tracker’s **Creature color** and **Ally color**. Each picker
has its own reset arrow. These change the side markers; hit-point colors, the active
turn, and selection highlights stay as they are.

The shared player view follows your tracker colors by default. As Game Master, you
can set separate overrides on the **Player view** tab for everyone watching.
Reset either override to make that color follow the tracker again. Your own tracker
stays unchanged.

The handbook’s [tracker settings](/docs/reference/settings/#tracker) and
[player-view settings](/docs/reference/settings/#player-view) cover both choices.

## Recover an interrupted fight

Security and recovery arrive together in 1.3.0: offline recovery, safe updates,
cloud-copy conflict handling, session recovery, and more reliable shared player views.

If your device and the cloud both contain changes, **Choose a board copy** lets you
pick which one to continue. The other stays available for recovery, and you can
download both copies before choosing.

A console update waits for you to review it. **Update and reload** verifies a recovery
checkpoint before reloading the encounter. Finish any open forms first: unfinished
form entries are lost in the reload.

If saving fails, you can retry or download a recovery copy. When sign-in is needed
to resume saving, the console offers it from the recovery controls.

## Sign in directly

Choose Google or Discord to sign in. The Terms notice sits beside the provider
buttons, with no checkbox to tick first. Signing in gives you saved encounters,
creatures, characters, and campaigns across devices.

## Smaller things

- Keyboard focus is visible, and initiative rows support arrow-key reordering.
- Repeated touch controls have larger targets.
- The tracker has updated cleanup icons, and the game log heading separates it from
  the controls.

## Where to start

[Settings and appearance](/docs/reference/settings/) covers labels, colors, and
keyboard preferences. [Share the player view](/docs/guides/player-view/) explains
what reaches the table’s screen. [Saving](/docs/guides/saving/) covers keeping an
encounter for another session.

The [unified changelog](https://github.com/OpenFrayApp/openfray/blob/main/CHANGELOG.md)
records the release across the console, website, and handbook.

[Open the console](/console/) to run a fight, or follow
[getting started](/docs/getting-started/) from an empty board.
