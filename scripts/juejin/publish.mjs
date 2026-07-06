// 掘金发布 API 客户端：建草稿 → 填内容 → 发布（可选进专栏）。
// 从 TrendingProjects/juejin-publisher 的 publisher.js 移植而来，
// 区别是分类/标签/专栏改为入参（原版写死）。掘金 API 变动时两处需同步。

const JUEJIN_API = 'https://api.juejin.cn/content_api/v1';

function getConfig() {
    const required = ['JUEJIN_AID', 'JUEJIN_UUID', 'JUEJIN_COOKIE', 'JUEJIN_CSRF_TOKEN'];
    for (const key of required) {
        if (!process.env[key]) throw new Error(`缺少环境变量：${key}（放在仓库根 .env）`);
    }
    return {
        aid: process.env.JUEJIN_AID,
        uuid: process.env.JUEJIN_UUID,
        cookie: process.env.JUEJIN_COOKIE,
        csrfToken: process.env.JUEJIN_CSRF_TOKEN,
    };
}

async function apiCall(config, endpoint, body) {
    const url = `${JUEJIN_API}/${endpoint}?aid=${config.aid}&uuid=${config.uuid}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            cookie: config.cookie,
            'x-secsdk-csrf-token': config.csrfToken,
            origin: 'https://juejin.cn',
            referer: 'https://juejin.cn/',
            'user-agent':
                'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36',
        },
        body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (data.err_no !== 0) {
        throw new Error(`掘金 API ${endpoint} 失败：${data.err_no} - ${data.err_msg}`);
    }
    return data.data;
}

// article: { title, briefContent, markContent, wordCount, categoryId, tagIds, columnIds }
export async function publish(article) {
    const { title, briefContent, markContent, wordCount, categoryId, tagIds, columnIds = [] } = article;
    const config = getConfig();

    const draft = await apiCall(config, 'article_draft/create', {
        edit_type: 10,
        origin_type: 2,
    });
    const draftId = draft.id || draft.draft_id;

    await apiCall(config, 'article_draft/update', {
        id: draftId,
        category_id: categoryId,
        tag_ids: tagIds,
        link_url: '',
        cover_image: '',
        title,
        brief_content: briefContent,
        edit_type: 10,
        html_content: 'deprecated',
        mark_content: markContent,
    });

    const result = await apiCall(config, 'article/publish', {
        draft_id: draftId,
        sync_to_org: false,
        column_ids: columnIds,
        theme_ids: [],
        encrypted_word_count: wordCount * 773,
        origin_word_count: wordCount,
    });
    const articleId = result.article_id || draftId;
    return { draftId, articleId, published: true, url: `https://juejin.cn/post/${articleId}` };
}
