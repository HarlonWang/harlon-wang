import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z
    .object({
      title: z.string(),
      type: z.enum(['translation', 'original']),
      publishDate: z.coerce.date(),
      description: z.string(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      source: z
        .object({
          title: z.string(),
          url: z.string().url(),
          author: z.string(),
          siteName: z.string(),
          publishDate: z.coerce.date().optional(),
        })
        .optional(),
      translator: z.string().default('Harlon Wang'),
    })
    .refine((data) => data.type !== 'translation' || !!data.source, {
      message: "type === 'translation' 时 source 必填",
      path: ['source'],
    }),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/products' }),
  schema: z.object({
    name: z.string(),
    status: z.enum(['active', 'archived']).default('active'),
    year: z.number(),
    description_zh: z.string(),
    description_en: z.string().optional(),
    links: z
      .object({
        github: z.string().url().nullable().optional(),
        website: z.string().url().nullable().optional(),
        app: z.string().url().nullable().optional(),
      })
      .default({}),
    stars: z.number().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { posts, products };
