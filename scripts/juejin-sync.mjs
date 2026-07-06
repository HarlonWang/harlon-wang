#!/usr/bin/env node
// 把网站原创文章同步发布到掘金（单向，只发一次）。
//
// 用法：
//   node scripts/juejin-sync.mjs               同步所有已开启且未发过的文章
//   node scripts/juejin-sync.mjs <slug>        只同步指定文章（文件名去掉 .mdx）
//   node scripts/juejin-sync.mjs --dry-run     试跑校验（建草稿→填内容→删除），不发布、不留草稿、不记账
//   node scripts/juejin-sync.mjs <slug> --force  忽略「已发」记录强制重发
//
// 开启方式：在文章 frontmatter 加 juejin 对象（其存在即代表要同步）：
//   juejin:
//     category: 人工智能        # 单选，见 juejin-taxonomy.json
//     tags: [Agent, Claude]     # 掘金已有标签，脚本查表转 ID
//     column: "7619..."         # 可选，专栏 ID；不填则不进专栏
//
// 鉴权：仓库根 .env 提供 JUEJIN_AID / JUEJIN_UUID / JUEJIN_COOKIE / JUEJIN_CSRF_TOKEN

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePost, hasMdxSyntax, buildArticle } from './juejin/transform.mjs';
import { resolveCategory, resolveTags } from './juejin/taxonomy.mjs';
import { readLedger, isSynced, recordSync } from './juejin/ledger.mjs';
import { publish } from './juejin/publish.mjs';

const SITE_URL = 'https://harlon.wang';
const HERE = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(HERE, '..', 'src', 'content', 'posts');
const ENV_PATH = join(HERE, '..', '.env');

function parseArgs(argv) {
    const flags = new Set(argv.filter((a) => a.startsWith('--')));
    const slug = argv.find((a) => !a.startsWith('--'));
    return { slug, dryRun: flags.has('--dry-run'), force: flags.has('--force') };
}

async function listSlugs(slug) {
    if (slug) return [slug];
    const files = await readdir(POSTS_DIR);
    return files.filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));
}

// 处理单篇：返回 { slug, status, ...detail }
async function syncOne(slug, { dryRun, force }, ledger) {
    const raw = await readFile(join(POSTS_DIR, `${slug}.mdx`), 'utf8');
    const { frontmatter, body } = parsePost(raw);

    if (!frontmatter.juejin || typeof frontmatter.juejin !== 'object') {
        return { slug, status: 'skip', reason: '未开启掘金同步（无 juejin frontmatter）' };
    }
    if (!force && isSynced(ledger, slug)) {
        return { slug, status: 'skip', reason: `已发过：${ledger[slug].url}` };
    }
    if (hasMdxSyntax(body)) {
        return { slug, status: 'warn', reason: '含 MDX/JSX 语法，跳过（当纯 Markdown 会坏）' };
    }

    const categoryId = await resolveCategory(frontmatter.juejin.category);
    const tagIds = await resolveTags(frontmatter.juejin.tags);
    const columnIds = frontmatter.juejin.column ? [String(frontmatter.juejin.column)] : [];
    const article = buildArticle({ frontmatter, body, slug, siteUrl: SITE_URL });

    const result = await publish({ ...article, categoryId, tagIds, columnIds }, { dryRun });

    if (result.published) {
        await recordSync(ledger, slug, {
            articleId: result.articleId,
            url: result.url,
            syncedAt: new Date().toISOString(),
        });
        return { slug, status: 'published', url: result.url };
    }
    return { slug, status: 'dry-run', reason: '管线校验通过，草稿已清理（未发布）' };
}

async function main() {
    const { slug, dryRun, force } = parseArgs(process.argv.slice(2));
    try {
        process.loadEnvFile(ENV_PATH);
    } catch {
        // .env 不存在也行——环境变量可能已由外部注入
    }

    console.log(`模式：${dryRun ? 'DRY RUN（校验，不留草稿）' : '发布'}${force ? ' + FORCE' : ''}`);
    const ledger = await readLedger();
    const slugs = await listSlugs(slug);

    const results = [];
    for (const s of slugs) {
        try {
            results.push(await syncOne(s, { dryRun, force }, ledger));
        } catch (err) {
            results.push({ slug: s, status: 'error', reason: err.message });
        }
    }

    console.log('\n结果：');
    for (const r of results) {
        const icon = { published: '✅', 'dry-run': '📝', skip: '·', warn: '⚠️', error: '❌' }[r.status] ?? '?';
        console.log(`  ${icon} ${r.slug} — ${r.status}${r.url ? ` ${r.url}` : ''}${r.reason ? ` (${r.reason})` : ''}`);
    }

    const failed = results.filter((r) => r.status === 'error');
    if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
