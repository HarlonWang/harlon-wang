---
description: 把 Anthropic Engineering 文章翻译成本站 MDX 草稿
argument-hint: <原文 URL>
---

请把下面这篇 Anthropic Engineering 文章翻译成中文 MDX 草稿，发布到本站。

**原文 URL**：$ARGUMENTS

## 流程

1. **抓取原文**：用 Claude in Chrome 工具（`mcp__claude-in-chrome__*`）打开 URL，提取标题、作者、发布日期、正文
2. **生成文件**：在 `src/content/posts/<slug>.mdx` 创建文件，slug 用原文 URL 末段
3. **填 frontmatter**（schema 定义见 `src/content/config.ts`）：
    - `type: translation`
    - `title`: 中文译标题（意译，不要逐字翻）
    - `publishDate`: 今天日期（YYYY-MM-DD）
    - `description`: 一句话点题，中文
    - `tags`: 主题归纳，中文 + 必要英文术语
    - `source.title`: 原文英文标题
    - `source.url`: $ARGUMENTS
    - `source.author`: Anthropic
    - `source.siteName`: Anthropic Engineering
    - `source.publishDate`: 原文发布日期
    - `translator`: Harlon Wang
4. **正文翻译风格**（务必参考 `src/content/posts/claude-code-best-practices.mdx`）：
    - 意译为主、口语化，不要逐句直译
    - 必要英文术语保留：context window、plan mode、agent、harness、tool use、MCP 等
    - 首次出现的英文术语用括号注解中文，例如：`agentic coding（代理式编码）`
    - 中英文之间加空格
    - 用表格做对照（比如「改之前 / 改之后」）
    - 加粗重点，必要时加 ⭐ 突出
    - 横线分节（`---`）
    - 结尾留一段「总结 / 直觉」类的话

## 完成后告诉我

- 生成的文件路径
- 我需要手动更新 `.translation-queue/seen.json`：
    - `status: 'translated'`
    - `translatedSlug: '<slug>'`
    - `translatedAt: '<今天日期>'`
- 关联的 issue 可以 close

## 禁止

- 不要 `git commit`（由我手动决定）
- 不要新建 README 或额外说明文档
