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

export const libraries: Library[] = [
  {
    name: 'The Waking Garden',
    href: '/the-waking-garden/',
    blurb:
      'Sixty-seven sentient vegetables across three stages of growth, the ecology around them, and the thing they all grew from.',
    edition: '5.5e (2024)',
    available: true,
  },
];
