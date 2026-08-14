# The persuading voice

How the site is written: the home page, the book landings, the news, and the legal
pages. Read the
[shared style core](https://github.com/OpenFrayApp/openfray/blob/main/STYLE.md)
first: the words table, the grammar, and the game-text mechanics live there. This
guide holds the site's own register, and the books' register at the end.

---

## The job

**The site exists to get a Game Master to open the console.** Every page, section,
and sentence is measured against that. The product is free, so the first conversion
is the click itself: a GM in the console, running a fight, with nothing installed.
**The second conversion is the free account.** Signing in is what saves fights,
creatures, and campaigns across devices, and what turns a visitor into a returning
GM. The page sells the first conversion hard and seeds the second; it never gates
the first behind the second.

The page speaks to two readers, in zones:

- **The hero speaks to the paper-and-pencil GM**: someone running fights on a notepad
  or behind a screen, skeptical of apps at the table. It must sound like a GM, never
  like software.
- **The deeper sections speak to the tool-switcher**: someone with a tracker or VTT
  already open and a specific frustration with it. These sections may assume tool
  literacy and name what the current tool forgets.

## The sound

This register keeps the core's plainness and adds pressure. Its raw material is
short declarative sentences and concrete table imagery: a named spell, a goblin, the
mage's last slot. It never inflates.

- **Two devices mark this register**, and they are the same two the teaching voice
  bans: the rhetorical contrast ("Your initiative tracker forgets. OpenFray
  doesn't.") and the spaced em dash holding an aside. Use both deliberately, at most
  one per passage; three contrasts in a row is a tic, not a voice.
- **A contrast earns its place only when both halves are concrete and checkable.**
  It names a real alternative (paper, the current tracker, a character sheet) and a
  difference the app delivers, and the next sentence resolves it into proof. The
  empty form ("not just a tracker, but a whole new way to play") is banned: it
  claims nothing, and readers increasingly read that pattern as machine-written.
  Contrast belongs at decision points (a headline, a section lead), never as the
  paragraph rhythm.
- **Concrete beats abstract.** "Six creatures, one Fireball, one click" carries a
  feature list's worth of claims in eight words. Reach for the table scene before
  the capability noun.
- **Claims the app delivers today.** No stacked superlatives, no fake urgency, no
  roadmap dressed as product.
- **"You" is the GM at the table**, mid-fight, not "users". OpenFray is the actor:
  it holds, records, counts, remembers.
- **The scope principle is a selling point.** "A scratchpad, not a second character
  sheet" is positioning; keep saying it.

## Persuade, with rules

The sound alone lists features; these rules make the page argue. A section that
follows none of them is documentation and belongs in the handbook.

- **Benefit before mechanism.** Lead with what the GM stops doing ("you run it
  instead of remembering it"); the how comes second. A heading that names a feature
  gets rewritten to name the relief.
- **A click within reach of every section.** The reader convinced at any scroll
  depth finds "Open the console" without hunting. Long pages repeat the CTA; the
  end of the page always offers it.
- **Proof beside claim.** A capability is shown next to its screenshot, its live
  count ("over 2000 creatures included"), or its named example, in the same
  section. An unproven superlative is cut.
- **Buttons say what happens**: "Open the console", "See it running", "Read the
  handbook". Never "Get started", "Learn more", or "Try now".
- **The section test.** Before adding a section, say what a GM does after reading
  it. If the answer is "knows more", it goes to the handbook and earns a link
  instead.

## Zones beyond the home page

- **Book landing pages are marketing surface.** Their job is a GM starting to read:
  pitch the book in the site's voice, prove it with an excerpt or a stat block, and
  hand over. The book's own voice starts at chapter one.
- **News posts are marketing with facts.** They announce in the site's voice and
  substantiate immediately: what shipped, what changed, what it looks like. Every
  claim in a news post is checkable in the release it announces. (The prose checker
  currently gates news posts with the documentation rules; that gate predates this
  guide and misfits this register. It stays until enforcement is revisited.)
- **The compendium index and library pages** present the content plainly; the pitch
  is the content itself.
- **Legal pages don't persuade.** Plain statements, and any edit to
  `src/pages/privacy.astro` or `terms.astro` bumps the `Last updated:` date in the
  same edit. Never change legal copy without it.

## Page mechanics

- One `<h1>` per page. A clear `description` in the layout's meta, written for
  someone deciding whether to click a search result.
- Every screenshot has alt text that describes the scene, not the feature name.
- Headings and buttons in sentence case, per the core.
- Aim at WCAG 2.2 AA for everything built by hand here.

## Before you publish

- [ ] The page's job is stated in one sentence, and every section serves it.
- [ ] A convinced reader can reach "Open the console" from any scroll depth.
- [ ] Every claim is provable in the app today, and its proof sits beside it.
- [ ] At most one contrast or aside per passage; the plainness holds between them.
- [ ] Buttons say what happens.
- [ ] Terminology matches the core's words table; 5.5e is named before 5e.
- [ ] Legal pages touched? The `Last updated:` date moved with them.

---

# The books

The creature libraries this repo publishes (_The Waking Garden_, _Brood & Bloom_,
_On Strong Waters and Potent Simples_) and their print editions are game text, not
documentation, and not site copy. They follow the game's own house style.

**Lore is exempt** from the plain-instruction rules, but not from restraint. A
creature's `description`, and the flavor passages that open a chapter, keep their
authored voice. Everything else follows the register below: chapter and section
prose, encounter write-ups, tables, and stat blocks. The mechanics (numbers, term
capitalization, wording) are in the shared core's "Game text mechanics".

## Register

Game text has two registers, and the line between them is strict:

- **Rules text is neutral.** State what a thing is, what it does, and the numbers, in
  declarative sentences. No drama, no wit, no build-up.
- **State intent, not instruction.** Describe how a creature or rule is meant to behave, as in
  "the clutch exists to place latchlings, not to deal damage". Never say how the Game Master
  must run it. No "the correct play is", "should be played as", "worth conveying". The
  Game Master runs everything as they wish.
- **End on information.** Don't close a section or a paragraph on an aphorism or a
  punchline. The last sentence carries a fact, like every other sentence.
- **Lore may carry color, sparingly.** Chapter openings and creature descriptions can have
  voice and an occasional light joke. Plain beats ornate; one image per passage is enough.
- **The book may say "we".** The authorial "we" ("in this book, we refer to them as
  diseases") is fine in game content; the core words table's ban on "we" is for
  the app and its documentation.

A stat block may be followed by a **Running it** note. It states the creature's intended
behavior and its rule interactions, in the neutral register, and nothing else.
