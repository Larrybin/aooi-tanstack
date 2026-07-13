# 测试断言分层策略

这份文档用于统一 `aooi` 的测试断言口径。

目标不是把所有测试都改成“行为断言”，而是把每类测试收敛到最合适的断言层级：

- 对外边界默认使用行为断言。
- 对稳定约束保留契约断言。
- 对流程策略保留最小必要的编排断言。
- 对仓库边界保留结构守卫，但禁止把结构断言误用到用户价值场景。

## 四类断言

### 1. 行为断言

行为断言回答的是：

- 给定输入，调用方能看到什么结果。
- 用户执行动作后，界面/API/Worker 表现是什么。
- 外部可观察语义是否正确。

适用场景：

- 路由处理器
- 页面渲染
- 表单提交
- 纯函数输入输出
- 浏览器 smoke

优先断言：

- HTTP status、headers、body
- 返回值结构和错误语义
- 页面中可见内容、重定向目标、可操作状态

避免断言：

- 内部调用了哪个 helper
- 中间变量值
- 无业务语义的调用次数或调用顺序

仓库示例：

- [tests/contract/payment-notify-route.test.ts](/Users/bin/Desktop/project/aooi/tests/contract/payment-notify-route.test.ts)
- `src/server/api/storage/upload-image-route.server.test.ts`
- [src/middleware.test.ts](/Users/bin/Desktop/project/aooi/src/middleware.test.ts)
- [tests/smoke/cf-app-smoke.test.ts](/Users/bin/Desktop/project/aooi/tests/smoke/cf-app-smoke.test.ts)

### 2. 契约断言

契约断言回答的是：

- 公开结构、规则表、配置矩阵、模块定义是否仍满足约定。
- “什么必须存在/必须一致” 是否成立。

这类测试不是实现细节测试。只要它验证的是稳定规则，而不是代码偶然写法，就应该保留。

适用场景：

- provider contract
- module contract
- settings/schema/config contract
- runtime parity/shared contract

仓库示例：

- [tests/contract/payment-notify.test.ts](/Users/bin/Desktop/project/aooi/tests/contract/payment-notify.test.ts)
- [src/surfaces/admin/settings/module-contract.test.ts](/Users/bin/Desktop/project/aooi/src/surfaces/admin/settings/module-contract.test.ts)
- [tests/smoke/admin-settings-module-contract.test.ts](/Users/bin/Desktop/project/aooi/tests/smoke/admin-settings-module-contract.test.ts)
- [tests/smoke/cloudflare-multi-worker-contract.test.ts](/Users/bin/Desktop/project/aooi/tests/smoke/cloudflare-multi-worker-contract.test.ts)

### 3. 编排断言

编排断言回答的是：

- 流程是否按策略执行。
- 失败、重试、清理、收尾是否符合约定。

只有当“顺序/次数/清理动作”本身就是业务策略时，才允许断言这些内容。

适用场景：

- topology 启停
- preview ready 等待
- retry/backoff
- 执行后清理

仓库示例：

- [tests/smoke/run-cf-local-smoke.test.ts](/Users/bin/Desktop/project/aooi/tests/smoke/run-cf-local-smoke.test.ts)
- [src/shared/hooks/use-self-user-details.test.ts](/Users/bin/Desktop/project/aooi/src/shared/hooks/use-self-user-details.test.ts)
- [tests/smoke/local-auth-spike.test.ts](/Users/bin/Desktop/project/aooi/tests/smoke/local-auth-spike.test.ts)

要求：

- 只断言最小必要步骤。
- 不为了“覆盖实现”去检查无语义的中间顺序。
- 如果可以用更高层结果表达，就不要回退到步骤列表。

### 4. 结构断言

结构断言回答的是：

- 仓库边界、导入边界、文件位置、模板结构是否被破坏。

这类测试适合守住架构约束，但不应该承担用户行为验证。

适用场景：

- import boundary
- app boundary
- 文件存在性/目录位置
- 配置模板禁提交项

仓库示例：

- [src/shared/contexts/app-boundaries.test.ts](/Users/bin/Desktop/project/aooi/src/shared/contexts/app-boundaries.test.ts)
- [src/infra/platform/theme-import-contract.test.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/theme-import-contract.test.ts)
- [src/domains/account/ui/auth/auth-refresh-boundaries.test.ts](/Users/bin/Desktop/project/aooi/src/domains/account/ui/auth/auth-refresh-boundaries.test.ts)
- `src/architecture-boundaries.test.ts`

要求：

- 只验证仓库约束本身。
- 不要拿字符串搜索替代本该有的行为测试。
- 如果同一价值可以通过行为或契约测试表达，优先删掉多余结构断言。

## 仓库默认规则

### 默认优先级

1. 对外边界先写行为断言。
2. 无法仅靠行为表达的稳定规则，再写契约断言。
3. 顺序、次数、清理只有在它们本身是策略时，才写编排断言。
4. 结构断言只守架构，不守产品行为。

### Mock 规则

- 默认只 mock 边界依赖，例如网络、存储、第三方 provider、时钟、随机值。
- 不 mock 当前模块内部 helper，只为了验证“它被调过”。
- 不新增薄适配层来让测试更容易写。

### 失败信息要求

- 行为断言必须体现业务语义，不能只断言 `200` 或 “不报错”。
- 契约断言必须指出哪条规则漂移。
- 编排断言必须指出缺失的步骤或未执行的清理。
- 结构断言必须指出被破坏的边界或禁止项。

## 当前仓库映射

下面这份映射用于快速判断一个测试应该往哪个方向收敛。

### 默认归为行为断言

- `apps/web/src/routes/**/*.test.ts` and `src/server/api/**/*.test.ts`
- `src/themes/default/**/*.test.ts*`
- `src/domains/settings/**/*mapper*.test.ts`
- `tests/smoke/*.browser.ts`
- 直接验证请求/响应、渲染结果、提交结果的测试

### 默认归为契约断言

- `tests/contract/**`
- `**/*contract.test.ts`
- `src/config/product-modules/**/*.test.ts`
- `src/shared/config/**/*.test.ts`
- 验证规则表、模块矩阵、公开结构稳定性的测试

### 默认归为编排断言

- `tests/smoke/run-*.test.ts`
- `**/*topology*.test.ts`
- `**/*self-user-details*.test.ts`
- 验证重试、清理、启动/停止顺序的测试

### 默认归为结构断言

- `**/*boundaries.test.ts`
- `**/*import-contract.test.ts`
- `src/architecture-boundaries.test.ts`
- 直接读取源码/配置文件并做禁止项守卫的测试

## 直接迁移名单

下面这些文件适合优先改成更纯粹的行为断言，不需要先做大规模基础设施改造。

### P1：直接改写

#### [src/themes/default/pages/landing.test.tsx](/Users/bin/Desktop/project/aooi/src/themes/default/pages/landing.test.tsx)

现状：

- 通过字符串 `indexOf` 判断广告位插入顺序。

目标：

- 改为基于 DOM 结构或节点语义断言“广告位出现在首个区块之后，只出现一次”。

原因：

- 当前写法仍然依赖静态 markup 细节，重构 HTML 细节时会产生无意义失败。

#### [src/themes/default/blocks/blog-detail.test.ts](/Users/bin/Desktop/project/aooi/src/themes/default/blocks/blog-detail.test.ts)

现状：

- 通过 `includes('p4')`、`startsWith('p5')` 断言拆分位置。

目标：

- 改为断言拆分后的段落集合/段落边界，而不是字符串片段。

原因：

- 这本质上是内容拆分行为，应该直接验证“前半段包含哪些段、后半段包含哪些段”。

#### [src/domains/settings/settings-form-mapper.test.ts](/Users/bin/Desktop/project/aooi/src/domains/settings/settings-form-mapper.test.ts)

现状：

- 同时断言映射结果和 `handler` 引用身份。

目标：

- 保留“当前 tab 只映射相关字段”的行为断言。
- 去掉无必要的函数引用身份断言。
- 如果要验证提交流程，直接调用返回的 submit handler，断言提交语义。

原因：

- `handler === submitHandler` 属于实现绑定细节，不是外部价值。

### P2：需要先抽象可观察边界，再迁移

#### [src/domains/account/ui/auth/auth-refresh-boundaries.test.ts](/Users/bin/Desktop/project/aooi/src/domains/account/ui/auth/auth-refresh-boundaries.test.ts)

现状：

- 通过源码字符串搜索 `router.refresh(` 维持刷新策略。

建议：

- 先把“登录/登出后需要 refresh”抽成可调用边界，再改成行为断言。
- 在未抽边界前，这个测试继续作为结构守卫存在。

#### [src/shared/contexts/app-boundaries.test.ts](/Users/bin/Desktop/project/aooi/src/shared/contexts/app-boundaries.test.ts)

现状：

- 大量架构守卫依赖读源码和文件存在性。

建议：

- 其中守“导入边界/禁止依赖”的部分继续保留为结构断言。
- 其中能被公共 layout 或 provider 行为覆盖的项，逐步迁到行为测试后再删除重复结构守卫。

## 不应误改成行为断言的测试

以下文件即使包含字符串匹配或源码读取，也不应该因为“不是用户视角”而被简单删除：

- [tests/smoke/admin-settings-module-contract.test.ts](/Users/bin/Desktop/project/aooi/tests/smoke/admin-settings-module-contract.test.ts)
- [tests/smoke/cloudflare-multi-worker-contract.test.ts](/Users/bin/Desktop/project/aooi/tests/smoke/cloudflare-multi-worker-contract.test.ts)
- [src/infra/platform/theme-import-contract.test.ts](/Users/bin/Desktop/project/aooi/src/infra/platform/theme-import-contract.test.ts)
- [src/surfaces/admin/settings/module-contract.test.ts](/Users/bin/Desktop/project/aooi/src/surfaces/admin/settings/module-contract.test.ts)

原因：

- 它们守的是模块边界、部署契约、配置模板、结构矩阵。
- 这些内容本来就不是用户点击页面能完整覆盖的。
- 如果强行改成高层行为测试，只会让测试更慢、更贵、更难定位。

## 迁移顺序

1. 先清理“伪行为断言”。
2. 再保留真正的契约/编排/结构守卫。
3. 最后只在确有重复价值时删除结构测试。

具体执行顺序：

1. 先改 `landing.test.tsx`、`blog-detail.test.ts`、`settings-form-mapper.test.ts`。
2. 再评估是否需要给 auth refresh 抽独立边界。
3. 最后检查结构测试和行为测试是否对同一价值重复覆盖。

## 评审口径

以后 review 测试时，按下面的问题判断：

1. 这个测试验证的是用户/调用方结果，还是实现过程？
2. 如果改了实现但不改语义，这个测试是否应该继续通过？
3. 这里断言的顺序/次数，是否本身就是策略？
4. 这条规则是否必须通过结构守卫存在，还是能被更高层测试替代？

只要第 2 个问题答案是“应该继续通过”，就优先往行为断言收敛。

## Compatibility Decision

- Compatibility required: no.
- Callers updated directly: not applicable in this document.
- Old paths scheduled for deletion: yes, for low-value pseudo-behavior assertions during future cleanup.

## Refactor Check

- Thin wrappers added: none.
- Aliases preserved: none.
- Legacy branches preserved: none.

## Plan Check

- Breaking changes accepted: yes.
- Transitional layers planned: none.
- Old paths scheduled for deletion: yes.
- Direct caller updates planned: yes.
