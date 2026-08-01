// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 OpenFray contributors

/** A bestiary book the site publishes: its content collection, the route it is
 *  served under, and the name its pages print. */
export interface Book {
  collection: 'waking-garden' | 'brood-and-bloom' | 'strong-waters';
  base: string;
  name: string;
}

export const WAKING_GARDEN: Book = {
  collection: 'waking-garden',
  base: '/the-waking-garden',
  name: 'The Waking Garden',
};

export const BROOD_AND_BLOOM: Book = {
  collection: 'brood-and-bloom',
  base: '/brood-and-bloom',
  name: 'Brood & Bloom',
};

/** The long title prints on the cover; `name` is what people call it, and what links. */
export const STRONG_WATERS: Book = {
  collection: 'strong-waters',
  base: '/strong-waters',
  name: 'Strong Waters',
};
