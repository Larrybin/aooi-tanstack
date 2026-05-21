# 历史架构审查报告（roller-rabbit，对外版）

> Historical report: this document is a point-in-time architecture audit
> snapshot, not the current architecture baseline. For current repository
> structure, dependency direction, and module ownership, use
> `docs/architecture/overview.md` together with `architecture-rules.cjs`.
> Legacy paths or layer names mentioned below, such as `src/core`,
> `src/shared/models`, and `src/shared/services`, are historical context only.

更新时间：2025-12-20  
审查基线：本报告生成时的仓库代码（静态审阅）  
范围：本仓库整体（Next.js App Router + TypeScript），侧重模块边界、依赖方向、关键运行时链路（Auth/DB/支付/中间件）  
方法：静态阅读代码与配置、抽样追踪关键请求链路；不包含性能压测/渗透测试/生产环境端到端验证  
严重度定义：P0=高优先级（高影响/高概率）、P1=中优先级（需规划）、P2=建议项（持续优化）

---

## 0) 执行摘要

- **分层清晰且可落地**：`src/app`（交付/路由）→ `src/shared`（业务编排与复用）→ `src/core`（基础能力）→ `src/extensions`（三方集成适配）→ `src/config`（配置/Schema/Migrations）。
- **治理能力突出**：通过 `eslint.config.mjs` 对 client/server 边界与依赖方向做了硬约束，并与 `docs/architecture/shared-layering.md` 的分层约定保持一致。
- **关键链路实现质量较高（抽样）**：`src/middleware.ts` 注入 `x-request-id` 贯穿链路；支付 checkout/webhook 具备输入校验与幂等短路；Auth 采用静态/动态配置分离以规避 build-time DB 访问。
- **需优先处理的两项风险（P0，其中 P0-1 已修复，P0-2 已收敛）**：
  - （已修复）dotenv 加载逻辑曾以 side-effect 方式进入运行时依赖图：已从 Next runtime 主链路移除，并收敛到 scripts/CLI 入口（统一使用 `@next/env` 的 `loadEnvConfig()`），降低环境漂移与运维困惑。
  - （已收敛）对外暴露 `DATABASE_PROVIDER`，但 schema 与运行时实现为 Postgres-only：已通过运行时/CLI 校验限制为 `postgresql` 且固定 drizzle-kit dialect，避免误用与“配置/实现不一致”。

总体评估：架构边界清晰、治理手段成熟；优先级最高的改进点是“配置能力与实现能力的一致性”。

---

## 1) 审查范围与方法

### 1.1 范围覆盖

- 代码结构与模块职责划分
- 依赖方向与边界治理（ESLint 规则）
- 关键运行时链路抽样（Middleware/Auth/DB/支付）
- 已暴露 TODO 的业务路径抽样（chat）

### 1.2 方法说明

- 静态阅读仓库源代码与配置文件
- 通过关键入口（`src/middleware.ts`、`src/app/api/**/route.ts`、`src/core/*`、`src/shared/*`）追踪调用链
- 以“可维护性/可部署性/边界稳定性”为主要评估维度

### 1.3 不在范围（免责声明）

- 运行时性能基准、压测与容量评估
- 安全渗透测试与合规审计
- 与外部基础设施（数据库、支付平台）的真实环境端到端联调验证

---

## 2) 项目结构与职责划分（现状）

### 2.1 交付层：`src/app/**`

- App Router 页面/布局：`src/app/layout.tsx`、`src/app/[locale]/layout.tsx`
- Route Handlers：`src/app/api/**/route.ts`
- Admin/Settings/Activity 等路由组：`src/app/[locale]/(admin|landing|auth|chat|docs)/**`

### 2.2 基础能力层：`src/core/**`

- 认证：`src/core/auth/*`（Better Auth 统一入口 `getAuth()`）
- 数据库：`src/core/db/index.ts`（db() 封装：Workers/Hyperdrive/Serverless/Singleton）
- 国际化：`src/core/i18n/*`（next-intl routing + requestConfig）
- Docs：`src/core/docs/source.ts`（fumadocs source loader）
- Theme：`src/core/theme/index.ts`（主题动态加载 + fallback）

### 2.3 集成适配层：`src/extensions/**`

以 provider/manager 模式组织三方集成能力（广告/统计/支付/邮件/存储/客服/AI）。

### 2.4 配置与数据源：`src/config/**`

- 数据库 schema 与迁移：`src/config/db/schema.ts`、`src/config/db/migrations/**`
- locale messages：`src/config/locale/messages/**`
- 环境配置：
  - public：`src/config/index.ts`（`NEXT_PUBLIC_*`）
  - server-only：`src/config/server.ts`

### 2.5 业务编排与复用层：`src/shared/**`

- `shared/models/**`：DAL/Repo（server-only，承载 DB 读写与形态转换）
- `shared/services/**`：服务装配（config-driven wiring，拼装 `extensions/*`）
- `shared/lib/**`：跨层工具（API parsing、logging、request context 等）
- `shared/blocks|components|contexts|hooks`：UI/交互（受 ESLint client surface 约束）

---

## 3) 架构边界与依赖方向（治理能力）

### 3.1 ESLint 边界约束（单一事实来源）

`eslint.config.mjs` 明确了：

- Client 模块禁止导入：`server-only`、`next/headers`、`@/core/db/**`、`@/shared/services/**`、`@/shared/content/**`、`*.server` 等。
- `shared/models` 禁止反向依赖 UI/Next 入口（避免 DAL 与交付层纠缠）。
- `shared/constants` 必须保持叶子层（禁止依赖 services/models/core）。
- `src/app/**/route.ts` 禁止依赖 UI 层（blocks/components/contexts/themes）。

该治理策略与 `docs/architecture/shared-layering.md` 一致，属于本仓库长期可维护性的“架构护栏”。

### 3.2 API 入口一致性（Route Handler 封装）

`src/shared/lib/api/route.ts` 提供 `withApi()`：

- 统一异常映射（`ApiError` → `{code,message,data}` + HTTP status）
- 统一兜底日志
- 自动回写 `x-request-id`（与 `src/middleware.ts` 注入链路闭环）

---

## 4) 关键运行时链路（抽样审阅）

### 4.1 中间件与路由闸门

- `src/middleware.ts`：为所有请求注入 `x-request-id`；`/api` 仅注入 header，其余走 `proxy()`。
- `src/request-proxy.ts`：先走 next-intl middleware；对 `/admin|/settings|/activity` 做“轻量 session cookie 存在性检查”；并对“默认语言无前缀访问”的路径做 internal rewrite（`/pricing` → `/en/pricing`，URL 不变）（刻意避免命名为 `src/proxy.ts`，以免触发 Next.js 16 的保留文件约定并绕过 middleware 的 `matcher`）。

结论：路由层采用“轻闸门 + 页面/API 端强校验”的分层是合理的；proxy 的鉴权保持最小化（当前实现符合该原则）。

### 4.2 Auth：Better Auth（静态配置 + 动态数据库装配）

- 静态配置：`src/core/auth/config.ts` 的 `authOptions`（避免 build-time DB 调用）
- 动态配置：`getAuthOptions()` 在运行时根据 DB configs 组装 adapter/providers/plugins
- API 接入：`src/app/api/auth/[...all]/route.ts` 调 `getAuth()`，再 `toNextJsHandler`

结论：静态/动态配置分离降低 build-time DB 访问风险，有利于 RSC 与构建稳定性。

### 4.3 DB：多运行环境封装

`src/core/db/index.ts` 支持：

- Cloudflare Workers：通过 `cloudflare:workers` 获取 `HYPERDRIVE.connectionString`
- 非 Workers：支持 singleton / serverless（以 `DB_SINGLETON_ENABLED` 控制）

结论：适配策略清晰，但对外能力宣称与实现的一致性仍需进一步明确（见 P0-2）。

### 4.4 支付：checkout + webhook notify

- Checkout：`src/app/api/payment/checkout/route.ts`
  - 使用 zod schema 校验请求体（`PaymentCheckoutBodySchema`）
  - 金额由 `sites/<site-key>/pricing.json` 生成到 `@/site.sitePricing` 后在服务端计算（不信任客户端传入金额）
  - active provider 由 `site.capabilities.payment` 派生，checkout 不再接受 provider 选择输入
- Webhook notify：`src/app/api/payment/notify/route.ts`
  - provider event 获取异常分类映射为 401/400/配置错误
  - 对订单状态做幂等短路（已终态直接返回 success）

结论：支付链路具备输入校验、错误分类与幂等短路，可作为同类集成的参考实现。

---

## 5) 风险与改进建议（按优先级）

### P0-1（已修复）：dotenv 加载逻辑曾以 side-effect 方式进入运行时依赖图

修复要点：

- 已从 Next runtime 主链路移除 side-effect 引入：
  - `src/core/db/index.ts`
  - `src/shared/models/config.ts`
- scripts/CLI 入口显式引入 `import '@/config/load-dotenv'`，并统一使用 `@next/env` 的 `loadEnvConfig()` 按 Next 规则加载 `.env*`。
- drizzle-kit 配置 `src/core/db/config.ts` 同样使用 `loadEnvConfig()`，避免自建 dotenv loader。
- ESLint 增加防回归：运行时代码禁止导入 `@/config/load-dotenv`，仅在 `scripts/**` 放行。

注意：

- scripts/CLI 在生产环境运行时应以真实环境变量（CI/CD secrets/vars）为准，不建议依赖本地 `.env*` 文件。

### P0-2（已收敛）：数据库方言对外可配置，但运行时实现为 Postgres-only

证据：

- schema 使用 `drizzle-orm/pg-core`（Postgres 专用）。
- DB runtime 使用 `drizzle-orm/postgres-js` + `postgres`。
- 同时对外暴露 `DATABASE_PROVIDER`（`src/config/server.ts`），但运行时与 drizzle-kit 均通过 `assertPostgresOnlyDatabaseProvider()` 强制仅允许 `postgresql`（`src/core/db/postgres-only.ts` / `src/core/db/config.ts` / `src/config/server.ts`），且 drizzle-kit config 固定 `dialect: 'postgresql'`。

风险：

- 主要风险已由 fail-fast 规避：错误配置会在启动/脚本阶段直接抛错并给出明确提示。
- 残留风险为“配置项语义误导”（误以为支持多方言），但不再是静默的不一致风险。

建议：

- 短期：保持“Postgres-only”的对外契约明确（`.env.example` 已固定 `DATABASE_PROVIDER=postgresql`，可在 README 补一句说明）。
- 中期：如确需多方言，需抽象 `db()` 按 provider 选择 driver + schema 分支（成本较高，需设计评审）。

### P1-1：`src/shared` 体量与职责增长风险

现状：

- `shared` 同时承载 DAL（models）、服务装配（services）与大量 UI/交互（blocks/components/contexts/hooks）。
- 已有 ESLint 护栏，但随着业务扩展，导航成本与跨域耦合仍可能上升。

建议：

- 中期引入 `src/features/*` 以领域拆分（billing/chat/admin 等），将“业务域代码”从 `shared` 中剥离，`shared` 保留真正跨域的 primitives。

### P1-2：部分业务链路存在未完工/数据一致性隐患

证据：

- `src/app/api/chat/new/route.ts` 仍存在多个 TODO（credits/provider/title 策略等），但 `parts` 已按结构写入并 `JSON.stringify()` 存储。

风险：

- chat 数据形态难以演进（历史数据与新结构不一致），后续迁移成本增加。

建议：

- 明确 chat message/parts 的单一事实源与存储格式，补齐 TODO（provider/credits/title 生成策略）。

### P1-3（已修复）：数据库迁移文件的版本控制/分发约定需明确

修复要点：

- `.gitignore` 已移除对 `src/config/db/migrations/**` 的忽略；保留全局 `*.sql` 忽略，但对 `src/config/db/migrations/**/*.sql` 反向放行，确保迁移作为交付物进入版本控制，降低 schema 漂移风险。

### P2：安全与运维建议项

- （已修复）`next.config.mjs` 不再允许任意 hostname 的 `images.remotePatterns`；当前通过 `images.unoptimized: true` 禁用 `/_next/image` 出站面（如需恢复优化需补齐严格 allowlist）。
- （已修复）`reactStrictMode: true`：已启用 Strict Mode（开发态），用于提前暴露副作用与不安全用法。

---

## 6) 行动清单（可分批落地）

### 一周内（P0）

1. 已完成：修正 dotenv 加载策略，确保 Next runtime 不读 `.env*` 文件（仅 scripts/CLI 生效）。
2. 已完成：收敛 DB 支持范围为 Postgres-only（运行时/CLI fail-fast 校验 + drizzle-kit 固定 dialect）；可选补充 README 对 `DATABASE_PROVIDER=postgresql` 的说明以减少误解。

### 两周内（P1）

1. 补齐 chat new 的数据结构与 TODO，避免产生难以迁移的历史数据。
2. 针对 RBAC 权限通配符匹配等纯逻辑模块补充少量单测（如果仓库已具备测试约定/基础设施）。
3. 已完成：迁移目录纳入版本控制（`.gitignore` 放行 `src/config/db/migrations/**/*.sql`，仍保留全局 `*.sql` 忽略）。

### 持续演进（P1/P2）

1. 逐步引入 `src/features/*` 领域分包，降低 `shared` 导航与耦合成本。
2. 收敛 Next Image 外部域名白名单；持续观察 `reactStrictMode` 下的 dev-only 警告与副作用。

---

## 7) 参考文件（抽样）

- `eslint.config.mjs`
- `docs/architecture/shared-layering.md`
- `src/middleware.ts`
- `src/request-proxy.ts`
- `src/shared/lib/api/route.ts`
- `.gitignore`
- `src/config/db/schema.ts`
- `src/app/api/chat/new/route.ts`
- `src/config/load-dotenv.ts`
- `src/core/db/index.ts`
- `src/core/auth/config.ts`
- `src/app/api/payment/checkout/route.ts`
- `src/app/api/payment/notify/route.ts`
