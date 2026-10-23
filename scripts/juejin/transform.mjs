// 把一篇网站 MDX 文章转换成掘金可发布的字段。
// 纯函数，无 I/O，便于单测（见 transform.test.mjs）。

import { parse as parseYaml } from 'yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

// 拆出 frontmatter 与正文。slug 由调用方（文件名）传入。
export function parsePost(raw) {
    const match = raw.match(FRONTMATTER_RE);
    if (!match) {
        return { frontmatter: {}, body: raw.trim() };
    }
    let frontmatter;
    try {
        frontmatter = parseYaml(match[1]) ?? {};
    } catch (err) {
        throw new Error(`frontmatter YAML 解析失败：${err.message}`);
    }
    const body = raw.slice(match[0].length).trim();
    return { frontmatter, body };
}

// MDX 专有语法（import/export 语句、JSX 组件标签）当纯 Markdown 发会坏，
// 命中则由上层跳过并告警。只认大写开头的 JSX 组件，避免误伤 <img>、<https://...> 等。
// 先剔除围栏代码块与行内 code 再检测：代码示例里的 import/export（如 Python 代码）
// 和大写开头的标签不是 MDX 语法，不应触发跳过。
export function hasMdxSyntax(body) {
    const withoutCode = body
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`\n]*`/g, '');
    if (/^\s*(import|export)\s+/m.test(withoutCode)) return true;
    if (/<\/?[A-Z][A-Za-z0-9]*[\s/>]/.test(withoutCode)) return true;
    return false;
}

// 只对围栏代码块之外的部分做转换：代码示例里的 <video>、<p> 是要原样展示的。
function outsideFences(body, fn) {
    return body
        .split(/(```[\s\S]*?```)/)
        .map((part, i) => (i % 2 === 1 ? part : fn(part)))
        .join('');
}

// 掘金不渲染 <video>，原样发出去会显示成一段 HTML 源码。
// 换成「封面图 + 链接到视频文件」，读者点封面在浏览器里播放；没有 poster 时退化成文字链接。
export function convertVideos(body) {
    return outsideFences(body, (text) => text.replace(/<video\b([^>]*)>[\s\S]*?<\/video>/g, (_, attrs) => {
        const src = attrs.match(/\ssrc=(["'])(.*?)\1/)?.[2];
        if (!src) return '';
        const poster = attrs.match(/\sposter=(["'])(.*?)\1/)?.[2];
        return poster ? `[![▶ 点击播放视频](${poster})](${src})` : `[▶ 点击播放视频](${src})`;
    }));
}

// 视频、图片下方的说明多写成带 style 的 <p>，掘金同样会原样显示；不含其他标签的单行 <p> 转成斜体文字。
export function convertCaptions(body) {
    return outsideFences(body, (text) => text.replace(/^<p\b[^>]*>([^<\n]+)<\/p>$/gm, (_, t) => `*${t.trim()}*`));
}

// 根相对图片/链接路径改写为线上绝对地址（掘金服务器才抓得到）。
// 只改单斜杠开头的根相对路径，跳过 //protocol-relative 和已有 http(s)。
export function rewriteImages(body, siteUrl) {
    const base = siteUrl.replace(/\/$/, '');
    // Markdown 图片/链接：](/path)
    let out = body.replace(/\]\((\/(?!\/)[^)]*)\)/g, (_, p) => `](${base}${p})`);
    // 内联 HTML：src="/path" / href="/path"
    out = out.replace(/(src|href)=(["'])(\/(?!\/)[^"']*)\2/g, (_, attr, q, p) => `${attr}=${q}${base}${p}${q}`);
    return out;
}

// 正文末尾附首发声明，标明原创出处、利于 canonical。
export function appendFooter(body, slug, siteUrl) {
    const base = siteUrl.replace(/\/$/, '');
    return `${body}\n\n---\n\n> 本文首发于 [${hostOf(base)}](${base}/posts/${slug}/)，转载请注明出处。\n`;
}

function hostOf(url) {
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// 掘金摘要（brief_content）：取 frontmatter.description，压成单行并截断。
// 掘金摘要上限 100 字符，沿用既有可用实现的长度。
export function buildBrief(description) {
    return String(description ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
}

// 组装掘金发布所需的内容字段（不含分类/标签 ID，那些由 taxonomy 解析后合并）。
export function buildArticle({ frontmatter, body, slug, siteUrl }) {
    if (!frontmatter.title) {
        throw new Error(`文章缺少 title：${slug}`);
    }
    // 先转换视频与说明，生成的根相对路径再统一改写成绝对地址
    const withImages = rewriteImages(convertCaptions(convertVideos(body)), siteUrl);
    const markContent = appendFooter(withImages, slug, siteUrl);
    return {
        title: String(frontmatter.title),
        briefContent: buildBrief(frontmatter.description),
        markContent,
        wordCount: markContent.length,
    };
}
