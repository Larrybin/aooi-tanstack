# SPEC：Site-level 全站多语言与 SEO Localization 系统

## 1. Problem Statement（问题陈述）

当前 aooi 库已有基础多语言能力，但它更偏向全局 UI i18n，不足以支撑未来多 SaaS / 多工具站 / 多语种 SEO 增长的生产需求。

核心问题包括：

1. **语言配置是全局的，不是 site-level 的**
   不同 site 的目标市场不同，不应该所有站共享同一套启用语言。

2. **UI 翻译与 SEO 内容本地化混在一起**
   产品按钮、后台文案、SEO 页面、blog、docs、legal 的本地化标准不同，不能用同一套简单翻译逻辑处理。

3. **缺少严格发布门槛**
   不能保证目标语言页面无英文 fallback、无缺失 key、无未审核内容、无错误 sitemap / hreflang。

4. **缺少人工审核可追踪机制**
   AI 可以生成多语言内容，但不能直接视为 approved。系统需要知道哪些页面、哪些语言已经人工审核通过。

5. **缺少面向 Codex 工作流的多语言生成/审核 skill**
   未来希望通过仓库内置 Codex skill 生成多语言内容、标记 pending、辅助 review、在明确授权后 approved。

6. **SEO 本地化不是简单翻译**
   SEO 页面需要根据目标语言关键词和搜索意图重写，但关键词 brief 由用户自行提供，不入库，CI 不负责验证 brief。

---

## 2. Proposed Solution（方案描述）

把 aooi 的多语言能力从：

```text
全局 UI i18n
```

演化为：

```text
site-level 全站多语言 + SEO localization + 严格发布治理
```

目标优先级：

```text
SEO 增长 + 产品体验都要，但 SEO 更重要。
```

---

## 3. Core Decisions（核心决策）

### 3.1 语言粒度

每个 site 自己配置支持语言。

```json
{
  "i18n": {
    "defaultLocale": "en",
    "supportedLocales": ["en", "zh", "ja"],
    "localePrefix": "as-needed",
    "localeDetection": false,
    "languageSwitcher": {
      "placement": "footer"
    }
  }
}
```

全局维护语言注册表，site 只能从全局 registry 中选择子集。

### 3.2 推荐语言池

全库推荐语言候选池：

```text
en / es / pt-BR / ja / de / fr / ko / zh
```

V1 不强制所有旧站一次性 rollout。首批强制站点为 `ai-remover`、`background-remover`，以及后续新增 production site。旧站（如 `mamamiya`、`dev-local`）默认 optional，只有明确进入 rollout 时才要求完整多语言。

首批 rollout 语言：

```text
en / zh / ja
```

### 3.3 URL 策略

默认语言不带前缀，非默认语言带前缀。

```text
/pricing
/privacy-policy

/zh/pricing
/ja/pricing
```

不做 slug 本地化。

### 3.4 浏览器语言检测

不自动跳转。

```text
localeDetection = false
```

用户访问什么 URL，就展示什么语言。

### 3.5 语言切换器

语言切换器固定放在 footer。

```text
header 不放
不允许 site 覆盖
```

展示规则：

```text
development：显示所有 supportedLocales
production：只显示完整可发布语言
```

点击语言切换时：

```text
保留当前 path
只切换 locale
保留 query 参数
```

### 3.6 未支持语言 URL

如果某个 site 不支持某语言，访问该 locale URL 直接 404。

```text
/fr/pricing → 404
/de/admin → 404
```

### 3.7 Canonical / hreflang

每个语言页面 canonical 指向自己。

```text
/pricing canonical → /pricing
/zh/pricing canonical → /zh/pricing
/ja/pricing canonical → /ja/pricing
```

`x-default` 指向默认语言当前页面。

---

## 4. Content Model（内容模型）

### 4.1 内容分层

使用：

```text
全局 UI 翻译 + site 级 SEO / 内容翻译
```

全局 UI 文案继续放：

```text
src/config/locale/messages
```

site 级 SEO / 内容翻译放：

```text
sites/<site-key>/...
```

### 4.2 SEO 页面不是直译

规则：

```text
SEO 页面必须本地化重写；
产品 UI 可以准确翻译。
```

SEO brief 由用户自行提供，不入库。

系统不负责：

```text
自动关键词调研
自动猜目标语言关键词
CI 校验 brief 是否正确
```

### 4.3 SEO brief 的使用方式

brief 只在 Codex skill 执行时由用户临时粘贴提供。

CI 不检查 SEO brief。CI 只检查：

```text
内容完整性
无英文 fallback
manifest approved
sourceHash / targetHash
glossary / forbidden
sitemap / hreflang
```

---

## 5. Page Registry 与 Manifest

### 5.1 pages.json

每个 site 单独建立页面清单：

```text
sites/<site-key>/i18n/pages.json
```

职责：

```text
定义 pageId
定义 path
定义 type
定义 indexable
定义 required
定义 source
定义 hashScope
```

页面字段：

```json
{
  "pageId": "pricing",
  "path": "/pricing",
  "type": "seo",
  "indexable": true,
  "required": true,
  "source": {
    "kind": "site-content",
    "path": "content/locales/en/pricing.mdx"
  },
  "hashScope": "seo"
}
```

### 5.2 页面类型

V1 使用七类：

```text
seo
blog
docs
legal
product-ui
auth
admin
```

### 5.3 blog / docs 进入规则

blog / docs 自动扫描，但必须满足：

```text
published: true
indexable: true
```

系统根据文件路径生成稳定 pageId。

示例：

```text
blog/background-remover-guide.mdx
→ blog.background-remover-guide
```

site 可以通过 exclude 排除特例。

### 5.4 manifest.json

每个 site 一个 manifest：

```text
sites/<site-key>/i18n/manifest.json
```

manifest 只记录非默认语言。默认语言 `en` 不进入 manifest 审核。

每个页面记录：

```json
{
  "status": "approved",
  "sourceHash": "...",
  "targetHash": "..."
}
```

页面 key 使用稳定 `pageId`，并记录 path。

```json
{
  "locales": {
    "zh": {
      "home": {
        "path": "/",
        "status": "approved",
        "sourceHash": "...",
        "targetHash": "..."
      }
    }
  }
}
```

---

## 6. Review Workflow（审核流程）

### 6.1 AI 生成内容

采用仓库内置 Codex skill，不在 V1 直接接 OpenAI / OpenRouter API。

拆成两个 skill：

```text
i18n-localize
i18n-review
```

### 6.2 i18n-localize

职责：

```text
读取 site config
读取 pages.json
读取英文源内容
读取 glossary
接收用户粘贴的 SEO brief
生成目标语言内容
更新 manifest，对应页面状态为 pending
```

AI 生成 PR 时：

```text
创建 Draft PR
打 i18n-pending-review label
manifest 初始为 pending
```

### 6.3 i18n-review

职责：

```text
辅助人工审核
检查 SEO / glossary / fallback / 页面完整性
输出审核报告
```

允许把 pending 改为 approved，但必须用户明确确认。

确认粒度：默认按页面批准，允许批量选择。执行前必须展示实际 approved 页面清单。

### 6.4 英文源变化后的失效规则

英文是唯一源语言。

如果英文源用户可见文案变化，对应目标语言页面 approved 自动失效，需要重新审核。

用户可见文案包括：

```text
title
description
H1
正文
CTA
FAQ
按钮文案
错误提示
```

不触发：

```text
样式
className
注释
布局代码
非用户可见改动
```

实现策略：

```text
强制英文源内容资产化。
所有用户可见文案必须来自 messages、MDX、site content 等内容资产。
```

---

## 7. Glossary 与 Fallback 检查

### 7.1 Global Registry

全局语言注册表使用 JSON 作为唯一数据源：

```text
src/config/locale/registry.json
```

每个 locale 字段：

```json
{
  "code": "zh",
  "name": "中文",
  "englishName": "Chinese",
  "direction": "ltr",
  "hreflang": "zh"
}
```

使用 Zod 校验，预留生成 JSON Schema 的能力。

### 7.2 Glossary 路径

```text
src/config/locale/glossary.global.json
sites/<site-key>/i18n/glossary.json
```

两者都用 Zod 校验。

### 7.3 Glossary 结构

global glossary 只做 preserve allowlist。

```json
{
  "preserve": ["AI", "API", "PNG", "JPG", "PDF", "URL", "Cloudflare"]
}
```

site glossary 支持：

```text
preserve
terms
forbidden
```

示例：

```json
{
  "preserve": ["Mamamiya"],
  "terms": {
    "credits": {
      "zh": "积分",
      "ja": "クレジット"
    }
  },
  "forbidden": {
    "allLocales": ["100% perfect", "free forever"],
    "zh": ["永久免费"],
    "ja": ["永久無料"]
  }
}
```

### 7.4 Forbidden 处理

命中 forbidden 后：

```text
seo / blog / docs / product-ui / legal：strict fail
admin / auth：warning
```

### 7.5 英文残留检测

全站 strict fail。

任何 required 页面，只要目标语言内容出现未被允许的英文残留，CI / cf:build 必须失败。

允许来源：

```text
global glossary preserve
site glossary preserve
i18n-exempt 显式例外
```

### 7.6 i18n-exempt

V1 对新增 / 修改文件严格禁止硬编码用户可见英文文案。旧代码暂时允许存在，但进入报告。

允许少量例外，但必须显式写原因。

规则：

```text
品牌名、产品名、文件格式、固定技术词：
必须进入 global glossary 或 site glossary

测试文案、开发占位、不可见 debug / aria 特例：
可以只写 exempt reason
```

---

## 8. Checks and Gates（检查与发布门槛）

### 8.1 默认语言英文源检查

`en` 不进 manifest，但必须按页面类型检查源内容质量。

```text
seo / blog / docs：metadata、H1、正文、CTA、FAQ、占位文案
legal：正文、更新时间、关键段落
product-ui / auth / admin：key 完整、无新增硬编码用户可见英文文案
```

### 8.2 目标语言检查

按页面类型分层 strict：

```text
seo / blog / docs：
字段完整、无英文残留、glossary、forbidden、metadata 长度、FAQ / CTA 检查

legal：
字段完整、无英文残留、forbidden strict，glossary warning

product-ui：
字段完整、无英文残留、glossary strict

auth / admin：
字段完整、无英文残留 strict，glossary warning
```

### 8.3 i18n:check

需要独立命令：

```bash
pnpm i18n:check --site mamamiya
pnpm i18n:check --site mamamiya --strict
```

输出：

```text
terminal 给人看
JSON report 给 CI / Codex skill / 后续自动化读取
```

报告路径：

```text
.reports/i18n/<site-key>/latest.json
```

问题分级：

```text
error
warning
info
```

严格模式下：

```text
只有 error 阻断 CI / cf:build
warning 不阻断
```

### 8.4 build / CI / cf:build 接入

```text
pnpm build：warning，不阻断本地普通构建
CI：strict fail
pnpm cf:build：strict fail
```

---

## 9. Sitemap / hreflang Rules

只有 SEO 可索引页面进入 sitemap / hreflang。

SEO 可索引页面由系统自动推断：

```text
home
tool page
pricing
blog
docs
legal
```

site 可以 include / exclude 覆盖。

进入 sitemap / hreflang 的条件：

```text
indexable: true
required: true
目标语言内容完整
manifest 页面级 approved
sourceHash / targetHash 匹配
无 error
```

非 SEO 页面不进 sitemap，但仍然必须完整多语言、无英文 fallback。

---

## 10. Technical Constraints（技术约束）

1. 继续使用 Next.js App Router + next-intl。
2. 默认语言不带 locale 前缀。
3. 非默认语言带 locale 前缀。
4. 不做 slug 本地化。
5. 不做浏览器语言自动跳转。
6. 语言切换器固定 footer。
7. site 只能从全局语言注册表选择 supportedLocales。
8. registry、glossary、pages、manifest 都必须可被脚本和 Codex skill 读取。
9. 配置校验统一使用 Zod。
10. SEO brief 不入库，CI 不校验 brief。
11. AI 生成内容必须先进入 Draft PR，状态为 pending。
12. AI 不允许直接 approved。
13. 用户明确确认后，i18n-review 才能写 approved。
14. 英文源用户可见文案必须资产化，不能继续新增硬编码英文。
15. production site 严格；dev-local 使用测试专用规则。

---

## 11. Non-goals（明确不做的事）

V1 不做：

1. 不自动做关键词调研。
2. 不自动猜目标语言 SEO 关键词。
3. 不把 SEO brief 入库。
4. 不让 CI 校验 brief 质量。
5. 不直接接 OpenAI / OpenRouter API 自动生成内容。
6. 不做全自动发布。
7. 不做 slug 本地化。
8. 不做浏览器语言自动跳转。
9. 不做 header 语言切换器。
10. 不记住用户语言偏好。
11. 不让 warning 阻断发布。
12. 不要求 `dev-local` 做真实 SEO 本地化。
13. 不一次性把所有语言扩到 8 种。
14. 不允许 AI 自己把 pending 改成 approved。
15. 不在 V1 强制清完所有历史硬编码文案，但新增/修改文件必须收口。

---

## 12. Success Criteria（成功标准）

### 12.1 V1 Technical Complete

完成以下能力即为 technical complete：

1. `src/config/locale/registry.json` 存在，并通过 Zod 校验。
2. 每个 production site 的 `site.config.json` 支持标准 i18n 配置。
3. site-level `supportedLocales` 生效。
4. unsupported locale URL 返回 404。
5. 默认语言无前缀，非默认语言有前缀。
6. canonical 指向当前语言页面自身。
7. hreflang 包含当前 site 支持且 approved 的语言页面。
8. `x-default` 指向默认语言当前页面。
9. footer 语言切换器可用，且 production 只展示完整可发布语言。
10. `pages.json` schema 完成。
11. `manifest.json` schema 完成。
12. global glossary + site glossary schema 完成。
13. 英文残留检测完成。
14. forbidden 检查完成。
15. 新增/修改文件硬编码用户可见英文检查完成。
16. `pnpm i18n:check --site <site>` 可运行。
17. `pnpm i18n:check --site <site> --strict` 可运行。
18. JSON report 输出到 `.reports/i18n/<site-key>/latest.json`。
19. `pnpm build` 只 warning。
20. CI / `pnpm cf:build` strict fail。
21. 仓库内置 `i18n-localize` Codex skill。
22. 仓库内置 `i18n-review` Codex skill。

### 12.2 V1 Rollout Complete

完成以下即为 rollout complete：

1. 首批强制 rollout site 为 `ai-remover` 与 `background-remover`。
2. 旧站不强制 rollout；`mamamiya`、`dev-local` 作为 legacy / optional，只有明确纳入时才执行完整多语言发布门槛。
3. 首批支持语言为：

```text
en / zh / ja
```

4. `ai-remover` 有完整 site-level i18n 配置。
5. `ai-remover` 有完整 `pages.json`、`manifest.json`、site glossary。
6. `ai-remover` 中文和日文全站 required pages 均 approved。
7. `ai-remover` 无英文 fallback。
8. `ai-remover` sitemap / hreflang 只包含合规页面。
9. `ai-remover` CI / cf:build strict 通过。
10. `background-remover` 有完整 site-level i18n 配置。
11. `background-remover` 有完整 `pages.json`、`manifest.json`、site glossary。
12. `background-remover` 中文和日文全站 required pages 均 approved。
13. `background-remover` 无英文 fallback。
14. `background-remover` sitemap / hreflang 只包含合规页面。
15. `background-remover` CI / cf:build strict 通过。
16. 后续新增 production site 默认遵循同一 rollout 门槛。

---

## 13. PR Plan（实施拆分）

### Technical Complete：6 个技术 PR

```text
PR1：语言注册表
PR2：site-level i18n 配置与 routing / sitemap / canonical / hreflang
PR3：pages.json / manifest.json schema
PR4：glossary / fallback / hardcoded text 检查
PR5：i18n:check + JSON report + build / CI / cf:build 接入
PR6：Codex skills
```

### Rollout Complete：站点迁移 PR

首批只迁移强制 rollout 站点：

```text
PR7：rollout scope 与 legacy optional 规则收口
PR8：ai-remover i18n rollout
PR9：background-remover i18n rollout
```

后续新增 production site 默认按同一门槛执行；旧站只有明确纳入时才迁移。

---

## 14. Final Summary（一句话版本）

这个 SPEC 的核心是：

> **把 aooi 的多语言从“全局翻译包”升级成“每个 site 独立声明语言、全站内容资产化、AI 生成但人工审核、CI 严格防 fallback、SEO 页面可被多语言收录”的生产级 localization 系统。**
