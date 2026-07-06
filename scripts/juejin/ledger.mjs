// 「只发一次」的记账清单：slug → 掘金 article_id / url / 时间。
// 存在仓库根的 .juejin-synced.json，提交进 git，跨机器/跨时间生效。

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LEDGER_PATH = join(HERE, '..', '..', '.juejin-synced.json');

export async function readLedger() {
    try {
        return JSON.parse(await readFile(LEDGER_PATH, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

export function isSynced(ledger, slug) {
    return Boolean(ledger[slug]);
}

export async function recordSync(ledger, slug, { articleId, url, syncedAt }) {
    ledger[slug] = { articleId, url, syncedAt };
    await writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    return ledger;
}
