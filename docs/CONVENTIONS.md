# 既有约定与代码模式索引（Conventions Index）

本文件用于把仓库中“分散的约束、约定、模式样本”集中成一个可检索入口，方便人类与 AI 在做决策时快速定位权威来源与同类实现。

原则：**本文件是索引，不是大全**；规则以“可执行的护栏/真实代码”为准。本文件只负责指路与降低遗漏。

## 使用方式（推荐顺序）

1. 先读本文件，找到与你任务最接近的主题与样本入口。
2. 打开对应的“单一事实来源”（例如 `eslint.config.mjs`、`docs/architecture/shared-layering.md`）确认硬约束。
3. 选 3–5 个同类样本文件核对实现细节（命名、导出、错误处理、依赖方向）。
4. 发生冲突或需要偏离既有模式时，必须在 `.codex/plan/<任务名>.md` 记录取舍依据与验证方式。

## 最佳实践来源优先级与冲突处理

决策取证优先级（从高到低）：

1. 仓库既有约定与代码模式（同类模块的现有实现、目录结构、命名、错误处理、日志、测试方式）
2. `AGENTS.md` 约束（含更近作用域的 `AGENTS.md`）
3. 官方文档与权威资料（需要时用 Context7 查询并对齐版本）
4. 经验推断（必须标注为推断，并尽量给出可验证替代方案）

冲突记录模板（写入 `.codex/plan/<任务名>.md`）：

```md
- 冲突点：<描述>
  - 方案 A（来源）：...
  - 方案 B（来源）：...
  - 最终选择：...
  - 取舍依据：<一致性/风险/可维护性/性能/交付周期/约束>
  - 验证方式：<如何证明选择不会破坏目标>
```

## 单一事实来源（优先查这里）

| 主题                         | 单一事实来源                                                 | 说明                                                                                                          |
| ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 当前架构基线                 | `docs/architecture/overview.md`                              | 当前目录职责、模块所有权与依赖方向的人工可读基线；机器规则以 `architecture-rules.cjs` 为准。                  |
| 架构结构守卫 manifest        | `architecture-rules.cjs`                                     | 机器可读的结构规则源；`dependency-cruiser.cjs` 与 `src/architecture-boundaries.test.ts` 必须共享它。          |
| Server/Client 边界、依赖方向 | `eslint.config.mjs`                                          | 以 lint 规则固化边界，避免口头约定（见 `docs/CODE_REVIEW.md`）。                                              |
| `src/shared` 分层约定        | `docs/architecture/shared-layering.md`                       | 规定 shared 只保留纯 UI、工具、HTTP schema、types、constants，禁止业务能力回流。                              |
| Code Review 基线             | `docs/CODE_REVIEW.md`                                        | PR 审查顺序与常见坑，含大量场景化示例。                                                                       |
| 历史架构审计报告             | `docs/archive/architecture/ARCHITECTURE_REVIEW.md`           | 历史快照，不是当前架构事实来源；当前结构以 `docs/architecture/overview.md` 和 `architecture-rules.cjs` 为准。 |
| Logging 约定                 | `sites/<site-key>/content/docs/logging-conventions.zh.mdx`   | 结构化日志字段/规范等。                                                                                       |
| PR Checklist                 | `sites/<site-key>/content/docs/code-review-checklist.zh.mdx` | 面向 PR 的快速清单。                                                                                          |
| 认证                         | `docs/guides/auth.md`                                        | Better Auth 使用方式与边界。                                                                                  |
| RBAC                         | `docs/guides/rbac.md`                                        | 角色/权限建模与初始化脚本。                                                                                   |
| 支付                         | `docs/guides/payment.md`                                     | 支付接入、回调、幂等等关键路径。                                                                              |
| 数据库                       | `docs/guides/database.md`                                    | Drizzle schema 与迁移流程。                                                                                   |

## 模式样本索引（按主题找入口）

### SEO / Metadata（Next.js App Router）

- 元数据 helper：`src/surfaces/public/seo/metadata.ts`
- 使用 helper 的页面示例：`src/app/[locale]/(landing)/blog/page.tsx`、`src/app/[locale]/(landing)/pricing/page.tsx`
- 手写 `generateMetadata` 的页面示例：`src/app/[locale]/(auth)/sign-in/page.tsx`、`src/app/[locale]/(auth)/sign-up/page.tsx`

### 数据来源与缓存注释（App Router）

当页面/布局的“数据来源、鉴权依赖、缓存语义”不直观时，在文件顶部补齐三行注释，避免后续误用 App Router 的默认缓存行为（尤其是 `fetch()` 的默认强缓存与 request-bound 动态渲染的差异）。

适用文件：

- `src/app/**/page.tsx`
- `src/app/**/layout.tsx`

模板（只写事实，不写愿景）：

```ts
// data: <本文件依赖的数据来源（db/configs/session/i18n/...）>
// cache: <no-store | revalidate N | unstable_cache(tag=..., revalidate=...) | default>
// reason: <为什么这样做（auth required / public page / avoid stale / layout shared ...）>
```

常见口径（示例）：

```ts
// data: signed-in user (better-auth) + RBAC + db
// cache: no-store (request-bound auth)
// reason: user-specific content; do not cache across users
```

```ts
// data: public configs (unstable_cache tag=public-configs, revalidate=3600s) + i18n
// cache: cached configs + default RSC
// reason: public pages; keep db reads cheap while allowing toggles
```

### Route Handlers（`src/app/**/route.ts`）

约定：入口只做入站适配（鉴权/校验/调用 domain application/返回响应），避免引入 UI 依赖图或业务规则；具体护栏见 `eslint.config.mjs`、`architecture-rules.cjs` 与 `docs/architecture/shared-layering.md`。

- 支付 checkout：`src/app/api/payment/checkout/route.ts`
- 支付回调/通知：`src/app/api/payment/notify/route.ts`

### 错误处理（API / Server Actions）

- 公共错误类型：`src/shared/lib/errors.ts`（`BusinessError` / `ExternalError`）
- API：`src/shared/lib/api/errors.ts`、`src/shared/lib/api/route.ts`（`ApiError` / `withApi()`）
- Server Actions：`src/shared/lib/action/errors.ts`、`src/shared/lib/action/with-action.ts`（`ActionError` / `withAction()`）
- API 约定文档：`docs/api/reference.md`

### 支付集成（domains/billing + infra/adapters/payment）

- Canonical 类型入口：`src/domains/billing/domain/payment.ts`
- Pricing / credits 语义：`src/domains/billing/domain/pricing.ts`、`src/domains/billing/domain/credit.ts`
- Checkout / notify / replay / subscription 流程：`src/domains/billing/application/**`
- Provider transport / façade：`src/infra/adapters/payment/**`

### Email / Storage 集成（extensions）

- Email：统一接口与类型 `src/extensions/email/index.ts`；Providers server-only 入口 `src/extensions/email/providers.ts`
- Storage：统一接口与类型 `src/extensions/storage/index.ts`；server-only runtime 入口 `src/infra/adapters/storage/service.ts`

### 数据库与迁移（Drizzle）

- Schema：`src/config/db/schema.ts`
- 迁移：`src/config/db/migrations/**`

### 当前架构分层（边界与示例入口）

以 `architecture-rules.cjs` 和 `docs/architecture/shared-layering.md` 为准；当不确定放哪层时，先对照机器可读 manifest，再看文档解释。

- 纯工具/一致性逻辑：`src/shared/lib/**`（示例：`src/shared/lib/api/parse.ts`、`src/shared/lib/date/format.ts`）
- 叶子常量层：`src/shared/constants/**`（示例：`src/shared/constants/rbac-permissions.ts`）
- 业务语义和用例：`src/domains/**`
- 后台聚合面：`src/surfaces/admin/**`
- Public composition helper：`src/surfaces/public/**`
- 外部实现适配：`src/infra/adapters/**`
- 平台能力：`src/infra/platform/**`
- Docs/blog content query/view：`src/domains/content/application/**`
- Cross-surface content assets（server-only）：`src/shared/content/**`
- UI 共享层：`src/shared/blocks/**`、`src/shared/components/**`、`src/shared/contexts/**`、`src/shared/hooks/**`

### 架构反退化规则速查

- 新 domain 必须有独立不变量、独立数据边界或生命周期；不能只是 UI、聚合层或 transport 入口。
- `shared/lib` 只允许无业务语义副作用的纯工具和 transport helper；业务能力不能放回 shared。
- `settings` 只拥有字段和值。业务规则、不变量、可复用策略必须进入本域 `domain/` 函数，且 domain 函数不接收原始 settings object。
- `application` 负责流程、fallback、degrade 和外部依赖缺失处理；不能变成“合法 shared/services 2.0”。
- 普通 `application` 文件默认最多依赖两个外域 application 只读入口，跨域 import 只能指向 `*.query.ts` / `*.view.ts`。
- 高 fan-out 读聚合进入 `application/aggregation/*.aggregation.ts`，必须写 `architecture-exception: cross-domain-aggregation` 和 `reason: ...`。
- 高 fan-out 写编排进入 `application/orchestration/*.orchestration.ts`，必须写 `architecture-exception: cross-domain-orchestration`、`reason: ...`、`owner: ...`、`failure-compensation: ...`。
- `query/view` 只能 fetch/map/project，不做业务决策，不导入外域 application、settings-store 或 infra adapters。
- `domains/*/application/**` 默认只能使用 `infra/platform/logging/**` 和 `infra/platform/request-context/**`；manifest 中的例外必须保持有限且有理由。
- Server log 标准 meta 字段：`requestId`、`domain`、`useCase`、`operation`、`route`、`method`、`actorUserId`。
- 自动测试负责结构边界；code review 负责判断 fan-out 依赖、settings 解释、orchestration 例外是否语义合理。

### Client 组件可下沉判定（`use client` 审计）

- 仅在组件本身存在交互责任时保留 `use client`：事件处理（`onClick/onChange`）、浏览器 API（`window/document/localStorage`）、状态/副作用 hooks（`useState/useEffect/useRef`）或必须运行在客户端的第三方库。
- 优先把展示壳层下沉为 Server Component：如果组件仅做数据拼装、文案渲染、条件分支与静态结构输出，应移除 `use client`，把交互点收敛到叶子 Client 子组件。
- 若组件同时含展示与交互，先拆分为“Server 外壳 + 小型 Client 子组件”；Client 子组件只接收最小化 props（字符串、布尔、枚举、轻量对象），避免把整页数据都拖入客户端。
- 审计结论需附带依赖检查：标注是否依赖 client-only 库（图表、动画、Radix 交互原语、DOM listener 等），以及是否可替换为 server-safe 渲染路径。
- 每次批量下沉建议 2–5 个低风险组件：逐个验证渲染不变、关键交互路径不回归，并记录关键路由的客户端 JS 体积变化，防止“回弹式”重新 client 化。

## 更新触发条件（保持索引不过期）

以下变更应同步更新本文件（只需新增/调整索引入口，不要复制整段规则）：

- 可选脚本：先运行 `pnpm conventions:draft` 生成 `.codex/drafts/CONVENTIONS.generated.md` 作为对照草案；提交前可运行 `pnpm conventions:check` 校验文档内引用路径有效性。
- 新增一个“跨模块可复用”的模式（例如：新的一套错误结构、日志字段、SEO 组装方式）。
- 调整依赖边界、Server/Client 划分、或新增 lint 护栏。
- 引入新的关键域（auth/billing/db/payment 等）或替换集成方案。
- 新增/更改关键脚本与工作流入口（`scripts/`、`package.json scripts`）。

# 构建与网络（字体）

为保证 `pnpm build` 可在受限网络环境下可重复执行，本仓库不使用 `next/font/google`（其会在构建期拉取 Google Fonts）。字体回退由 `src/config/style/theme.css` 的 `--font-*` 变量与系统字体栈提供。

如确实需要固定字体且避免构建期外网依赖，建议引入可 vendoring 的字体方案（例如 `@fontsource/*` 或自托管字体文件）并在 CSS 中引用。
