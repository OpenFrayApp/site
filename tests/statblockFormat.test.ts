// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

import { describe, expect, it } from 'vitest';
import {
  abilityMod,
  creatureLookup,
  creatureSlug,
  formatCr,
  formatSenses,
  formatSpeed,
  hasBlockMarkdown,
  proficiencyBonus,
  rechargeLabel,
  signed,
  spellName,
  titleCase,
} from '../src/data/statblock.ts';

describe('creatureLookup', () => {
  it('names the book in its build-failing error', () => {
    const lookup = creatureLookup([], 'Some Book');
    expect(() => lookup('Missing')).toThrow(/Some Book: no creature named "Missing"/);
  });
});

describe('creatureSlug', () => {
  it('lowercases and hyphenates, trimming edge hyphens', () => {
    expect(creatureSlug('The Harvest Crown')).toBe('the-harvest-crown');
    expect(creatureSlug("Winter's Bite!")).toBe('winter-s-bite');
  });
});

describe('formatCr', () => {
  it('prints fractions the stat-block way and an em dash for no CR', () => {
    expect(formatCr(0.125)).toBe('1/8');
    expect(formatCr(0.25)).toBe('1/4');
    expect(formatCr(0.5)).toBe('1/2');
    expect(formatCr(7)).toBe('7');
    expect(formatCr(undefined)).toBe('—');
  });
});

describe('proficiencyBonus', () => {
  it('mirrors the app: +2 through CR 4, then +1 every four CR', () => {
    expect(proficiencyBonus(0)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
    expect(proficiencyBonus(30)).toBe(9);
  });
});

describe('abilityMod and signed', () => {
  it('floors the modifier and prints a true minus sign', () => {
    expect(abilityMod(16)).toBe(3);
    expect(abilityMod(8)).toBe(-1);
    expect(signed(3)).toBe('+3');
    expect(signed(0)).toBe('+0');
    expect(signed(-1)).toBe('−1'); // U+2212, not a hyphen
  });
});

describe('titleCase and spellName', () => {
  it('capitalizes every word, but spells keep minor words lowercase', () => {
    expect(titleCase('lawful evil')).toBe('Lawful Evil');
    expect(spellName('speak with plants')).toBe('Speak with Plants');
    expect(spellName('the wild hunt')).toBe('The Wild Hunt');
  });
});

describe('formatSpeed', () => {
  it('prints walk first, other modes capitalized, hover as a suffix', () => {
    expect(formatSpeed({ walk: 30, fly: 60, hover: true })).toBe('30 ft., Fly 60 ft. (hover)');
    expect(formatSpeed({ walk: 20, climb: 20 })).toBe('20 ft., Climb 20 ft.');
    expect(formatSpeed({})).toBe('0 ft.');
  });
});

describe('formatSenses', () => {
  it('lists senses in feet with passive Perception last, miles for whole miles', () => {
    expect(formatSenses({ passivePerception: 14, darkvision: 60 })).toBe(
      'Darkvision 60 ft., Passive Perception 14',
    );
    expect(formatSenses({ passivePerception: 10, tremorsense: 5280 })).toBe(
      'Tremorsense 1 mile, Passive Perception 10',
    );
  });
});

describe('hasBlockMarkdown', () => {
  it('detects tables and bullet lists, not plain prose', () => {
    expect(hasBlockMarkdown('| a | b |')).toBe(true);
    expect(hasBlockMarkdown('Options:\n- one\n- two')).toBe(true);
    expect(hasBlockMarkdown('A single run of prose.')).toBe(false);
  });
});

describe('rechargeLabel', () => {
  it('prints the parenthetical for each recharge shape', () => {
    expect(rechargeLabel({ type: 'dice', value: 5 })).toBe(' (Recharge 5–6)');
    expect(rechargeLabel({ type: 'dice', value: 6 })).toBe(' (Recharge 6)');
    expect(rechargeLabel({ type: 'perDay', value: 2 })).toBe(' (2/Day)');
    expect(rechargeLabel(undefined)).toBe('');
  });
});
