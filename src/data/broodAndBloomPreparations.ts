// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Nicola Mustone

import { entryLookup, entrySlug } from './statblock.ts';

export interface Preparation {
  name: string;
  form: 'Draught' | 'Fume' | 'Poison' | 'Unguent';
  brood: 'Inquiline' | 'Necrophore' | 'Sporophore';
  rarity: 'Common' | 'Uncommon' | 'Rare';
  price: string;
  source: 'House' | 'Trade' | 'Hands';
  summary: string;
  rule: string;
}

// Source order is the catalog order: cheapest first within House, Trade, then Hands.
export const preparations: Preparation[] = [
  {
    name: 'Compline',
    form: 'Fume',
    brood: 'Sporophore',
    rarity: 'Common',
    price: '8 sp',
    source: 'House',
    summary: 'Driftlings and spore veils will not enter a 30-foot radius for 8 hours',
    rule: 'Burned at a camp. For 8 hours, driftlings and spore veils will not enter a 30-foot radius. It does nothing to anything larger and gives no protection against contaminated ground.',
  },
  {
    name: 'House pitch',
    form: 'Unguent',
    brood: 'Sporophore',
    rarity: 'Common',
    price: '15 sp',
    source: 'House',
    summary:
      'Advantage on saves against contaminated ground for 1 hour; latchkin attach at Disadvantage',
    rule: 'Worked into boots, cuffs, and door frames. For 1 hour the wearer has Advantage on saving throws against a contaminated area, and any latchkin attempting to attach to them has Disadvantage on the attempt. The first effect is the pitch itself, which seals cloth and skin against anything settling on them. The second is an accident nobody planned and every house now relies on: a latchkin cannot get a grip on tar, and the sourness reads to it as ground that has already been taken. An almoner does not wear it.',
  },
  {
    name: 'Ablution',
    form: 'Draught',
    brood: 'Sporophore',
    rarity: 'Common',
    price: '20 gp',
    source: 'House',
    summary: 'Reduces the drinker’s Spore Load by 1d4',
    rule: 'Reduces the drinker’s Spore Load by 1d4. It works on the Load and nothing else. A disease already contracted at a full Load is untouched by it, and treating one of those is a separate formula in the same cupboard.',
  },
  {
    name: 'Collyrium',
    form: 'Unguent',
    brood: 'Sporophore',
    rarity: 'Common',
    price: '25 gp',
    source: 'House',
    summary: 'Reads grafts and Spore Load within 30 feet for 1 hour',
    rule: 'Smeared below the eyes. For 1 hour, the wearer can tell at a glance whether a creature they can see within 30 feet carries a graft or a Spore Load, and can name the line of a graft by the color it shows. It reads nothing about depth or quantity, and it reads a body under Countenance as clean.',
  },
  {
    name: 'Sounding',
    form: 'Unguent',
    brood: 'Necrophore',
    rarity: 'Common',
    price: '35 gp',
    source: 'House',
    summary: 'Shows whether a corpse has been laid in, and roughly how much',
    rule: 'Spread across a corpse. Over the next minute the wax sinks wherever something has been laid in, leaving dark channels that can be counted. A sounding tells whether a body has been laid in and roughly how much is in it. It says nothing about how long ago, and it does not work on a body treated with chrism.',
  },
  {
    name: 'Vigil',
    form: 'Draught',
    brood: 'Inquiline',
    rarity: 'Uncommon',
    price: '90 gp',
    source: 'House',
    summary: 'No Depth from the next Long Rest, and no benefit from it either',
    rule: 'The drinker gains no Depth from their next Long Rest. They also gain no benefit from that rest: no Hit Points recovered, no Hit Point Dice returned, no spell slots restored, and Exhaustion is not reduced. A graft cannot be slept away, and this is the only thing in the order’s cupboard that answers the problem. Officers escorting a case to a house live on it.',
  },
  {
    name: 'Lavage',
    form: 'Draught',
    brood: 'Sporophore',
    rarity: 'Uncommon',
    price: '100 gp',
    source: 'House',
    summary:
      'Removes 1d4 Depth when taken within 1 minute of gaining a graft; always deals 2d6 Acid damage',
    rule: 'A creature that drinks a lavage within 1 minute of gaining a graft removes 1d4 Depth and takes 2d6 Acid damage that cannot be reduced or prevented. A lavage taken later than that does the damage and nothing else.',
  },
  {
    name: 'Pastille',
    form: 'Fume',
    brood: 'Sporophore',
    rarity: 'Uncommon',
    price: '110 gp',
    source: 'House',
    summary: 'Suppresses a contaminated area in a 20-foot Cube for 1 hour',
    rule: 'Burned in place. Suppresses the effect of a contaminated area in a 20-foot Cube for 1 hour. It does not clear the ground, kill what is producing it, or prevent the area returning the moment the smoke thins. Houses use it to move patients along a corridor and nothing else.',
  },
  {
    name: 'Chrism',
    form: 'Unguent',
    brood: 'Sporophore',
    rarity: 'Uncommon',
    price: '120 gp',
    source: 'House',
    summary: 'Nothing of the Necrophore lays in the corpse for 10 days',
    rule: 'Anointed on a corpse dead no more than a day. The body dries from the outside in, and nothing of the Necrophore will lay in it for the next 10 days. Anything already laid in it dies. A party that carries chrism does not leave a colony anything to work with, which is the only reliable way to travel through worked ground without feeding it.',
  },
  {
    name: 'Wakelight taper',
    form: 'Fume',
    brood: 'Necrophore',
    rarity: 'Uncommon',
    price: '130 gp',
    source: 'House',
    summary: 'Draws Necrophore creatures within 300 feet, for 1 hour',
    rule: 'Burns for 1 hour. Any Necrophore creature within 300 feet that can see the light moves toward the taper by the most direct route available. A taper left burning at a distance is the cheapest way to clear ground. A taper is planted, never carried.',
  },
  {
    name: 'Cerate',
    form: 'Unguent',
    brood: 'Sporophore',
    rarity: 'Uncommon',
    price: '150 gp',
    source: 'House',
    summary: 'Halves the damage of removing a graft by surgery',
    rule: 'Applied during the removal of a graft by [surgery](/brood-and-bloom/chapter-4/#surgery-and-amputation). The surgery deals half damage. A prosector who has run out says so before starting, and the patient is entitled to refuse.',
  },
  {
    name: 'Theriac',
    form: 'Draught',
    brood: 'Sporophore',
    rarity: 'Rare',
    price: '600 gp',
    source: 'House',
    summary: 'Reduces a Sporophore disease by one stage after a Long Rest',
    rule: 'A creature that drinks a theriac and then completes a Long Rest reduces a contracted Sporophore disease by one stage. It has no effect at stage 4 and none on Spore Load.',
  },
  {
    name: 'Bloom oil',
    form: 'Poison',
    brood: 'Sporophore',
    rarity: 'Uncommon',
    price: '200 gp',
    source: 'Trade',
    summary:
      'DC 14 Constitution save; 2d6 Poison damage and 1 Spore Load on a failure, or half damage on a success',
    rule: 'Coats one weapon or up to three pieces of ammunition. The first creature hit makes a DC 14 Constitution saving throw, taking 2d6 Poison damage and gaining 1 Spore Load on a failed save, or half as much damage and no Load on a successful one.',
  },
  {
    name: 'Ankylotic salt',
    form: 'Poison',
    brood: 'Sporophore',
    rarity: 'Uncommon',
    price: '250 gp',
    source: 'Trade',
    summary:
      'DC 15 Constitution save; on a failure, Speed is halved and Dexterity saves have Disadvantage for 8 hours',
    rule: 'Ingested, one dose. A creature that swallows it makes a DC 15 Constitution saving throw at the end of the next hour. On a failed save its Speed is halved and it has Disadvantage on Dexterity saving throws for 8 hours as the joints stiffen. On a successful one the hour is merely unpleasant.',
  },
  {
    name: 'Wakelight dust',
    form: 'Poison',
    brood: 'Necrophore',
    rarity: 'Uncommon',
    price: '300 gp',
    source: 'Trade',
    summary: 'Marks a target for 8 hours and draws Necrophore creatures within 300 feet',
    rule: 'Thrown. On a hit the target is marked for 8 hours, and any Necrophore creature within 300 feet that can see the target moves toward it by the most direct route available. Washing it off takes 10 minutes and a great deal of water.',
  },
  {
    name: 'Adipocere',
    form: 'Poison',
    brood: 'Necrophore',
    rarity: 'Rare',
    price: '750 gp',
    source: 'Trade',
    summary:
      'DC 16 Constitution save; 4d6 Poison damage, the Poisoned condition for 1 hour, and no regained Hit Points on a failure',
    rule: 'Injury poison, one dose. A creature that takes damage from a coated weapon makes a DC 16 Constitution saving throw, taking 4d6 Poison damage and gaining the Poisoned condition for 1 hour on a failed save, or half as much damage and no condition on a successful one. While Poisoned this way the creature can’t regain Hit Points.',
  },
  {
    name: 'Countenance',
    form: 'Draught',
    brood: 'Inquiline',
    rarity: 'Common',
    price: 'Not sold',
    source: 'Hands',
    summary: 'Suppresses the drinker’s current stage for 24 hours',
    rule: 'Suppresses the effects of the drinker’s current stage for 24 hours, beginning at once. Depth accrues as normal and the graft deepens as normal. No effect at stage 4. While it holds, the drinker does not present the marks of their stage, and no Wisdom (Medicine) check can identify the disease. A Detect Poison and Disease spell finds the graft regardless.',
  },
  {
    name: 'Kenotic draught',
    form: 'Draught',
    brood: 'Inquiline',
    rarity: 'Rare',
    price: 'Not sold',
    source: 'Hands',
    summary: 'The drinker takes a graft, with no parasite present',
    rule: 'The drinker takes a graft, rolled for location and line as though a parasite had fed on them, with no parasite present. The formula sits in part IV of the True File, and most ostiaries refuse to make it: the book holds that a rite performed out of a bottle is not a rite, and a cell reaching for one has usually lost the clutch it needs to hold a Kenotics.',
  },
  {
    name: 'Sallow tincture',
    form: 'Poison',
    brood: 'Inquiline',
    rarity: 'Rare',
    price: 'Not sold',
    source: 'Hands',
    summary: 'A creature carrying a graft gains 1d4 Depth, with no saving throw',
    rule: 'Ingested or injury, one dose. A creature already carrying a graft gains 1d4 Depth with no saving throw. A creature carrying no graft is unaffected and never learns it was dosed. The order has never made it. Part V of the True File names it in passing as something a hand should not need.',
  },
];

/** Look a preparation up by name. Throws at build time on a typo. */
export const preparation = entryLookup(preparations, 'Brood & Bloom', 'preparation');

/** Return the stable fragment destination for a preparation. */
export const preparationAnchor = (name: string): string => `p-${entrySlug(name)}`;
