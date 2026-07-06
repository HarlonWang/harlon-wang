# 掘金同步

把网站的**原创**文章单向同步发布到掘金。手动触发、只发一次。

## 用法

```bash
npm run juejin:sync                          # 同步所有已开启且未发过的
node scripts/juejin-sync.mjs <slug>          # 只发指定一篇（文件名去 .mdx）
node scripts/juejin-sync.mjs <slug> --force  # 忽略「已发」记录强制重发
npm run juejin:test                          # 转换逻辑单测
```

## 开启同步

给文章 frontmatter 加 `juejin` 对象——**它的存在就是同步开关**：

```yaml
juejin:
  category: 人工智能              # 掘金分类，8 选 1，见 ../juejin-taxonomy.json
  tags: [AI编程, Agent, Claude]  # 掘金已有标签，脚本查表转 ID
  # column: "7619..."            # 可选，专栏 ID；不填不进专栏
```

- 分类只能选一个，取值见 `../juejin-taxonomy.json` 的 `categories`。
- 标签必须在 `../juejin-taxonomy.json` 的 `tags` 表内（掘金无同名标签的写不了，见表里 `_unavailableTags` 的近义替代建议）。写了表外的名字脚本会报错中止。

## 工作原理

```
扫描 *.mdx → 筛出带 juejin 且未发过的 → 逐篇转换 → 发布 → 记账
```

- **转换**（`transform.mjs`）：剥 frontmatter、根相对图片/链接改写为 `https://harlon.wang/...`、正文末尾附首发脚注；`title` / `description` 直接作标题和摘要。
- **只发一次**：`../../.juejin-synced.json` 记 slug→article_id，已发跳过。此文件提交进 git。
- **含 JSX/MDX 组件的文章**会被自动跳过并告警（当纯 Markdown 会坏）。

## 鉴权

仓库根 `.env`（已 gitignore，勿提交）提供四个变量：

```
JUEJIN_AID=2608
JUEJIN_UUID=<用户 uuid>
JUEJIN_COOKIE="<登录 cookie 整串>"
JUEJIN_CSRF_TOKEN=<x-secsdk-csrf-token>
```

**过期处理**：cookie 约一年、csrf token 为 session 级（更短）。失效时发布报鉴权错（err_no 非 0）。从浏览器登录掘金后 F12 → Network → 任意 `api.juejin.cn` 请求 → 复制请求头的 `cookie` 与 `x-secsdk-csrf-token`（uuid 在请求 URL 的 `uuid=` 参数里，aid 固定 2608），或直接对该请求 Copy as cURL 取值，更新 `.env`。

## 文件

| 文件 | 职责 |
|------|------|
| `../juejin-sync.mjs` | CLI 主流程：选文 / 转换 / 发布 / 记账 / 汇总 |
| `transform.mjs` | 纯转换逻辑（+ `transform.test.mjs` 单测） |
| `taxonomy.mjs` | 分类/标签中文名 → 掘金 ID，未知即报错 |
| `ledger.mjs` | 只发一次的记账清单读写 |
| `publish.mjs` | 掘金 API 客户端（建草稿 → 填内容 → 发布） |
| `../juejin-taxonomy.json` | 分类/标签中文名 → 掘金 ID 映射表 |
