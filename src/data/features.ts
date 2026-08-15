// The four feature landing pages. The nav dropdown and each page's cross-links
// render from this list, so a new feature page is one entry here.
export interface Feature {
  name: string;
  href: string;
  blurb: string;
  icon: 'rolling' | 'tracking' | 'player-view' | 'libraries';
}

export const features: Feature[] = [
  {
    name: 'Smart rolling',
    href: '/features/rolling/',
    blurb: 'Attacks, saves, and damage with every modifier already worked in.',
    icon: 'rolling',
  },
  {
    name: 'Tracking',
    href: '/features/tracking/',
    blurb: 'Effects, concentration, and resources that remember themselves.',
    icon: 'tracking',
  },
  {
    name: 'Player view',
    href: '/features/player-view/',
    blurb: 'A live, read-only screen for your table, showing what you allow.',
    icon: 'player-view',
  },
  {
    name: 'Libraries',
    href: '/features/libraries/',
    blurb: 'Over 2000 creatures included, plus everything your table invents.',
    icon: 'libraries',
  },
];
