import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The Waking Garden bestiary. One entry per chapter; `order` drives the sidebar and
// the previous/next links, so it's the book's running order, not the file names.
const wakingGarden = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/waking-garden' }),
  schema: z.object({
    title: z.string(),
    // Sidebar label — shorter than the title, which carries the chapter number.
    label: z.string(),
    description: z.string(),
    order: z.number(),
    // Shown above the chapter title, e.g. "Chapter 2". Absent on the front matter page.
    eyebrow: z.string().optional(),
  }),
});

export const collections = { 'waking-garden': wakingGarden };
