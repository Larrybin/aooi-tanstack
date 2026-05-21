# 模块契约实现计划

更新时间：2026-04-09  
来源：`docs/architecture/minimal-mainline-ceo-review-2026-04-09.md`  
目标：把“最小主线 + 可选模块”从产品判断落实为代码、文档、后台表达的一套单一事实源。

## 1. 实现目标

这一轮不新增模块。

这一轮只做三件事：

1. 定义唯一的模块契约。
2. 让 README、Docs、Admin Settings 都读取同一套模块语义。
3. 为每个模块补齐验证状态和启用清单。

最终结果应该让新用户在 30 分钟内回答这几个问题：

- 哪些能力属于默认主线，直接可以卖。
- 哪些能力是按需开启的可选模块。
- 哪些能力只是实验性或未充分验证。
- 开启某个模块前需要配什么、测什么、承担什么风险。

## 2. 非目标

- 不新增 provider。
- 不扩 AI 页面家族。
- 不引入兼容层，不保留“旧文案 + 新文案”双轨。
- 不单独为文档做一套静态表，再为后台做另一套配置表。

## 3. 单一事实源

### 3.1 新增模块注册表

新增一个唯一事实源文件，建议：

`src/config/product-modules/index.ts`

这个文件负责声明：

- 模块 id
- 展示名
- 分类：`mainline` / `optional` / `experimental`
- 验证状态：`verified` / `partial` / `unverified`
- 依赖的 setting keys
- 依赖的外部服务
- 关键入口路由
- 对应启用清单文档 slug

这个注册表不是“再包装 settings”。
它是产品层语义。settings 只是它的一个依赖面。

### 3.2 类型定义

建议同目录下新增：

- `src/config/product-modules/types.ts`

定义最小必要类型：

- `ProductModule`
- `ProductModuleTier`
- `ProductModuleVerification`

不要做 class，不要做 registry manager，不要做 builder。
一个静态对象数组就够了。

## 4. 初始模块划分

首版先覆盖这些模块，不追求一步到位覆盖所有 provider 细节：

### 主线模块

1. `core_shell`
   - landing + brand + locale shell
2. `auth`
   - email/password 为主线
   - OAuth 在模块说明里标记为 `partial`
3. `billing`
   - pricing + checkout + webhook + credits/subscription
4. `admin_settings`
   - 配置入口和 feature toggle 面
5. `deploy_contract`
   - Vercel / Cloudflare 单源部署契约与 smoke/spike

### 可选模块

1. `docs`
2. `blog`
3. `ai`
4. `storage`
5. `analytics`
6. `affiliate`
7. `customer_service`
8. `ads`

### 实验性模块

首版尽量不单独造“实验性模块”数量。
只有在确实存在代码入口但没有稳定启用路径时才标 `experimental`。
默认先把不确定项放到 `optional + unverified`，避免分类膨胀。

## 5. 目标文件改动

### 5.1 新增

- `src/config/product-modules/types.ts`
- `src/config/product-modules/index.ts`
- `docs/guides/module-contract.md`
- `docs/guides/modules/auth.md`
- `docs/guides/modules/billing.md`
- `docs/guides/modules/ai.md`
- `docs/guides/modules/storage.md`
- `docs/guides/modules/docs-blog.md`
- `docs/guides/modules/growth-support.md`

说明：

- 启用清单文档按“用户会一起决策”的颗粒度分组，不按 provider 细碎拆页。
- 第一版不需要给每个 provider 单独一页。

### 5.2 修改

- `README.md`
  - 把“很多模块”式表述改成“主线 + 可选模块”矩阵入口。
- `development.md`
  - 同步模块契约和验证命令，不再只按技术子系统展开。
- `docs/guides/settings.md`
  - 解释 admin settings 是模块开关与集成配置入口，不再只是 tab 列表，也不是模块真相源。
- `src/shared/services/settings/tabs.ts`
  - 允许显示模块层级提示或 badge 文案。
- `src/app/[locale]/(admin)/admin/settings/[tab]/page.tsx`
  - 在页面头部展示当前 tab 对应模块的 tier / verification / checklist 链接。
- `src/shared/services/settings/definitions/general.ts`
  - 收敛与模块开关有关的文案，例如 AI/Blog/Docs 的说明。
- `src/shared/services/settings/registry.ts`
  - 只在需要公开暴露的模块开关继续保留，不额外引入映射层。

## 6. 实现顺序

### Phase 1: 打底，先建立模块注册表

目标：

- 引入 `src/config/product-modules` 目录和静态注册表。
- 明确每个模块的 tier、verification、setting keys、入口路由。

验收：

- 代码里存在唯一模块列表。
- 不再靠 README 自由文本描述模块边界。

### Phase 2: 文档收敛到同一套模块语义

目标：

- 新增 `docs/guides/module-contract.md` 作为总入口。
- README 链接到这份文档。
- `development.md` 和 `settings.md` 与注册表术语保持一致。

验收：

- 用户从 README 能直接跳到模块矩阵。
- 文档中不再出现和注册表冲突的模块命名。

### Phase 3: 后台表达对齐

目标：

- Admin Settings 每个 tab 都能看到当前模块的定位和验证状态。
- 可选模块有明确“开启前请先完成什么”的链接。

验收：

- 进入 `/admin/settings/<tab>` 时，不需要猜这个 tab 属于哪类模块。
- AI / Docs / Blog 这类开关能被解释为模块级开关，而不是散落的 boolean。

### Phase 4: 启用清单落地

目标：

- 为主线和高频可选模块补清单。

每份清单必须包含：

- 模块作用
- 必需配置项
- 依赖外部服务
- 最小验证命令
- 常见失败模式
- 不启用时的产品影响

验收：

- 新用户启用一个模块时，不需要跨 README、settings、脚本到处拼答案。

## 7. 后台映射策略

不要为“tab -> 模块”再造一套复杂映射系统。

直接在模块注册表里声明：

- `settingsTabs: ['auth']`
- `settingsTabs: ['payment']`
- `settingsTabs: ['analytics']`

然后在后台读取这个注册表做展示。

原则：

- 产品模块和 settings tab 是两层结构。
- 优先使用 `ownedTabs` / `supportingTabs` 这种显式映射。
- 多 provider 仍然留在该模块内部，不上升为新的产品模块。

## 8. 验证状态策略

验证状态必须基于仓库现有证据，不凭感觉写。

建议首版规则：

- `verified`
  - 存在明确命令级验证，且 README / development.md 已记录
- `partial`
  - 有部分 smoke/spike/测试，但关键链路仍在 follow-up 或只覆盖子路径
- `unverified`
  - 只有代码和配置入口，没有可信验证说明

首批直接可引用的验证命令：

- `pnpm test:auth-spike`
- `pnpm test:cf-oauth-spike`
- `pnpm test:cf-app-smoke`
- `pnpm test:cf-local-smoke`
- `pnpm test:creem-webhook-spike`
- `pnpm test:r2-upload-spike`

## 9. 迁移策略

这次不做兼容迁移。

直接策略：

1. 先建立新模块注册表。
2. README / docs / admin settings 直接改读新语义。
3. 发现旧文案冲突时，直接替换，不保留“旧说法也对”的双写期。

这是文档和展示层收敛，不是高风险数据迁移。
没必要为它做过渡层。

## 10. 风险

### 风险 1：模块颗粒度失控

如果把每个 provider 都升级成模块，计划会立刻失焦。

控制方法：

- provider 是模块内部实现，不是默认产品模块。

### 风险 2：验证状态写得太乐观

如果把“有代码”写成“已验证”，这轮就白做了。

控制方法：

- 所有 `verified` 都要附命令或现有文档证据。

### 风险 3：后台 UI 为了展示模块信息而过度重构

这件事本质是信息补充，不是后台重写。

控制方法：

- 第一版只加 page header / help text / doc link。
- page header 固定只展示 `tier`、`verification`、`Enablement guide` 三项，不扩成长段说明区。
- 不重做 settings 数据结构。

## 11. 测试与验收

这一轮至少要做：

1. 文档一致性人工检查
   - README
   - module contract guide
   - settings guide
2. 后台展示回归
   - 打开 `/admin/settings/general`
   - 打开 `/admin/settings/auth`
   - 打开 `/admin/settings/payment`
   - 打开 `/admin/settings/ai`
3. 最小自动验证
   - `pnpm lint`

如果实现里改到了实际显示逻辑，再补：

- 相关页面快照或最小渲染测试

## 12. 推荐拆分

建议拆成 3 个实现批次，不要一次把所有文档和 UI 混成一坨：

1. `模块注册表 + module-contract 总文档 + README 收敛`
2. `admin settings 模块说明接入`
3. `启用清单文档补齐`

这样每一批都能独立验收，而且不会把问题混在一起。

## 13. Compatibility Decision

- Compatibility required: no
- Thin wrappers added: none
- Aliases preserved: none
- Legacy branches preserved: none

## 14. Plan Check

- Breaking changes accepted: yes
- Transitional layers planned: none
- Old paths scheduled for deletion: yes
- Direct caller updates planned: yes
