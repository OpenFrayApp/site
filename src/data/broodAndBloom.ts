import type { Creature } from '../../../src/schema/creature.ts';
import creaturesJson from '../../../public/compendium/brood-and-bloom-creatures.json';
import { creatureLookup } from './statblock.ts';

// The bestiary renders the same file the console fetches at runtime, so a stat block
// on this page and one in the app can never disagree. The JSON is generated from
// brood-and-bloom.ts in the openfray-compendium repo; edit it there, never here.
// A JSON import widens the union fields (`size`, damage `type`, …) to plain strings,
// hence the assertion — the shapes are otherwise identical.
export const creatures = creaturesJson as unknown as Creature[];

/** Look a creature up by its compendium name. Throws at build time on a typo. */
export const creature = creatureLookup(creatures, 'Brood & Bloom');
