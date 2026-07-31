import { defineCollection, z } from 'astro:content';
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

// The news section: release notes and short adventures, one file per post. `kind` is
// what the post is, and it decides both the badge and which half of STYLE.md applies —
// an update is documentation, an adventure is game content.
const newsSchema = z.object({
  title: z.string(),
  description: z.string(),
  // Publication date, `YYYY-MM-DD`. Sorts the section and prints as the dateline.
  date: z.coerce.date(),
  kind: z.enum(['update', 'adventure']),
  // Adventures only: the level band and how long a table should expect it to take.
  // An update leaves both out, so the card shows nothing where they would go.
  levels: z.string().optional(),
  length: z.string().optional(),
});

const news = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/news' }),
  schema: newsSchema,
});

export const collections = {
  'waking-garden': wakingGarden,
  'brood-and-bloom': broodAndBloom,
  news,
};
