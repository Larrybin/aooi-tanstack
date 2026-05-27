# Implementation PR Plan：aooi i18n Localization

## Technical Complete：6 个技术 PR

### PR1：语言注册表

目标：

- 新增 `src/config/locale/registry.json`
- 以 JSON 作为全局语言注册表唯一数据源
- 每个 locale 包含 `code / name / englishName / direction / hreflang`
- 新增 Zod schema
- 从 registry 派生现有 `locales / localeNames / rtlLocales / hreflang map`

验收：

- registry 字段完整
- locale code 不重复
- hreflang 不重复
- direction 只允许 `ltr / rtl`
- 现有 next-intl routing 不回退

---

### PR2：site-level i18n 配置与 routing / sitemap / canonical / hreflang

目标：

- `site.config.json` 支持标准 i18n 配置
- site supportedLocales 必须来自 registry
- defaultLocale 必须包含在 supportedLocales
- unsupported locale URL production 404
- 默认语言无前缀
- 非默认语言有前缀
- canonical 指向当前语言页面自身
- x-default 指向默认语言当前页面
- footer language switcher 固定 footer
- production 只展示完整可发布语言

验收：

- `/pricing` 是默认语言
- `/zh/pricing` 是中文
- 未支持语言 `/fr/pricing` 404
- sitemap / hreflang 不再全局展开所有语言

---

### PR3：pages.json / manifest.json schema

目标：

- 新增 `sites/<site-key>/i18n/pages.json`
- 新增 `sites/<site-key>/i18n/manifest.json`
- 定义页面类型：`seo / blog / docs / legal / product-ui / auth / admin`
- pages.json 每项至少包含 `pageId / path / type / indexable / required / source / hashScope`
- manifest 只记录非默认语言
- 每页记录 `status / sourceHash / targetHash`
- page key 使用 pageId，同时记录 path

验收：

- schema 校验可运行
- page registry 与 manifest 能被脚本读取
- 默认语言 en 不要求 manifest approved

---

### PR4：glossary / fallback / hardcoded text 检查

目标：

- 新增 global glossary：`src/config/locale/glossary.global.json`
- 新增 site glossary：`sites/<site-key>/i18n/glossary.json`
- global glossary 支持 `preserve`
- site glossary 支持 `preserve / terms / forbidden`
- 英文残留检测全站 strict fail
- forbidden：seo/blog/docs/product-ui/legal strict fail；admin/auth warning
- 新增/修改文件硬编码用户可见英文检查
- i18n-exempt 必须写 reason

验收：

- 未授权英文残留在目标语言内容中触发 error
- preserve 词不误伤
- forbidden 在 SEO/legal/product-ui 触发 error
- admin/auth 触发 warning

---

### PR5：i18n:check + JSON report + build / CI / cf:build 接入

目标：

- 新增命令：

```bash
pnpm i18n:check --site <site>
pnpm i18n:check --site <site> --strict
```

- 输出 terminal report
- 输出 JSON report：`.reports/i18n/<site-key>/latest.json`
- severity：`error / warning / info`
- strict 模式：error fail，warning 不 fail
- 接入：
  - `pnpm build`：warning，不阻断
  - CI：strict fail
  - `pnpm cf:build`：strict fail

验收：

- 本地普通 build 不因 i18n warning 失败
- CI/cf:build 有 error 时失败
- JSON report 可被 Codex skill 读取

---

### PR6：Codex skills

目标：

- 新增仓库内置 skill：`i18n-localize`
- 新增仓库内置 skill：`i18n-review`

`i18n-localize` 职责：

- 读取 site config
- 读取 pages.json
- 读取英文源内容
- 读取 glossary
- 接收用户粘贴 SEO brief
- 生成目标语言内容
- 更新 manifest 为 pending
- 创建 Draft PR
- 打 `i18n-pending-review` label

`i18n-review` 职责：

- 辅助人工审核
- 检查 SEO / glossary / fallback / 页面完整性
- 输出审核报告
- 用户明确确认后，才把 pending 改 approved
- 执行前展示实际 approved 页面清单

验收：

- AI 生成不等于 approved
- review skill 不能自己决定批准
- approved 必须来自用户明确授权

---

## Rollout Complete：站点迁移 PR

### PR7：rollout scope 与 legacy optional 规则收口

目标：

- 旧网站不再强制实行多语言
- `mamamiya`、`dev-local` 标记为 legacy / optional
- `ai-remover`、`background-remover` 为 V1 rollout-required
- 后续新增正式站点必须显式加入 rollout-required 清单后，才执行同一门槛
- 更新 SPEC、decision log、skill 与检查逻辑中的 rollout scope 表述
- 明确后续 rollout PR 拆分为 PR8 / PR9

验收：

- `pnpm i18n:check --site mamamiya --strict` 不因缺少 rollout 内容失败
- `pnpm i18n:check --site ai-remover --strict` 与 `background-remover` 使用 rollout-required 规则
- 文档不再把 `mamamiya` 写成 V1 强制样板站

---

### PR8：ai-remover i18n rollout

目标：

- 首批语言：`en / zh / ja`
- 完成 `ai-remover` 中文和日文全站 required pages
- SEO / legal / product UI 无英文 fallback
- manifest 对应页面 approved
- sitemap / hreflang 只包含合规页面
- CI / cf:build strict 通过

验收：

- `ai-remover` zh / ja required pages 均 approved
- `pnpm i18n:check --site ai-remover --strict` 通过且无 error

---

### PR9：background-remover i18n rollout

目标：

- 首批语言：`en / zh / ja`
- 完成 `background-remover` 中文和日文全站 required pages
- SEO / legal / product UI 无英文 fallback
- manifest 对应页面 approved
- sitemap / hreflang 只包含合规页面
- CI / cf:build strict 通过

验收：

- `background-remover` zh / ja required pages 均 approved
- `pnpm i18n:check --site background-remover --strict` 通过且无 error
