import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITEMAP_URL = 'https://www.anthropic.com/sitemap.xml';
const SEEN_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.translation-queue', 'seen.json');
const TODAY = new Date().toISOString().slice(0, 10);

async function fetchSitemapEntries() {
    const res = await fetch(SITEMAP_URL);
    if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
    const xml = await res.text();
    const entries = [];
    for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
        const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
        const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
        if (loc && /\/engineering\/[^/]+$/.test(loc)) {
            entries.push({ url: loc, lastmod });
        }
    }
    return entries;
}

async function fetchTitle(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const html = await res.text();
        const raw = html.match(/<title[^>]*>([^<]+)<\/title>/)?.[1];
        if (!raw) return null;
        return raw.replace(/\s*[\\/|]\s*Anthropic\s*$/, '').trim();
    } catch {
        return null;
    }
}

function slugFromUrl(url) {
    return url.replace(/\/$/, '').split('/').pop();
}

function ghIssueCreate({ title, body }) {
    const r = spawnSync('gh', ['issue', 'create', '--title', title, '--body', body], {
        stdio: ['ignore', 'inherit', 'inherit'],
    });
    if (r.status !== 0) throw new Error(`gh issue create failed: ${title}`);
}

function buildNewIssueBody({ url, lastmod }) {
    return [
        `**原文 URL**：${url}`,
        `**Sitemap lastmod**：${lastmod}`,
        '',
        '## 触发翻译',
        '',
        '在 Claude Code 里运行：',
        '',
        '```',
        `/translate-eng ${url}`,
        '```',
        '',
        '## 决策完成后',
        '',
        '编辑 `.translation-queue/seen.json`，把该 URL 的 `status` 改为：',
        '',
        '- `translated`（已翻译，补 `translatedSlug` 和 `translatedAt`）',
        '- `skipped`（跳过，补 `reason`）',
        '',
        '然后 close 本 issue。',
    ].join('\n');
}

function buildOutdatedIssueBody({ url, prevLastmod, lastmod, translatedSlug }) {
    return [
        '已译文章原文被更新（sitemap lastmod 变化）。',
        '',
        `**URL**：${url}`,
        `**旧 lastmod**：${prevLastmod}`,
        `**新 lastmod**：${lastmod}`,
        translatedSlug ? `**译文**：\`src/content/posts/${translatedSlug}.mdx\`` : '',
        '',
        '需要 diff 原文判断是否需要补译。决定后把 `.translation-queue/seen.json` 的 `status` 改回 `translated` 或保留 `outdated`。',
    ]
        .filter(Boolean)
        .join('\n');
}

async function loadSeen() {
    try {
        return JSON.parse(await readFile(SEEN_PATH, 'utf8'));
    } catch (e) {
        if (e.code === 'ENOENT') return {};
        throw e;
    }
}

async function saveSeen(data) {
    const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(SEEN_PATH, JSON.stringify(sorted, null, 4) + '\n');
}

async function main() {
    const entries = await fetchSitemapEntries();
    const seen = await loadSeen();
    let mutated = false;
    const created = [];

    for (const { url, lastmod } of entries) {
        const prev = seen[url];

        if (!prev) {
            const title = (await fetchTitle(url)) ?? slugFromUrl(url);
            ghIssueCreate({
                title: `[新文章] ${title}`,
                body: buildNewIssueBody({ url, lastmod }),
            });
            seen[url] = { lastmod, status: 'pending', discoveredAt: TODAY };
            mutated = true;
            created.push({ kind: 'new', url, title });
            continue;
        }

        if (prev.lastmod !== lastmod) {
            const prevLastmod = prev.lastmod;
            prev.lastmod = lastmod;
            mutated = true;

            if (prev.status === 'translated') {
                const title = (await fetchTitle(url)) ?? slugFromUrl(url);
                ghIssueCreate({
                    title: `[已译文章原文更新] ${title}`,
                    body: buildOutdatedIssueBody({
                        url,
                        prevLastmod,
                        lastmod,
                        translatedSlug: prev.translatedSlug,
                    }),
                });
                prev.status = 'outdated';
                created.push({ kind: 'outdated', url, title });
            }
        }
    }

    if (mutated) {
        await saveSeen(seen);
        console.log(`updated seen.json; created ${created.length} issue(s)`);
        for (const c of created) console.log(`  [${c.kind}] ${c.url}`);
    } else {
        console.log('no changes');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
