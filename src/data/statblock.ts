// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import type { Recharge } from '../../../src/schema/action.ts';
import type { Creature, SpellGroup, Spellcasting } from '../../../src/schema/creature.ts';
import type { Spell } from '../../../src/schema/spell.ts';

// Stat-block formatting shared by every bestiary book. Each book's own module
// (wakingGarden.ts, broodAndBloom.ts, broodAndBloomSpells.ts) holds only its dataset
// and lookup.

/** Case-insensitive lookup over one book's dataset. Throws at build time on a typo,
 *  which is the point — a missing entry must fail the build, not render a blank card. */
export function entryLookup<T extends { name: string }>(
  entries: T[],
  book: string,
  kind: string,
): (name: string) => T {
  const byName = new Map(entries.map((e) => [e.name.toLowerCase(), e]));
  return (name) => {
    const found = byName.get(name.toLowerCase());
    if (!found) throw new Error(`${book}: no ${kind} named "${name}"`);
    return found;
  };
}

/** Case-insensitive creature lookup over one book's bestiary. */
export const creatureLookup = (creatures: Creature[], book: string): ((name: string) => Creature) =>
  entryLookup(creatures, book, 'creature');

/** Case-insensitive spell lookup over one book's spell list. */
export const spellLookup = (spells: Spell[], book: string): ((name: string) => Spell) =>
  entryLookup(spells, book, 'spell');

/** URL-safe id for an entry's section anchor, e.g. "the-harvest-crown". */
export const entrySlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A challenge rating as printed: fractions as "1/8"–"1/2", a missing CR as "—". */
export const formatCr = (cr: number | undefined): string => {
  if (cr == null) return '—';
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
};

/** Proficiency bonus for a challenge rating (2024 table). Mirrors the app's
 *  `proficiencyBonus` in src/compendium/format.ts. */
export const proficiencyBonus = (cr: number): number =>
  cr <= 4 ? 2 : 3 + Math.floor((Math.min(cr, 28) - 5) / 4) + (cr >= 29 ? 1 : 0);

/** The ability modifier for a score: (score − 10) / 2, rounded down. */
export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);

const LEVEL_ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/**
 * A spell group's usage heading: "At Will", "1st Level", "N/Day Each" or "N/Day". Worded
 * to match the console's own `usageLabel` (src/components/CreatureStatBlock.tsx).
 *
 * "N/Day" and "N/Day Each" are different rules — one pool between the listed spells
 * against one pool per spell — so the heading follows `usage.shared` rather than guessing.
 * The Fidele Angel's "1/Day: bless, daylight, hallow, …" is one casting from that list.
 */
export function usageLabel(group: SpellGroup): string {
  if (group.usage.type === 'atWill') return 'At Will';
  if (group.usage.type === 'slots') {
    return `${LEVEL_ORDINAL[group.usage.level] ?? `${group.usage.level}th`} Level`;
  }
  return `${group.usage.per}/Day${group.usage.shared ? '' : ' Each'}`;
}

/**
 * The Spellcasting intro line: casting ability, save DC, and spell attack bonus, when
 * known — "Casts using INT as the spellcasting ability, spell save DC 18, +10 to hit with
 * spell attacks." Deliberately word-for-word with the console's own `spellcastingHeader`
 * (src/components/CreatureStatBlock.tsx), so a block reads the same on the page and in the
 * app. They stay separate functions for the reason the rest of this module does: the site
 * prints a true minus sign and the app prints a hyphen.
 */
export function spellcastingLine(sc: Spellcasting): string {
  const bits = [
    sc.ability ? `${sc.ability.toUpperCase()} as the spellcasting ability` : null,
    sc.saveDc != null ? `spell save DC ${sc.saveDc}` : null,
    sc.toHit != null ? `${signed(sc.toHit)} to hit with spell attacks` : null,
  ].filter(Boolean);
  return bits.length ? `Casts using ${bits.join(', ')}.` : 'Casts the following spells.';
}

/** Signed modifier the way a stat block prints it, with a true minus sign. */
export const signed = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

/** Uppercase the first letter of every word; the rest of each word is left as is. */
export const titleCase = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase());

// Spell names are stored lowercase; plain title case would give "Speak With Plants".
const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

/** A spell name in the casing the compendium prints, e.g. "Speak with Plants". */
export const spellName = (s: string): string =>
  s
    .split(' ')
    .map((word, i) =>
      i > 0 && MINOR_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : titleCase(word),
    )
    .join(' ');

/** Speeds as one line, walk first, e.g. "30 ft., Fly 60 ft. (hover)". */
export function formatSpeed(speed: Creature['speed']): string {
  const parts = [`${speed.walk ?? 0} ft.`];
  for (const key of ['burrow', 'climb', 'fly', 'swim'] as const) {
    const value = speed[key];
    if (!value) continue;
    const hover = key === 'fly' && speed.hover ? ' (hover)' : '';
    parts.push(`${titleCase(key)} ${value} ft.${hover}`);
  }
  return parts.join(', ');
}

/** A sense range printed the way a stat block does: whole miles as miles, the rest as
 *  feet. Mirrors the app's `range` in src/compendium/format.ts. */
function range(feet: number): string {
  if (feet < 5280 || feet % 5280) return `${feet} ft.`;
  const miles = feet / 5280;
  return `${miles} ${miles === 1 ? 'mile' : 'miles'}`;
}

/** Senses as one line, passive Perception last. Mirrors the app's `formatSenses`. */
export function formatSenses(senses: Creature['senses']): string {
  const parts: string[] = [];
  for (const key of ['darkvision', 'blindsight', 'tremorsense', 'truesight'] as const) {
    const value = senses[key];
    if (value) parts.push(`${titleCase(key)} ${range(value)}`);
  }
  parts.push(`Passive Perception ${senses.passivePerception}`);
  return parts.join(', ');
}

/** Whether a stat-block text carries block markdown (a table or a bullet list) rather
 *  than a single run of prose. Those have to render as blocks, not inline. */
export const hasBlockMarkdown = (text: string): boolean =>
  text.includes('|') || /(^|\s)- /.test(text);

/** The "(Recharge 5–6)" / "(1/Day)" suffix a stat block prints after an action name.
 *  The console stores this structurally, so it is rebuilt here rather than parsed. */
export function rechargeLabel(recharge: Recharge | undefined): string {
  if (!recharge) return '';
  if (recharge.type === 'dice') {
    return recharge.value >= 6 ? ' (Recharge 6)' : ` (Recharge ${recharge.value}–6)`;
  }
  if (recharge.type === 'perDay') return ` (${recharge.value}/Day)`;
  return ` (${recharge.value}/Round)`;
}
