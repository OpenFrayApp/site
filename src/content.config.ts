import { defineCollection, z, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';

// One entry per chapter; `order` drives the sidebar and the previous/next links, so
// it's the book's running order, not the file names.
const chapterSchema = z.object({
  title: z.string(),
  // Sidebar label — shorter than the title, which carries the chapter number.
  label: z.string(),
  description: z.string(),
  order: z.number(),
  // Shown above the chapter title, e.g. "Chapter 2". Absent on the front matter page.
  eyebrow: z.string().optional(),
});

// The Waking Garden bestiary.
const wakingGarden = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/waking-garden' }),
  schema: chapterSchema,
});

// The Brood & Bloom bestiary.
const broodAndBloom = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/brood-and-bloom' }),
  schema: chapterSchema,
});

// On Strong Waters and Potent Simples — the apothecary's book. Not a bestiary: it ships
// spells and effect presets and no stat blocks at all.
const strongWaters = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/strong-waters' }),
  schema: chapterSchema,
});

// The news section: release notes and short adventures, one file per post. `kind` is
// what the post is, and it decides both the badge and which half of STYLE.md applies —
// an update is documentation, an adventure is game content.
// `image()` needs the schema as a function, so this one is built rather than declared.
const newsSchema = ({ image }: SchemaContext) =>
  z
    .object({
      title: z.string(),
      description: z.string(),
      // The URL the post is served at, when it shouldn't be the file name. The glob
      // loader reads this as the entry's id before the schema runs, so it decides the
      // route, the feed's guid and the canonical link all at once — leave it out and
      // the file name does the same job.
      //
      // Lowercase kebab-case is enforced rather than assumed: a slug of "Hello World!"
      // builds a directory with a space and an exclamation mark in it, and nothing
      // errors. `scripts/check-news-slugs.mjs` covers what a per-entry schema can't
      // see, which is two posts claiming one slug.
      slug: z
        .string()
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          'must be lowercase letters, digits and single hyphens, e.g. "player-view"',
        )
        .optional(),
      // Publication date, `YYYY-MM-DD`. Sorts the section and prints as the dateline.
      date: z.coerce.date(),
      // What the post is. A release is a version going out and takes a generated cover
      // (scripts/make-release-cover.mjs); a library introduces a book of creatures; an
      // update is anything else that changed; an adventure is something to run, and
      // follows STYLE.md's game-content register rather than its plain-instruction one.
      kind: z.enum(['release', 'library', 'update', 'adventure']),
      // Adventures only: the level band and how long a table should expect it to take.
      // An update leaves both out, so the card shows nothing where they would go.
      levels: z.string().optional(),
      length: z.string().optional(),
      // The featured image, as a path relative to the post — put the file in
      // `src/assets/news/`. Optional: a post without one still builds, and the listing
      // and the page simply leave the picture out rather than reserving a hole for it.
      // A shared link then falls back to the site's own banner.
      cover: image().optional(),
      coverAlt: z.string().optional(),
    })
    // A cover without alt text is a bug, and the build is where it should stop rather
    // than the page. Requiring `coverAlt` outright would instead have forced every post
    // to carry an image it may not have.
    .refine((data) => !data.cover || Boolean(data.coverAlt), {
      message: 'A post with a `cover` also needs `coverAlt` describing it.',
      path: ['coverAlt'],
    });

const news = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/news' }),
  schema: newsSchema,
});

export const collections = {
  'waking-garden': wakingGarden,
  'brood-and-bloom': broodAndBloom,
  'strong-waters': strongWaters,
  news,
};
