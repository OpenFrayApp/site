// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { creatures } from '../src/data/broodAndBloom.ts';
import { preparations, preparationAnchor } from '../src/data/broodAndBloomPreparations.ts';
import { spells } from '../src/data/broodAndBloomSpells.ts';
import { entrySlug } from '../src/data/statblock.ts';

const contentDirectory = resolve('src/content/brood-and-bloom');

/** Read every Brood & Bloom chapter source by its content id. */
async function chapters() {
  const entries = new Map<string, string>();

  for (const path of await readdir(contentDirectory)) {
    if (path.endsWith('.mdx')) {
      entries.set(basename(path, '.mdx'), await readFile(resolve(contentDirectory, path), 'utf8'));
    }
  }

  return entries;
}

/** Read a front-matter field whose value is a single-quoted string or number. */
function frontMatter(source: string, field: string) {
  return source.match(new RegExp(`^${field}: '?([^'\n]+)'?$`, 'm'))?.[1];
}

/** Find the stat-block names rendered directly by a chapter. */
function creatureNames(source: string) {
  return [...source.matchAll(/<Creature\b[^>]*name="([^"]+)"/g)].map(([, name]) => name);
}

/** Collapse authored line wrapping so prose contracts read as sentences. */
function normalized(source: string) {
  return source.replace(/\s+/g, ' ');
}

describe('Brood & Bloom book integrity', () => {
  it('keeps the overview, chapters, and appendices in one unique contiguous reading order', async () => {
    const entries = await chapters();
    const order = [...entries.entries()]
      .map(([id, source]) => ({ id, order: Number(frontMatter(source, 'order')) }))
      .sort((a, b) => a.order - b.order);

    expect(order).toEqual([
      { id: 'overview', order: 0 },
      { id: 'chapter-1', order: 1 },
      { id: 'chapter-2', order: 2 },
      { id: 'chapter-3', order: 3 },
      { id: 'chapter-4', order: 4 },
      { id: 'chapter-5', order: 5 },
      { id: 'chapter-6', order: 6 },
      { id: 'chapter-7', order: 7 },
      { id: 'appendix-a', order: 8 },
      { id: 'appendix-b', order: 9 },
      { id: 'appendix-c', order: 10 },
    ]);
  });

  it('uses sentence case for chapter and appendix titles', async () => {
    const entries = await chapters();

    expect(frontMatter(entries.get('chapter-7')!, 'title')).toBe('Alchemy & magic');
    expect(frontMatter(entries.get('appendix-a')!, 'title')).toBe('Index: by Challenge Rating');
    expect(frontMatter(entries.get('appendix-b')!, 'title')).toBe('Index: by type');
    expect(frontMatter(entries.get('appendix-c')!, 'title')).toBe('Index: alchemy & magic');
  });

  it('places every primary Lazaret topic directly under the chapter title', async () => {
    const lazaret = (await chapters()).get('chapter-2')!;
    const headings = [...lazaret.matchAll(/^(#{2,3}) (.+)$/gm)].map(([, marks, text]) => ({
      depth: marks.length,
      text,
    }));

    expect(headings).toEqual(
      ['Order', 'Houses', 'Ranks', 'Classifications', 'Doctrine', 'Officers'].map((text) => ({
        depth: 2,
        text,
      })),
    );
  });

  it('matches declared brood counts, stat-block placements, and the verified total', async () => {
    const entries = await chapters();
    const declaredCounts = new Map([
      ['chapter-2', { count: 3, declaration: 'three officers' }],
      ['chapter-3', { count: 6, declaration: 'six creatures' }],
      ['chapter-4', { count: 15, declaration: 'fifteen creatures' }],
      ['chapter-5', { count: 24, declaration: 'twenty-four creatures' }],
      ['chapter-6', { count: 19, declaration: 'nineteen creatures' }],
    ]);
    const placements = [...declaredCounts].flatMap(([id, { count }]) => {
      const names = creatureNames(entries.get(id)!);
      expect(names).toHaveLength(count);
      return names;
    });

    for (const [id, { declaration }] of declaredCounts) {
      if (declaration) {
        expect(frontMatter(entries.get(id)!, 'description')).toContain(declaration);
      }
    }
    expect(placements).toHaveLength(creatures.length);
    expect(new Set(placements)).toEqual(new Set(creatures.map((creature) => creature.name)));
  });

  it('sends readers from the overview to every prerequisite, brood, and appendix lookup', async () => {
    const overview = (await chapters()).get('overview')!;

    expect(overview).toContain(
      '**[Chapter 3](/brood-and-bloom/chapter-3/)** is the people. It covers the cult',
    );
    expect(overview).toContain(
      '**[Chapter 7](/brood-and-bloom/chapter-7/)** holds the alchemy and the',
    );

    for (const destination of [
      '/brood-and-bloom/chapter-1/',
      '/brood-and-bloom/chapter-2/',
      '/brood-and-bloom/chapter-3/',
      '/brood-and-bloom/chapter-4/',
      '/brood-and-bloom/chapter-5/',
      '/brood-and-bloom/chapter-6/',
      '/brood-and-bloom/chapter-7/',
      '/brood-and-bloom/appendix-a/',
      '/brood-and-bloom/appendix-b/',
      '/brood-and-bloom/appendix-c/',
    ]) {
      expect(overview).toContain(`](${destination})`);
    }
  });

  it('resolves tied Inquiline lines and names exact stages in shared magic guidance', async () => {
    const sharedRules = normalized((await chapters()).get('chapter-1')!);

    expect(sharedRules).toContain(
      'If the highest scores tie across rows, the Game Master chooses which tied score sets the line.',
    );
    expect(sharedRules).toContain('| Heal | Removes 3d4 Depth at stages 0–2, or 2d4 at stage 3');
    expect(sharedRules).toContain(
      '| Lesser Restoration | Detaches a lesser parasite, and removes 1d4 Depth at stages 0–2 | Removes 3 Spore Load, and cures stage 1 or reduces stage 2 to stage 1',
    );
    expect(sharedRules).toContain(
      '| Greater Restoration | Removes 2d4 Depth at stages 0–2, or 1d4 at stage 3 | Cures stages 1–2, or reduces stage 3 to stage 2',
    );
  });

  it('gives the Kenotics one complete graft procedure and a defined failure', async () => {
    const cult = normalized((await chapters()).get('chapter-3')!);

    expect(cult).toContain(
      'The ostiary lets one latchling attach to the candidate. The rite roots only if the latchling’s first feeding action resolves.',
    );
    expect(cult).toContain(
      'That feeding creates a [graft](/brood-and-bloom/chapter-4/#the-graft) at 1 Depth, before any disease has presented (stage 0).',
    );
    expect(cult).toContain(
      'If the latchling fails to attach or is removed before that feeding resolves, the Kenotics fails: the candidate has no graft and gains no Depth.',
    );
    expect(cult).toContain(
      'The cult calls such a candidate a Failed Postulant. This is an exceptional title, not a grade:',
    );
  });

  it('keeps the Hands’ titles, clutch duties, and Countenance schedule coherent', async () => {
    const cult = normalized((await chapters()).get('chapter-3')!);

    expect(cult).toContain(
      'The cult has no ranks. Grade records a hand’s disease stage, while office records the work assigned to them.',
    );
    expect(cult).toContain(
      'A cell keeps [latchkin](/brood-and-bloom/chapter-4/), the common name for inquilines.',
    );
    expect(cult).toContain('at [Matins](#matins), the daily Countenance queue');
    expect(cult).toContain(
      '| Ostiary | Office | Guards the clutch, controls access to it, feeds it, and performs the Kenotics. Usually stage 2 |',
    );
    expect(cult).toContain(
      '| Sacristan | Office | Harvests the clutch and prepares, counts, and issues the cell’s measures. Usually stage 3 |',
    );
    expect(cult).toContain(
      'Office is assigned by ability, not promotion. Almoners hold theirs before initiation; a hand is given an office while they can perform it and loses it when they cannot.',
    );
    expect(cult).toContain(
      'Every member described by these titles is a person; Translation alone names an outcome.',
    );
    expect(cult).toContain(
      'A postulant is a newly grafted hand: fed on once, carrying a graft whose disease has not presented, and dosed with Countenance from the day of the rite.',
    );
    expect(cult).not.toContain('A postulant is a hand in their first weeks');
    expect(cult).toContain('A measure is one dose of the Countenance draught.');
    expect(cult).toContain(
      'Each measure or casting lasts 24 hours from the moment that hand takes it.',
    );
    expect(cult).toContain(
      'If Matins is delayed, a hand’s symptoms return when their own 24 hours end, which can happen while they wait in the queue.',
    );
    expect(cult).not.toContain('keeps the clutch, harvests it');
  });

  it('gives every Lazaret lector the same required field history', async () => {
    const lazaret = normalized((await chapters()).get('chapter-2')!);

    expect(lazaret).toContain(
      '**Lector.** Runs a house. Every lector served as a prosector first. Lectors diagnose, teach, and decide who is admitted.',
    );
    expect(lazaret).toContain(
      'Every lector served as a prosector first, which is why the officer running a house is the strongest the order fields.',
    );
    expect(lazaret).not.toContain('A lector who never served as a prosector');
  });

  it('defines Inquiline diagnosis, physician training, expulsion, and pre-onset surgery', async () => {
    const inquiline = normalized((await chapters()).get('chapter-4')!);

    expect(inquiline).toContain(
      'Any creature can make this check; proficiency in Medicine is not required.',
    );
    expect(inquiline).toContain(
      'In this chapter, a trained physician is a creature proficient in Medicine.',
    );
    expect(inquiline).toContain(
      'Chantry Expulsion cannot begin while the host has an unexpended spell slot, is affected by ongoing magic, or occupies a magical aura or location.',
    );
    expect(inquiline).toContain(
      'Carrying an unused magic item or having an unused magical feature does not restart the process.',
    );
    expect(inquiline).toContain(
      'Treat a graft with no presented disease as stage 0 when calculating this Difficulty Class.',
    );
  });

  it('makes Inquiline disease stages cumulative and bounds Zone of Truth', async () => {
    const inquiline = normalized((await chapters()).get('chapter-4')!);

    expect(inquiline).toContain(
      'Disease-stage effects are cumulative unless a later stage explicitly replaces an earlier value.',
    );
    expect(inquiline).toContain(
      'Zone of Truth tests whether an Amanuensis speaks sincerely, not whether its account is factually accurate.',
    );
    expect(inquiline).not.toContain('beyond the reach of anything but surgery');
    expect(inquiline).not.toContain('extraction comes first, always');
  });

  it('keeps Sporophore classification and lifecycle terms distinct from disease stages', async () => {
    const entries = await chapters();
    const sharedRules = normalized(entries.get('chapter-1')!);
    const sporophore = normalized(entries.get('chapter-5')!);

    for (const source of entries.values()) {
      expect(source).not.toMatch(/\bsporophore\b/);
    }
    expect(sharedRules).toContain(
      'A driftling that settles undisturbed for 24 hours becomes the first settled form for whatever it landed on:',
    );
    expect(sporophore).toContain(
      'a first settled form of the winning colony grows from the remains within 1d4 days',
    );
    expect(sharedRules).not.toContain('stage 2 creature');
    expect(sporophore).not.toContain('stage 2 creature');
  });

  it('places the Challenge Rating 8 contamination rule beside spore actions', async () => {
    const sporophore = normalized((await chapters()).get('chapter-5')!);

    expect(sporophore).toMatch(
      /### Spore actions .*?<Note type="Challenge Rating 8">.*?a spore action grants 1 Spore Load even on a successful saving throw.*?<\/Note>.*?### Variant: running dry/,
    );
  });

  it('defines Sporophore recession, treatment, and physician qualification', async () => {
    const sporophore = normalized((await chapters()).get('chapter-5')!);

    expect(sporophore).toContain(
      'Recession is the Long Rest save above. Restoration magic and remedies reduce a disease directly, while a successful procedure ends it; none of these treatments count as recession.',
    );
    expect(sporophore).toContain(
      'In this chapter, a trained physician is a creature proficient in Medicine.',
    );
  });

  it('defines the Calcination threshold and one fixed Metaplasia reference point', async () => {
    const sporophore = normalized((await chapters()).get('chapter-5')!);

    expect(sporophore).toContain(
      'The Game Master determines whether the current weather is warm or cool enough to trigger this effect, and that determination remains fixed until the weather or the creature’s shelter changes.',
    );
    expect(sporophore).toContain(
      'record the location where it received the sixth point as its colony reference point',
    );
    expect(sporophore).toContain(
      'Metaplasia measures direction and distance from that fixed point, even if the growth there moves or is destroyed.',
    );
  });

  it('keeps Sporophore guidance concrete', async () => {
    const sporophore = normalized((await chapters()).get('chapter-5')!);

    expect(sporophore).not.toContain('**Running it.**');
    expect(sporophore).not.toContain('barely contagious');
    expect(sporophore).not.toContain('best decided');
  });

  it('gives Necrophore death, seeding, laying, and hatching one chronology', async () => {
    const necrophore = normalized((await chapters()).get('chapter-6')!);

    expect(necrophore).toContain(
      'An eligible corpse has been dead no longer than 24 hours and contains no living sallow graft.',
    );
    expect(necrophore).toContain(
      'Inside established colony ground, an eligible corpse that remains unseeded becomes seeded exactly 3 hours after death.',
    );
    expect(necrophore).toContain(
      'This 3-hour rule applies only to established ground and replaces the adult-arrival roll there.',
    );
    expect(necrophore).toContain(
      'Outside established ground, 1d4 adults arrive 1d6 + 2 hours after a death that draws them: a minimum of 3 hours and a maximum of 8.',
    );
    expect(necrophore).toContain(
      'The larvae emerge 1d6 + 2 hours after laying: a minimum of 3 hours and a maximum of 8.',
    );
    expect(necrophore).toContain(
      'A corpse seeded by the fixed 3-hour rule therefore hatches 6–11 hours after death; a corpse first reached by arriving adults hatches 6–16 hours after death.',
    );
    expect(necrophore).toContain(
      'A Crypt Instar must first feed on the dead for 30 days and grow into a Sepulchre Nymph.',
    );
    expect(necrophore).toContain(
      'the larva seals where it stands as a husk, and 1 hour later the husk splits and the adult takes its first turn.',
    );
  });

  it('keeps one canonical sallow-corpse rule and links every lifecycle summary to it', async () => {
    const entries = await chapters();
    const allContent = normalized([...entries.values()].join('\n'));

    expect(
      allContent.match(/A corpse with a living sallow graft cannot be seeded\./g),
    ).toHaveLength(1);
    expect(entries.get('chapter-1')).toContain(
      '[sallow exception](/brood-and-bloom/chapter-6/#reproduction)',
    );
    for (const id of ['chapter-3', 'chapter-4']) {
      expect(entries.get(id)).toContain(
        '[Necrophore sallow exception](/brood-and-bloom/chapter-6/#reproduction)',
      );
    }
  });

  it('identifies a cult cell’s allied Necrophore and uses exact husk entry names', async () => {
    const entries = await chapters();
    const cult = normalized(entries.get('chapter-3')!);
    const necrophore = normalized(entries.get('chapter-6')!);

    expect(cult).toContain(
      'When a cell appears, the Game Master chooses whether its allied adult is an Emberwing, Tallow Imago, or Reliquary Imago.',
    );
    for (const husk of ['Cinder Nit Husk', 'Gravewax Grub Husk', 'Sepulchre Nymph Husk']) {
      expect(necrophore).toMatch(new RegExp(`\\| [^|]+ \\| ${husk} \\|`));
    }
  });

  it('defines every brood harvest on the canonical alchemy surface', async () => {
    const entries = await chapters();
    const alchemy = normalized(entries.get('chapter-7')!);

    expect(alchemy).toContain(
      'An Inquiline harvest is tissue cut from one living Inquiline. The material can be carried, but remains workable only until 1 hour after it is cut.',
    );
    expect(alchemy).toContain(
      'A Sporophore harvest is one usable portion cut from one dead Sporophore whose body was not damaged by Fire.',
    );
    expect(alchemy).toContain(
      'A living Rotgill Fleece is the exception to the death requirement and the usual harvesting procedure.',
    );
    expect(alchemy).toContain(
      'The severed portion provides one harvest whether the check succeeds or fails.',
    );
    expect(alchemy).toContain(
      'A Necrophore harvest is wax, tallow, or wakelight taken from one dead Necrophore within 24 hours of its death.',
    );
    expect(alchemy).toContain(
      'The brood named in a recipe is the harvest it consumes under Materials.',
    );
    expect(alchemy).toContain(
      'Every harvest must still be workable when crafting begins; once the work begins, it remains usable through the listed crafting time.',
    );
    expect(alchemy).toContain('| Rarity | Time | DC | Materials | Yield |');
    expect(alchemy).not.toContain('Yield per harvest');
    expect(alchemy).toContain('A full day of reduction from three harvested portions');
    expect(alchemy).not.toContain('Four days of reduction from a full fleece');

    for (const id of ['chapter-4', 'chapter-5', 'chapter-6']) {
      expect(entries.get(id)).not.toMatch(/^## Harvesting$/m);
    }
    expect(entries.get('chapter-5')).toContain(
      '[harvesting rules](/brood-and-bloom/chapter-7/#materials)',
    );
  });

  it('keeps every detailed preparation and appendix synopsis in one canonical catalog', async () => {
    const entries = await chapters();
    const alchemy = normalized(entries.get('chapter-7')!);
    const appendix = entries.get('appendix-c')!;
    const detailedNames = [...alchemy.matchAll(/<Preparation name="([^"]+)">/g)].map(
      ([, name]) => name,
    );

    expect(preparations).toHaveLength(19);
    expect(new Set(preparations.map(({ name }) => preparationAnchor(name))).size).toBe(19);
    expect(detailedNames).toHaveLength(preparations.length);
    expect(new Set(detailedNames)).toEqual(new Set(preparations.map(({ name }) => name)));
    expect(appendix).toContain('<PreparationTable view="index" />');
    expect(appendix).not.toMatch(/^\| Preparation/m);
    const lavage = preparations.find(({ name }) => name === 'Lavage');
    expect(lavage?.summary).toBe(
      'Removes 1d4 Depth when taken within 1 minute of gaining a graft; always deals 2d6 Acid damage',
    );
    expect(lavage?.rule).toBe(
      'A creature that drinks a lavage within 1 minute of gaining a graft removes 1d4 Depth and takes 2d6 Acid damage that cannot be reduced or prevented. A lavage taken later than that does the damage and nothing else.',
    );
    expect(preparations.every(({ rule, summary }) => rule.length > summary.length)).toBe(true);
  });

  it('uses complete game terms and explicit outcomes in the preparation catalog', () => {
    const bloomOil = preparations.find(({ name }) => name === 'Bloom oil')!;
    const ankyloticSalt = preparations.find(({ name }) => name === 'Ankylotic salt')!;
    const wakelightDust = preparations.find(({ name }) => name === 'Wakelight dust')!;
    const adipocere = preparations.find(({ name }) => name === 'Adipocere')!;

    for (const preparation of [bloomOil, ankyloticSalt, adipocere]) {
      expect(preparation.summary).toContain('Constitution saving throw');
      expect(preparation.summary).not.toContain('Constitution save;');
    }
    expect(ankyloticSalt.summary).toContain('Dexterity saving throws');
    expect(ankyloticSalt.rule).toContain('On a successful saving throw, the poison has no effect.');
    expect(wakelightDust.rule).toContain('Washing it off with water takes 10 minutes.');
  });

  it('defines preparation crafting, thrown use, and consensual Lavage', async () => {
    const alchemy = normalized((await chapters()).get('chapter-7')!);

    expect(alchemy).toContain(
      'The character must use alchemist’s supplies or a herbalism kit, but need not be proficient with the chosen tool.',
    );
    expect(alchemy).toContain(
      'The check adds the character’s Intelligence modifier and, if the character is proficient with the chosen tool, their Proficiency Bonus.',
    );
    expect(alchemy).toContain(
      'Treat a thrown preparation as an improvised weapon with a normal range of 20 feet and a long range of 60 feet.',
    );
    expect(alchemy).toContain(
      'Make a ranged weapon attack using Dexterity, adding the attacker’s Proficiency Bonus only if they are proficient with improvised weapons.',
    );
    expect(alchemy).toContain(
      'Prosectors carry two and offer one immediately, leaving the patient to decide whether to drink it.',
    );
    expect(alchemy).not.toContain('use them without asking');
  });

  it('makes a rare spell source permission rather than automatic acquisition', async () => {
    const magic = normalized((await chapters()).get('chapter-7')!);

    expect(magic).toContain(
      'Finding a source makes its spell available under a class’s normal spell rules; it does not teach or prepare the spell by itself.',
    );
    expect(magic).toContain(
      'A Cleric, Druid, or Paladin can prepare a listed spell after finding its source; cantrips still follow the class’s cantrip rules.',
    );
    expect(magic).toContain(
      'A Wizard can copy a listed spell from the source into a spellbook, then prepare it normally.',
    );
    expect(magic).toContain(
      'A Sorcerer or Warlock can choose a listed spell when a class feature lets them learn or replace a spell.',
    );
  });

  it('distinguishes graft requirements, transfers, and Depth costs from stage 4', async () => {
    const magic = normalized((await chapters()).get('chapter-7')!);

    expect(magic).toContain(
      '[Instar](#s-instar), [Preferment](#s-preferment), and [Second Assignment](#s-second-assignment) require the caster to carry a graft before casting.',
    );
    expect(magic).toContain(
      '[Assumption of the Case](#s-assumption-of-the-case) transfers Depth to the caster and gives them a graft if they do not have one; Second Assignment transfers an existing graft between creatures.',
    );
    expect(magic).toContain(
      'Instar adds 1 Depth after using an existing graft, while Preferment advances an existing case by one full stage.',
    );
    expect(magic).toContain('Preferment is the only listed spell that reaches stage 4 directly.');
  });

  it('links every name in the level-based spell list to its detailed entry', async () => {
    const magic = (await chapters()).get('chapter-7')!;
    const levelList = magic.match(/### The spell list([\s\S]*?)### The cantrips/)?.[1] ?? '';

    for (const listedSpell of spells) {
      expect(levelList).toContain(`[${listedSpell.name}](#s-${entrySlug(listedSpell.name)})`);
      expect(magic).toContain(`<Spell name="${listedSpell.name}">`);
    }
  });

  it('keeps origin notes concrete about scarcity and discovery', async () => {
    const magic = normalized((await chapters()).get('chapter-7')!);

    expect(magic).toContain(
      'The remaining spells are held in the counter-work at the first house, whose catalog has never left the building.',
    );
    expect(magic).toContain(
      'The True File reaches a cell only as a copy in the founder’s hand, and most cells have never seen one.',
    );
    expect(magic).toContain(
      'A practitioner’s spell survives in a private notebook or spellbook, often wherever its writer last worked.',
    );
    for (const prediction of [
      'a party earns access',
      'most likely to find',
      'least likely to understand',
      'will spend cantrips',
      'nobody casts it',
      'ended their usefulness',
    ]) {
      expect(magic).not.toContain(prediction);
    }
  });
});
