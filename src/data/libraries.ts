// The content libraries that have a page on this site. The console ships more of them
// (the SRD sets and Tome of Beasts), but those are third-party books we only reference —
// only OpenFray's own writing gets published here in full.
export interface Library {
  name: string;
  href: string;
  /** One line for the nav and the card. */
  blurb: string;
  /** Rules version the stat blocks are written for. */
  edition: string;
  available: boolean;
}

/**
 * The libraries the console ships that we only reference — the SRD sets and the Kobold
 * Press books. Labels match the console's own Settings panel exactly, so a reader
 * ticking them there recognises what they read here.
 */
export const shippedLibraries: string[] = [
  'Basic Rules 2024 (SRD 5.2.1)',
  'Basic Rules 2014 (SRD 5.1)',
  'Tome of Beasts 1 (Kobold Press)',
  'Tome of Beasts 2 (Kobold Press)',
  'Tome of Beasts 3 (Kobold Press)',
  'Creature Codex (Kobold Press)',
];

export const libraries: Library[] = [
  {
    name: 'The Waking Garden',
    href: '/the-waking-garden/',
    blurb:
      'Sixty-seven sentient vegetables across three stages of growth, the ecology around them, and the thing they all grew from.',
    edition: '5.5e (2024)',
    available: true,
  },
  {
    name: 'Brood & Bloom',
    href: '/brood-and-bloom/',
    blurb:
      'Sixty-one parasites in three broods — one that lives in people, one that takes ground and buildings, one that wants only the dead — and the order that catalogs them.',
    edition: '5.5e (2024)',
    available: true,
  },
];
