import type { CollectionEntry } from 'astro:content';

export function getPostBadge(entry: CollectionEntry<'posts'>): string {
    const { data } = entry;
    if (data.type === 'translation') return '🌐';
    switch (data.authorship) {
        case 'ai-led':
            return '🤖';
        case 'co-authored':
            return '🤝';
        case 'human-led':
        default:
            return '✍️';
    }
}
