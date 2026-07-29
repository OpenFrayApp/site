// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors
// @vitest-environment node
// Node, not jsdom: the container pulls in esbuild, whose startup invariant trips over
// jsdom's patched Uint8Array. JSDOM is imported directly for parsing instead.

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Creature } from '../../src/schema/creature.ts';
import StatBlock from '../src/components/StatBlock.astro';
import Creature_ from '../src/components/Creature.astro';
import ActionList from '../src/components/ActionList.astro';
import StatText from '../src/components/StatText.astro';

// One fixture exercising every section: proficient + fallback saves, both immunity
// kinds, gear, recharge, legendary costs, and every spellcasting usage tier.
const FIXTURE: Creature = {
  id: 'test:thornling',
  source: 'openfray-waking-garden',
  edition: '5.5',
  name: 'Thornling',
  size: 'Small',
  type: 'plant',
  alignment: 'unaligned',
  description: 'A test seedling.',
  ac: 13,
  maxHp: 22,
  hpFormula: '4d6+8',
  initiative: 2,
  speed: { walk: 20, climb: 10 },
  abilities: { str: 8, dex: 14, con: 14, int: 6, wis: 12, cha: 7 },
  saves: { dex: 4 },
  skills: { sleightOfHand: 4 },
  senses: { passivePerception: 13, darkvision: 60 },
  languages: ['Sylvan'],
  gear: ['Thorn dagger'],
  resistances: ['Poison'],
  immunities: ['Acid'],
  vulnerabilities: ['Fire'],
  conditionImmunities: ['Charmed', 'Frightened'],
  cr: 1,
  xp: 200,
  traits: [{ name: 'Rooted', text: 'Advantage against being moved.' }],
  actions: [
    {
      id: 'a1',
      name: 'Thorn Jab',
      kind: 'melee',
      toHit: 4,
      text: 'Hit: 5 (1d6+2) Piercing damage.',
      recharge: { type: 'dice', value: 5 },
    },
  ],
  legendaryActions: {
    perRound: 2,
    actions: [
      { id: 'l1', name: 'Snap', kind: 'melee', toHit: null, legendaryCost: 2, text: 'Jab.' },
    ],
  },
  spellcasting: {
    ability: 'wis',
    saveDc: 12,
    groups: [
      { usage: { type: 'atWill' }, spells: [{ name: 'entangle' }] },
      { usage: { type: 'perDay', per: 2 }, spells: [{ name: 'speak with plants' }] },
    ],
    note: 'Casts quietly.',
  },
};

let container: AstroContainer;
let doc: Document;

beforeAll(async () => {
  container = await AstroContainer.create();
  const html = await container.renderToString(StatBlock, { props: { creature: FIXTURE } });
  doc = new JSDOM(html).window.document;
});

describe('StatBlock', () => {
  it('anchors the block by its slug and folds it into a details accordion', () => {
    expect(doc.querySelector('section.statblock')!.id).toBe('thornling');
    expect(doc.querySelector('details.sb-fold summary .sb-name')!.textContent).toBe('Thornling');
  });

  it('composes the kicker with a space between size and type', () => {
    // Built as one expression: as separate lines Astro collapsed the whitespace
    // and the block read "SmallPlant, Unaligned".
    expect(doc.querySelector('.sb-kicker')!.textContent).toBe('Small Plant, Unaligned');
  });

  it('prints the top line: AC, derived initiative, HP with formula, speeds', () => {
    const top = doc.querySelector('.sb-top')!.textContent!;
    expect(top).toContain('AC13');
    expect(top).toContain('+2 (12)');
    expect(top).toContain('22 (4d6+8)');
    expect(top).toContain('20 ft., Climb 10 ft.');
  });

  it('shows a proficient save and falls back to the modifier for the rest', () => {
    const cells = [...doc.querySelectorAll('.sb-abilities tbody td')].map((td) => td.textContent);
    // STR row: score 8, mod −1, save −1 (fallback). DEX row: 14, +2, save +4 (proficient).
    expect(cells).toContain('−1');
    expect(cells).toContain('+4');
  });

  it('joins damage and condition immunities on one line, semicolon between', () => {
    const traits = doc.querySelector('.sb-traits-list')!.textContent!;
    expect(traits).toContain('Acid; Charmed, Frightened');
    expect(traits).toContain('Sleight Of Hand +4');
    expect(traits).toContain('Thorn dagger');
    expect(traits).toContain('1 (XP 200; PB +2)');
  });

  it('labels a rechargeable action and a costed legendary action', () => {
    const text = doc.body.textContent!;
    expect(text).toContain('Thorn Jab (Recharge 5–6).');
    expect(text).toContain('Legendary Actions (2/round)');
    expect(text).toContain('Snap (Costs 2 Actions).');
  });

  it('prints the spellcasting tiers in compendium casing with the DC line', () => {
    const text = doc.body.textContent!;
    expect(text).toContain('Spell save DC 12, using WIS.');
    expect(text).toContain('At will: Entangle');
    expect(text).toContain('2/day each: Speak with Plants');
    expect(text).toContain('Casts quietly.');
  });
});

describe('Creature', () => {
  it('renders a real compendium entry by name, with extras in the slotted rail', async () => {
    const html = await container.renderToString(Creature_, {
      props: { name: 'Gardener' },
      slots: { default: '<p>Regional effects.</p>' },
    });
    const page = new JSDOM(html).window.document;
    expect(page.querySelector('article.entry')!.id).toBe('c-gardener');
    expect(page.querySelector('.statblock .sb-name')!.textContent).toBe('Gardener');
    expect(page.querySelector('.entry-extras')!.textContent).toContain('Regional effects.');
  });
});

describe('ActionList', () => {
  it('renders nothing at all for an empty section', async () => {
    const html = await container.renderToString(ActionList, {
      props: { heading: 'Reactions', actions: [] },
    });
    expect(html.trim()).toBe('');
  });
});

describe('StatText', () => {
  it('renders block markdown (a table) through the shared markdown pipeline', async () => {
    const html = await container.renderToString(StatText, {
      props: { label: 'Graft', text: '| d4 | Graft |\n| --- | --- |\n| 1 | Thorns |' },
    });
    const page = new JSDOM(html).window.document;
    const cells = [...page.querySelectorAll('.sb-entry-block table td')].map((c) => c.textContent);
    expect(cells).toEqual(['1', 'Thorns']);
    expect(page.querySelector('.sb-entry-block strong')!.textContent).toBe('Graft.');
  });
});
