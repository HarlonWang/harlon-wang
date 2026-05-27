---
date: 2026-05-07
status: in-progress
topic: harlon.wang 个人网站设计
updated: 2026-05-27
---

# harlon.wang 个人网站设计

> **状态**：进行中（v1 骨架搭建中）
> **首次时间**：2026-05-07
> **最近更新**：2026-05-27（v1 加入 Posts 板块；本期不做英文版）
> **下次入口**：从「§ 4.4 待确认问题 Q3/Q4」开始

---

## 一、用户背景与决策依据

- 王海龙（Harlon Wang），1989 年生，杭州
- PingPong Android 架构师（2025.09 至今），主攻 Kotlin Multiplatform
- 经历：阿里巴巴（淘宝特价版容器架构）、商米科技（IoT 低代码平台 Android TL）
- GitHub 累计 10K Stars，掘金 10+ 篇技术文章
- 代表项目：
    - **Trending AI**（[trendingai.cn](https://trendingai.cn)）— 用 AI 读懂 GitHub Trending
    - **QuickJS Wrapper**（[github.com/HarlonWang/quickjs-wrapper](https://github.com/HarlonWang/quickjs-wrapper)）— Android/JVM 平台 QuickJS Binding 库
- 技术栈：Kotlin ⭐⭐⭐⭐⭐、Java ⭐⭐⭐⭐⭐、JavaScript ⭐⭐⭐⭐、KMP ⭐⭐⭐⭐⭐
- 域名：**harlon.wang**（已申请）

---

## 二、已确认决策（8 项）

| # | 维度 | 选择 | 备注 |
|---|------|------|------|
| 1 | 网站定位 | **作品集 + 博客双栖** | v1 含名片简版 + Products + Posts；首页样式打磨推后 |
| 2 | 博客内容策略 | **双发同步**（站内主，掘金镜像） | 第二版再实施 |
| 3 | 语言策略 | **中文为主 + 英文 About/Products 页** | **本期完全不做英文版**（仅保留决策，延后实施）；不做完整 i18n，博客不做英文版 |
| 4 | 视觉风格 | **极简主义** | 参考 Paul Graham、Dan Abramov、Linus Lee 风格 |
| 5 | 顶层导航 | **4 项**：首页 / `/posts` / `/products` / `/about` | Posts 前置突出新内容；本期导航无 [EN] 切换；`/uses`、`/now` 不做 |
| 6 | `/products` 结构 | **扁平列表**，按 `year` 倒序 | 不分 App / Library 分组 |
| 7 | 技术栈 | **Astro 5 + MDX + Cloudflare Pages** | 完全静态生成，零 JS 默认输出，内容存仓库 |
| 8 | Posts 板块 | **`/posts` 单一板块** | `type` 字段区分 translation/original；translation 强制带 source（标题/原作者/URL/站点）；译文 license 默认 CC BY-NC-SA 4.0 |

### 2.1 各决策的取舍备注

**为什么是 Astro 而非 Next.js / Hugo**
- 极简风 + 内容主导站点，Astro 是最佳场景，零 JS 默认输出意味着首屏极快
- Next.js 对内容站过重（RSC / ISR 用不上但概念复杂度都得承担）
- Hugo 模板系统老旧，定制 UI 不顺手

**为什么是 Cloudflare Pages 而非 Vercel**
- 国内访问稳定性更好（Vercel 国内偶尔抽风）
- 免费额度足够，DDoS 防护和分析免费

**为什么 v1 把 Posts 板块提前**
- 已有现成翻译内容（如 Claude Code 最佳实践），「先有读物比先有作品集更紧迫」
- 翻译 + 原创共用 `/posts`，type 字段区分，避免未来再拆迁
- 但首页样式打磨推后，先求站点骨架跑通

**为什么本期不做英文版**
- 翻译稿本身就是中文产物，英文 About/Products 工作量大且非首要
- spec 里中英双语决策保留，等 Q1（`/en/` URL 策略）决议后再启动

---

## 三、整体架构（已确认）

```
harlon.wang (Cloudflare Pages)
    │
    ├── Astro 5 + MDX  ──────────  内容渲染（构建时静态生成）
    │       │
    │       ├── src/pages/         路由
    │       ├── src/content/       Content Collections（Zod schema 类型安全）
    │       │       ├── products/  产品/项目 .mdx
    │       │       └── posts/     文章 .mdx（翻译 + 原创共存，type 字段区分）
    │       ├── src/layouts/       页面骨架
    │       ├── src/components/    Astro 组件（默认零 JS）
    │       └── src/styles/        全局 CSS
    │
    ├── GitHub (HarlonWang/harlon-wang)
    │       └── push to main → Cloudflare Pages 自动构建部署
    │
    └── 资产
            ├── 域名 harlon.wang   托管 DNS 在 Cloudflare
            └── 静态资源           Astro 内置 <Image /> 自动优化
```

**关键技术决策：**

- **完全静态生成（SSG）**：构建时生成所有 HTML，CDN 边缘缓存
- **Content Collections + Zod**：frontmatter 字段类型安全，写错构建时报错
- **零运行时框架**：默认不引入 React/Vue，仅在需要交互的局部组件显式 hydrate
- **图片**：Astro 内置 `<Image />`，自动生成 WebP/AVIF 多尺寸

---

## 四、信息架构（部分已确认）

### 4.1 路由表（已确认）

> 注：英文版本期完全不做，"延后"列保留作未来实施参考。

| 路径 | 中文 | 英文 | 内容 |
|------|------|------|------|
| `/` | ✓ | 延后 | 首页：名片简版（精选作品/精选 Posts 待定，见 Q4） |
| `/posts` | ✓ | — | 文章列表，按 publishDate 倒序，[译]/[原] 视觉区分（博客不做英文版） |
| `/posts/[slug]` | ✓ | — | 单篇文章详情，translation 类型自动渲染原文链接/署名 |
| `/products` | ✓ | 延后 | 产品列表，扁平按 year 倒序 |
| `/products/[slug]` | ✓ | 延后 | 单个产品详情页（简单产品可直接外链 GitHub） |
| `/about` | ✓ | 延后 | 关于我 + 联系方式 |
| `/sitemap.xml` | ✓ | ✓ | SEO |
| `/404` | ✓ | — | 极简 404 |

### 4.2 顶层导航（已确认）

```
harlon.wang              Posts    Products    About
```

- Logo 即域名小写无修饰，点击回首页
- 3 个导航链接靠右，Posts 在最前突出新增板块
- **本期无 [EN] 切换**（英文版延后）
- 暗色模式开关位置待定（见 § 4.4 Q3）

### 4.3 内容模型 — Products（已确认）

```yaml
name: QuickJS Wrapper
status: active             # active | archived（archived 在列表页淡化或置底）
year: 2024
description_zh: Android/JVM 平台下的 QuickJS Binding 库
description_en: A QuickJS binding library for Android and JVM
links:
    github: https://github.com/HarlonWang/quickjs-wrapper
    website: null
    app: null
stars: 1200                # 可选
featured: true             # 首页精选展示用，建议保持 2-4 个
```

### 4.5 内容模型 — Posts（已确认）

```yaml
title: Claude Code 最佳实践
type: translation                 # translation | original
publishDate: 2026-05-27
description: ...
tags:
  - AI
  - Claude Code
draft: false
# 仅 translation 必填（schema 用 .refine 强校验）
source:
  title: Best practices for Claude Code
  url: https://code.claude.com/docs/en/best-practices
  author: Anthropic
  siteName: Anthropic Engineering
  publishDate: 2025-04-18         # 可选
translator: Harlon Wang           # 可选，默认 Harlon Wang
```

规则：

- `type === 'translation'` 时 `source` 必填
- `TranslationBanner` / `TranslationFooter` 仅在 translation 类型渲染
- 列表卡片：🌐 译 / ✍️ 原 前缀视觉区分
- 默认译文 license：CC BY-NC-SA 4.0（可在 frontmatter 覆盖）

### 4.4 待确认问题

**Q1：英文版 URL 策略**（本期不实施，留待启动英文版时决议）

候选方案：
- **A**（推荐）：`/en/` 前缀，如 `/en/about`、`/en/products` — Astro 官方 i18n 推荐
- **B**：查询参数，如 `/about?lang=en` — 不利于 SEO

→ **未决**（延后）

**Q2：Products 的 `stars` 字段获取方式**

候选方案：
- **A**：手动维护（写死在 frontmatter）— 简单，但需手动更新
- **B**：构建时从 GitHub API 拉取 — 更准，但需存 GitHub Token，构建偶尔受 API 限流影响

→ **未决**

**Q3：暗色模式开关位置**（新增）

候选方案：
- **A**：顶栏最右侧（原 [EN] 位置）
- **B**：页脚（极简风优先）
- **C**：仅自动跟随系统，不提供手动开关

→ **未决**

**Q4：首页是否展示精选 Posts**（新增）

候选方案：
- **A**：首页同时展示「精选作品 + 精选文章」两个区块
- **B**：首页只展示精选作品，文章入口靠导航
- **C**：首页只展示最新文章 3 篇 + 精选作品

→ **未决**

---

## 五、还需讨论的章节（下次按此顺序）

1. **§ 5 首屏 / 关键页面布局** — 用浏览器 mockup 对比首页 / `/posts` / `/products` / `/about` 的具体排版（含 Q4 精选 Posts 决议）
2. **§ 6 字体配色系统** — 极简风的关键决策点（中英文字体选型 / 配色规则 / 间距系统）
3. **§ 7 内容工作流** — 写 post（翻译/原创）、product 详情、about 的具体流程
4. **§ 8 i18n 实现细节** — 解决 Q1 后展开（本期延后，v1 完全不做英文版）
5. **§ 9 部署与域名配置** — Cloudflare Pages 接入流程、DNS 配置、自定义域名绑定
6. **§ 10 暗色模式** — 含 Q3 决议
7. **§ 11 第一版交付边界** — 明确 MVP 范围和后续迭代计划

---

## 六、下次会话开场建议

复制以下内容作为下次会话的开场：

> 继续 harlon.wang 个人网站设计 brainstorming。
> 已有决策和上下文见 `docs/superpowers/specs/2026-05-07-harlon-wang-website-design.md`。
> v1 骨架（含 Posts、Products、About）已搭建完成，第一篇翻译稿《Claude Code 最佳实践》已落地。
> 请从「§ 4.4 待确认问题 Q3（暗色模式）、Q4（首页精选 Posts）」开始决议，
> 然后进入「§ 5 首屏 / 关键页面布局」。Q1（英文 URL）和英文版整体延后到启动国际化时再决。

---

## 附：本次 brainstorming 流程记录

为了下次能快速恢复语境，记录决策的对话顺序：

1. 提供 Visual Companion → 用户接受
2. 网站定位 → D（作品集 + 博客双栖）
3. 博客内容承接 → C（双发同步）
4. 是否英文版 → B（中文为主 + 英文 About/产品页）
5. 视觉风格 → A（极简主义）
6. 顶层导航 → 推荐方案 + 用户调整：`/open-source` 改为 `/products`，去掉 `/uses`
7. 技术栈 → A（Astro + MDX + Cloudflare Pages）
8. § 1 整体架构 → 接受
9. § 2 信息架构 → 用户调整：博客先不做、产品不分 App/Library
10. 用户暂停沟通

可视化伴侣会话目录（如下次想沿用 mockup）：
`.superpowers/brainstorm/5172-1778124421/`
