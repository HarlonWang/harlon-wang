# CLAUDE.md

## 原创技术文章的结构规范

原创技术文章（尤其实操类）以**整体流程说明为主线**，踩坑内容降级为流程阶段内的辅助提示，不要按"撞坑顺序"组织全文。

写作模板（参照 `publishing-kmp-app-to-fdroid.mdx` 和 `kmp-library-auto-publish-maven-central.mdx`）：

1. **倒金字塔开头**：先给终态/最终体验 + 读完能带走什么
2. **全局一节**：总流程图 + 2-3 条核心机制说明
3. **按读者操作顺序分阶段**（动词标题），每阶段 = 目标 → 操作/代码 → ✅ 验证方法 → 踩坑提示（含根因）
4. **文末两个资产**：操作前 Checklist + 坑速查表（症状 → 根因 → 修复 → 章节）
5. 坑的根因解释和实录细节要保留（可信度来源），但叙事视角是"你该做什么"，不是"我撞到了什么"
6. 与主线正交的内容放「支线」或附录，不设"其他小点"式杂物堆

## 掘金同步

把原创文章同步发布到掘金的工具在 `scripts/juejin-sync.mjs`（详见 `scripts/juejin/README.md`）。

当用户说「把某篇同步/发到掘金」时：

1. **定位文章**：按 slug（文件名去 `.mdx`）或标题关键词找到 `src/content/posts/*.mdx`。
2. **确定分类/标签**：用户指定就用；没指定就读文章内容，从 `scripts/juejin-taxonomy.json` 里挑合适的**分类（8 选 1）+ 标签**，建议给用户确认。标签必须在 taxonomy 表内（表外的掘金没有 ID，发不了）。
3. **加 frontmatter**：给文章加 `juejin: { category, tags }` 对象（其存在即同步开关，只发原创）。
4. **发布**：`node scripts/juejin-sync.mjs <slug>`，回用户掘金链接。已发过的会自动跳过（`.juejin-synced.json` 记账），`--force` 可强制重发。

**鉴权失效处理**：`.env` 的 `JUEJIN_COOKIE`（约一年）/ `JUEJIN_CSRF_TOKEN`（session 级，更短）过期时会报鉴权错（err_no 非 0）。让用户从浏览器 DevTools 复制一条 `api.juejin.cn` 请求的 cookie 和 x-secsdk-csrf-token（或直接 Copy as cURL 整条），更新 `.env` 即可。`.env` 已 gitignore，勿提交。
