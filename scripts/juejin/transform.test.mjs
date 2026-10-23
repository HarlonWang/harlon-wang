import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    parsePost,
    hasMdxSyntax,
    rewriteImages,
    convertVideos,
    convertCaptions,
    appendFooter,
    buildBrief,
    buildArticle,
} from './transform.mjs';

const SITE = 'https://harlon.wang';

test('parsePost 拆出 frontmatter 与正文', () => {
    const raw = `---\ntitle: 标题\ntags:\n  - AI\njuejin:\n  category: 人工智能\n  tags: [Agent, Claude]\n---\n\n正文第一行\n\n正文第二行`;
    const { frontmatter, body } = parsePost(raw);
    assert.equal(frontmatter.title, '标题');
    assert.deepEqual(frontmatter.juejin.tags, ['Agent', 'Claude']);
    assert.equal(frontmatter.juejin.category, '人工智能');
    assert.equal(body, '正文第一行\n\n正文第二行');
});

test('parsePost 无 frontmatter 时返回空对象与原文', () => {
    const { frontmatter, body } = parsePost('纯正文');
    assert.deepEqual(frontmatter, {});
    assert.equal(body, '纯正文');
});

test('parsePost frontmatter YAML 非法时抛清晰错误', () => {
    const raw = '---\ntitle: "未闭合\n  bad: [1, 2\n---\n正文';
    assert.throws(() => parsePost(raw), /frontmatter YAML 解析失败/);
});

test('hasMdxSyntax 命中 import / JSX 组件，放过纯 Markdown', () => {
    assert.equal(hasMdxSyntax('import X from "y"\n\n# 标题'), true);
    assert.equal(hasMdxSyntax('# 标题\n\n<Callout>hi</Callout>'), true);
    assert.equal(hasMdxSyntax('export const a = 1'), true);
    assert.equal(hasMdxSyntax('# 标题\n\n普通段落 <b>加粗</b> 和 ![](/x.png)'), false);
    assert.equal(hasMdxSyntax('段落里有 <https://a.com> 自动链接'), false);
});

test('rewriteImages 只改根相对路径', () => {
    const body = '![图](/images/a/b.png) 和 [链接](/posts/x/) 和 ![远程](https://cdn.com/c.png) 和 ![协议相对](//d.com/e.png)';
    const out = rewriteImages(body, SITE);
    assert.match(out, /\]\(https:\/\/harlon\.wang\/images\/a\/b\.png\)/);
    assert.match(out, /\]\(https:\/\/harlon\.wang\/posts\/x\/\)/);
    assert.match(out, /\]\(https:\/\/cdn\.com\/c\.png\)/); // 远程不动
    assert.match(out, /\]\(\/\/d\.com\/e\.png\)/); // 协议相对不动
});

test('rewriteImages 处理内联 HTML src/href', () => {
    const out = rewriteImages('<img src="/images/x.png"> <a href="/about">', SITE);
    assert.match(out, /src="https:\/\/harlon\.wang\/images\/x\.png"/);
    assert.match(out, /href="https:\/\/harlon\.wang\/about"/);
});

test('rewriteImages 尾斜杠站点地址不产生双斜杠', () => {
    const out = rewriteImages('![](/a.png)', 'https://harlon.wang/');
    assert.match(out, /\]\(https:\/\/harlon\.wang\/a\.png\)/);
});

test('appendFooter 追加首发声明与正确 slug 链接', () => {
    const out = appendFooter('正文', 'my-post', SITE);
    assert.match(out, /本文首发于/);
    assert.match(out, /\(https:\/\/harlon\.wang\/posts\/my-post\/\)/);
    assert.ok(out.startsWith('正文\n\n---'));
});

test('buildBrief 压成单行并截断到 100', () => {
    assert.equal(buildBrief('  多行\n描述  这里 '), '多行 描述 这里');
    assert.equal(buildBrief('x'.repeat(200)).length, 100);
    assert.equal(buildBrief(undefined), '');
});

test('buildArticle 组装完整字段', () => {
    const article = buildArticle({
        frontmatter: { title: '我的标题', description: '一句摘要' },
        body: '正文 ![](/images/x.png)',
        slug: 'demo',
        siteUrl: SITE,
    });
    assert.equal(article.title, '我的标题');
    assert.equal(article.briefContent, '一句摘要');
    assert.match(article.markContent, /https:\/\/harlon\.wang\/images\/x\.png/);
    assert.match(article.markContent, /本文首发于/);
    assert.equal(article.wordCount, article.markContent.length);
});

test('buildArticle 缺 title 抛错', () => {
    assert.throws(
        () => buildArticle({ frontmatter: {}, body: 'x', slug: 'no-title', siteUrl: SITE }),
        /缺少 title/,
    );
});

test('convertVideos 把 <video> 换成封面图链接，无 poster 时退化成文字链接', () => {
    const body = [
        '前文',
        '<video',
        '  src="/images/demo/a.mp4"',
        '  poster="/images/demo/a-poster.webp"',
        '  autoplay loop muted playsinline',
        '></video>',
        '<video src="/b.mp4"></video>',
        '后文',
    ].join('\n');
    assert.equal(
        convertVideos(body),
        ['前文', '[![▶ 点击播放视频](/images/demo/a-poster.webp)](/images/demo/a.mp4)', '[▶ 点击播放视频](/b.mp4)', '后文'].join('\n'),
    );
});

test('convertCaptions 只转换不含其他标签的单行 <p>', () => {
    assert.equal(convertCaptions('<p style="text-align: center;">8× 慢放，左：修复前</p>'), '*8× 慢放，左：修复前*');
    const nested = '<p>含 <a href="/x">链接</a></p>';
    assert.equal(convertCaptions(nested), nested);
    assert.equal(convertCaptions('行内 <p>x</p> 不转'), '行内 <p>x</p> 不转');
});

test('围栏代码块里的 <video>、<p> 原样保留', () => {
    const code = '```html\n<video src="/a.mp4"></video>\n<p>代码里的</p>\n```';
    assert.equal(convertCaptions(convertVideos(code)), code);
});

test('buildArticle 中视频封面与链接改写为绝对地址', () => {
    const article = buildArticle({
        frontmatter: { title: 't' },
        body: '<video src="/v.mp4" poster="/p.webp"></video>',
        slug: 'demo',
        siteUrl: SITE,
    });
    assert.match(article.markContent, /\[!\[▶ 点击播放视频\]\(https:\/\/harlon\.wang\/p\.webp\)\]\(https:\/\/harlon\.wang\/v\.mp4\)/);
});

test('convertVideos 视频旁有同名 gif 时换成动图', () => {
    const body = '<video src="/images/demo/a.mp4" poster="/images/demo/a-poster.webp"></video>';
    assert.equal(convertVideos(body, (p) => p === '/images/demo/a.gif'), '![动图](/images/demo/a.gif)');
    assert.equal(convertVideos(body, () => false), '[![▶ 点击播放视频](/images/demo/a-poster.webp)](/images/demo/a.mp4)');
});
