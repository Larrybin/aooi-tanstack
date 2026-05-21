# CEO Review: 最小主线 + 可选模块

更新时间：2026-04-09  
模式：`SELECTIVE EXPANSION`  
评审目标：从产品层确认，这套“最小主线 + 可选模块”是否值得再扩一轮，以及应该扩什么，不该扩什么。

## 结论

值得再扩一轮，但只能做**产品化扩张**，不该继续做**模块广度扩张**。

现在仓库里已经有足够多的能力面：

- 主线能力已经覆盖 landing、auth、billing、settings、docs、deploy contract。
- 可选能力已经覆盖 AI、blog/docs 开关、analytics、affiliate、customer service、storage、多个 payment provider。

问题已经不是“东西不够多”，而是“用户看不清什么是默认可卖主线，什么是可启用模块，什么能力已经被验证到什么程度”。

再加模块，会让模板更像零件堆。
把模块体系产品化，才会让它像一个可以买、敢改、敢上线的 SaaS starter。

## 当前主线

我把当前最小主线定义为：

1. 一个可部署的单源 SaaS 壳。
2. 一条可闭环的账号体系，至少含 email/password，且 Cloudflare 侧 OAuth 正在被单独治理验证。
3. 一条可闭环的商业化路径，至少含 pricing、checkout、webhook、credits 或 subscription。
4. 一个能让操作者自己开关能力的 admin/settings 面。
5. 一套不会在部署时临时散架的运行契约，特别是 Cloudflare / Vercel 的边界、DB、auth origin、preview smoke。

这是“第一天就能上线一个可信版本”的主线，不是“第一天就拥有所有增长插件”的主线。

## 10x 检查

这套产品的 10x 版本，不是“支持更多 provider”。

而是：

> 创始人拿到仓库后，30 分钟内能判断什么能直接卖、什么能后开、什么已被验证，且不会因为多平台、多模块、多配置把自己绕进去。

如果下一轮扩张不能让这件事更真，它就不是产品升级，只是代码体积升级。

## 备选路径

### 路径 A：继续扩可选模块广度

继续增加新的 AI、analytics、affiliate、customer service、payment、storage 变体。

判断：不值得。

原因：

- 现有模块面已经足够宽。
- 用户现在更缺“选择与信任”，不是“再多 3 个 provider”。
- 每新增一个模块，文档、测试、部署、配置面都会跟着变重。

### 路径 B：冻结模块广度，产品化“主线 + 模块”体系

把哪些能力属于默认主线，哪些能力属于可选模块，哪些只是实验性能力，直接说清楚，并做成可验证的交付面。

判断：值得，这就是本轮应该选的方向。

### 路径 C：把产品重新收窄成 AI-only starter

让一切都围绕 AI 生成器和 credits 展开，弱化 docs、blog、affiliate、customer service 等泛 SaaS 能力。

判断：现在不值得。

原因：

- 当前仓库已经不是单点 AI demo，而是通用 SaaS starter。
- 强行收成 AI-only，会损失现有模板的通用价值。
- 这不是小修，是重新定义产品。

## Scope Decisions

| #   | Proposal                                                          | Effort | Decision | Reasoning                                                                      |
| --- | ----------------------------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------ |
| 1   | 定义并公开 `主线 / 可选 / 实验性` 模块分层                        | S      | ACCEPTED | 这是用户理解产品的第一层真相，成本低，收益直接。                               |
| 2   | 为每个模块补“验证等级”说明，至少标出 `已验证 / 部分验证 / 未验证` | M      | ACCEPTED | 现在模块多，但可信度表达弱。这个比再加模块更能提高成交与落地成功率。           |
| 3   | 提供“按启用模块生成启动清单”的文档或向导                          | M      | ACCEPTED | 用户真正痛点是第一次启用时不知道还要配什么。                                   |
| 4   | 再新增一批可选模块家族                                            | L      | SKIPPED  | 广度已经先于产品表达，继续加只会稀释主线。                                     |
| 5   | 继续扩更多同类 provider（analytics/affiliate/customer service）   | M      | DEFERRED | 先证明模块治理和验证分层能帮助转化，再决定要不要补 provider 宽度。             |
| 6   | 扩 AI surface，继续加更多生成器页面                               | L      | DEFERRED | 现有 AI 面已经能代表能力，下一步应先证明启用、计费、治理路径，而不是再铺页面。 |

## Accepted Scope

本轮值得扩的，不是新模块，而是以下三项：

- 把产品说明从“我们有很多模块”升级成“哪些能力默认可卖，哪些是可选开关”。
- 把验证状态显式化，让用户知道哪些链路已经被 smoke/spike 覆盖。
- 把模块启用路径写成操作清单，减少第一次配置失败。

这三项一起做，才叫一轮完整扩张。
只做其中一项，都会半吊子。

## Deferred

- 暂不新增更多同类 provider，先看模块分层和验证标识是否能提高采用效率。
- 暂不扩 AI 页面家族，先让现有 AI 能力的启用、计费、运维路径更清晰。

## Not In Scope

- 不做新的兼容层，不做“旧配置继续保留，新分层再包一层”的过渡设计。
- 不把主线重新定义成 AI-only。
- 不为了显得功能多而继续堆 provider。

## Why This Matters

对用户来说，模板产品的核心不是“理论上能配很多东西”。

核心是三件事：

1. 我今天先开哪几个能力就能上线。
2. 我晚点再开哪些模块，不会把主线搞坏。
3. 我看到的模块说明，和代码、测试、部署现实一致。

你现在已经接近这个状态了，但还差产品层的命名、分层和可信度表达。

## Failure Modes

如果现在继续扩模块广度，最可能出现这些问题：

1. 首页和 README 继续承诺“样样都有”，但新用户第一次上手仍不知道该先开什么。
2. 某些模块实际上只是“代码存在”，不是“交付已验证”，最后把信任打穿。
3. admin/settings tab 越来越多，但默认主线越来越模糊，产品从 starter 变成后台配置系统。
4. 文档开始落后于真实配置要求，导致用户第一次部署就踩坑。

## Recommended Next Round

建议下一轮只做一个产品包，不要拆成分散小 PR 思路：

1. 定义模块分层矩阵。
   输出物应该同时覆盖 README、docs、admin/settings 文案。
2. 给现有模块加验证状态。
   至少先覆盖 auth、payment、storage、AI、docs/blog、analytics/affiliate/customer-service。
3. 为每个可开模块补一页“启用该模块需要什么”。
   必须包含配置项、依赖服务、测试命令、风险说明。

这轮做完，再看是否值得补更多 provider。

## Compatibility Decision

- Compatibility required: no
- 这轮如果落地实现，应直接收敛到一套新的模块分层命名与文档，不保留过渡性别名层
- Transitional layers planned: none
- Old paths scheduled for deletion: yes, if existing文档或命名与新分层冲突
- Direct caller updates planned: yes

## Final Recommendation

建议继续扩一轮。

但这轮只能扩“可理解性、可启用性、可验证性”。

不建议扩“模块数量”。

一句话概括：

> 从现在开始，Roller Rabbit 更需要一套清晰的产品封装，而不是更多零件。
