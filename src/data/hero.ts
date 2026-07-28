// The hero layout, shared by the home page and the 404. Two pages is too few for a
// component that would only wrap a <main>, but enough that the classes shouldn't be
// typed twice.
export const hero = 'hero flex flex-col items-center px-6 pt-10 pb-16 text-center';

// Carries no bottom margin: the home page's second tagline sits between two blocks and
// needs none, and two margin utilities in one class list are resolved by Tailwind's
// output order rather than the order written — so a default here would win over the
// caller's `mb-0` instead of losing to it. Each use sets its own.
//
// `leading-[1.55]` is exact rather than snapped: at this clamped size the nearest step
// (leading-relaxed, 1.625) adds about a pixel per line over a five-line paragraph.
export const tagline =
  'tagline mx-0 mt-0 max-w-[41rem] text-[clamp(1.05rem,2.4vw,1.25rem)] ' +
  'leading-[1.55] text-muted';
