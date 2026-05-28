import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z
    .object({
      title: z.string(),
      type: z.enum(['translation', 'original']),
      authorship: z.enum(['ai-led', 'co-authored', 'human-led']).optional(),
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
    .superRefine((data, ctx) => {
      if (data.type === 'translation' && !data.source) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "type === 'translation' 时 source 必填",
          path: ['source'],
        });
      }
      if (data.type === 'original' && !data.authorship) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "type === 'original' 时 authorship 必填",
          path: ['authorship'],
        });
      }
    }),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/products' }),
  schema: z.object({
    name: z.string(),
    category: z.enum(['product', 'library', 'tool']),
    status: z.enum(['active', 'archived']).default('active'),
    year: z.number(),
    description_zh: z.string(),
    description_en: z.string().optional(),
    links: z
      .object({
        github: z.string().url().nullable().optional(),
        website: z.string().url().nullable().optional(),
      })
      .default({}),
    featured: z.boolean().default(false),
  }),
});

export const collections = { posts, products };
