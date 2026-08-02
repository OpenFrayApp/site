import type { Spell } from '../../../src/schema/spell.ts';
import spellsJson from '../../../public/compendium/strong-waters-spells.json';
import { spellLookup } from './statblock.ts';

// On Strong Waters and Potent Simples ships spells and no creatures, and the chapter
// that prints them renders the same file the console fetches at runtime — so a spell on
// the page and one in the app can never disagree. The JSON is generated from
// strong-waters-spells.ts in the openfray-compendium repo; edit it there, never here.
// A JSON import widens the union fields (damage `type`, `by`, …) to plain strings, hence
// the assertion — the shapes are otherwise identical.
export const spells = spellsJson as unknown as Spell[];

/** Look a spell up by its compendium name. Throws at build time on a typo. */
export const spell = spellLookup(spells, 'Strong Waters');
