// 把 frontmatter 里的中文分类/标签名解析成掘金 ID。
// 名字不在映射表里就抛错中止（不猜），提示去 juejin-taxonomy.json 补。

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAXONOMY_PATH = join(HERE, '..', 'juejin-taxonomy.json');

let cache = null;
async function load() {
    if (!cache) {
        cache = JSON.parse(await readFile(TAXONOMY_PATH, 'utf8'));
    }
    return cache;
}

export async function resolveCategory(name) {
    const { categories } = await load();
    const id = categories[name];
    if (!id) {
        throw new Error(
            `未知掘金分类「${name}」。可选：${Object.keys(categories).join(' / ')}`,
        );
    }
    return id;
}

export async function resolveTags(names) {
    const list = Array.isArray(names) ? names : [];
    if (list.length === 0) {
        throw new Error('juejin.tags 至少要有一个标签');
    }
    const { tags } = await load();
    const unknown = list.filter((n) => !tags[n]);
    if (unknown.length) {
        throw new Error(
            `未知掘金标签：${unknown.join(', ')}。可选见 juejin-taxonomy.json 的 tags；` +
                `掘金无同名标签时改用近义标签（见 _unavailableTags 备注）`,
        );
    }
    return list.map((n) => tags[n]);
}
