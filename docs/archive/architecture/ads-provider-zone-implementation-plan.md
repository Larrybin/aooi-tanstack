# 广告 Provider / Zone 实现计划

更新时间：2026-04-10  
来源：[`bin-main-design-20260410-002608.md`](/Users/bin/.gstack/projects/aooi/bin-main-design-20260410-002608.md)  
视觉基线：[`DESIGN.md`](/Users/bin/Desktop/project/aooi/DESIGN.md)  
目标：把当前 `AdSense-only` 的广告实现直接收敛为一个单一的、多 provider 的广告系统，同时支持全站注入和页面内广告位。

## 1. 实现目标

这一轮只做四件事：

1. 定义唯一的广告运行时契约。
2. 把后台配置从 `adsense_code` 直接替换成统一 ads 配置模型。
3. 引入 provider 无关的广告位 `zone` 渲染方式。
4. 让 `ads.txt` 回收到 provider 契约，不再写死 Google。

最终结果应该让工程师在 10 分钟内回答这几个问题：

- 当前站点启用的是哪个广告 provider。
- 这个 provider 会在全站注入哪些脚本或 meta。
- 页面内有哪些可用广告位，分别落在哪些 UI 位置。
- 当前 provider 是否支持某个 zone。
- `ads.txt` 输出来自哪里。

## 2. 非目标

- 不支持“多个广告 provider 同时激活”。
- 不做 snippet 管理器，不在 settings 里存任意 HTML/JS 片段。
- 不做兼容层，不保留 `adsense_code -> adsense_client_id` 之类映射。
- 不在第一轮引入按设备、按页面类型、按实验桶的复杂 policy 系统。
- 不为了广告系统去重写整个 theme 系统。

## 3. 单一目标结构

### 3.1 Ads provider 是唯一运行时入口

广告运行时应收敛成一个单一 provider 契约，负责三类事情：

- 全站注入：`meta`、`head script`、`body script`
- 页面内广告位：根据命名 zone 渲染广告内容
- 合规输出：提供 `ads.txt` 条目

推荐最小契约：

```ts
type AdsProviderName = 'adsense' | 'adsterra';

type AdsZoneName =
  | 'landing_inline_primary'
  | 'blog_post_inline'
  | 'blog_post_footer';

type AdsPageType = 'landing' | 'blog-detail' | 'unknown';

type AdsZoneContext = {
  zone: AdsZoneName;
  pageType: AdsPageType;
};

interface AdsProvider {
  readonly name: AdsProviderName;
  getMetaTags(): ReactNode;
  getHeadScripts(): ReactNode;
  getBodyScripts(): ReactNode;
  supportsZone(zone: AdsZoneName): boolean;
  renderZone(context: AdsZoneContext): ReactNode;
  getAdsTxtEntry(): string | null;
}
```

注意：

- 不再保留“provider 列表 manager”这一层语义。
- 当前模型是一站点同一时刻只解析一个 active provider。
- `supportsZone` 和 `renderZone` 是第一轮必须落地的能力，否则 Display Banner / Native Banner 又会逃出统一模型。
- 同一请求内的 layout 注入和多个 `AdZone` 必须共享一次 request-scoped ads runtime snapshot，不允许每个 zone 自己重复读配置、重复建 provider。

### 3.2 Ads zone 是页面唯一可见的广告接口

页面层不再知道 `adsense`、`adsterra`，只知道语义化 zone 名称。

推荐首版 zone：

1. `landing_inline_primary`
2. `blog_post_inline`
3. `blog_post_footer`

命名原则：

- 描述页面语义位置，不描述 provider
- 一个 zone 只有一个 canonical 名字
- 页面只能使用注册过的 zone
- `AdsZoneName`、zone metadata、settings key 约定都必须来自唯一事实源，例如 `src/extensions/ads/zones.ts`

首版信息层级定义：

- `landing_inline_primary`
  - 角色：首屏后的转场位，不是 Hero 内元素，也不是页面底部补充位
  - 允许位置：`Logos` 之后，`Introduce / Benefits` 之前
  - 禁止位置：Hero 内、首个 CTA 紧邻处、最终 CTA / FAQ 之后
- `blog_post_inline`
  - 角色：正文中后段的轻转场位，用来承接已经进入阅读的注意力
  - 允许位置：正文中后段，不早于首个主要内容块之后
  - 禁止位置：标题下方、正文首屏内、TOC/作者卡侧栏内
- `blog_post_footer`
  - 角色：阅读结束后的补充位，不参与正文主叙事
  - 允许位置：正文结束之后、作者信息或相关文章之前/之后的单独区块
  - 禁止位置：正文中段、标题区、侧栏区

### 3.3 settings 是 provider 选择 + provider 参数

后台配置直接收敛成 ads 模块自己的通用配置：

- `ads_enabled`
- `ads_provider`
- provider 专属 key
- provider 对某些 zone 的参数

推荐配置形状：

```ts
type AdsSettings = {
  ads_enabled: boolean;
  ads_provider: 'adsense' | 'adsterra' | null;

  adsense_client_id?: string;
  adsense_slot_landing_inline_primary?: string;
  adsense_slot_blog_post_inline?: string;
  adsense_slot_blog_post_footer?: string;

  adsterra_mode?:
    | 'social_bar'
    | 'popunder'
    | 'native_banner'
    | 'display_banner';
  adsterra_script_key?: string;
  adsterra_zone_landing_inline_primary?: string;
  adsterra_zone_blog_post_inline?: string;
  adsterra_zone_blog_post_footer?: string;
};
```

这里不做“抽象到极致”的通用 KV。这个 repo 的目标是可读性，不是把配置设计成 mini DSL。

### 3.4 Runtime resolver 是唯一配置解析入口

不要让 provider、`AdZone`、`ads.txt`、layout 各自直接读 `configs.xxx`。

新增一个唯一解析入口，例如：

```ts
type ResolvedAdsRuntime =
  | { enabled: false }
  | {
      enabled: true;
      provider: AdsProviderName;
      providerInstance: AdsProvider;
      supportedZones: ReadonlySet<AdsZoneName>;
      adsTxtEntry: string | null;
    };

function resolveAdsRuntime(configs: Configs): ResolvedAdsRuntime;
```

规则：

- 原始字符串配置只在 resolver 中被读取和校验
- 其它调用方只消费解析后的 runtime snapshot
- 缺失必需 key 时返回安全的 empty runtime，而不是半残 provider

## 4. 现状与直接替换点

当前与 ads 强相关的文件有：

- [`src/extensions/ads/index.tsx`](/Users/bin/Desktop/project/aooi/src/extensions/ads/index.tsx)
- [`src/extensions/ads/adsense.tsx`](/Users/bin/Desktop/project/aooi/src/extensions/ads/adsense.tsx)
- [`src/shared/services/ads.ts`](/Users/bin/Desktop/project/aooi/src/shared/services/ads.ts)
- [`src/shared/services/settings/definitions/ads.ts`](/Users/bin/Desktop/project/aooi/src/shared/services/settings/definitions/ads.ts)
- [`src/shared/services/settings/registry.ts`](/Users/bin/Desktop/project/aooi/src/shared/services/settings/registry.ts)
- [`src/config/product-modules/index.ts`](/Users/bin/Desktop/project/aooi/src/config/product-modules/index.ts)
- [`src/app/layout.tsx`](/Users/bin/Desktop/project/aooi/src/app/layout.tsx)
- [`src/app/ads.txt/route.ts`](/Users/bin/Desktop/project/aooi/src/app/ads.txt/route.ts)

当前痛点：

1. `AdsProvider` 只支持全站注入，不支持 zone 渲染。
2. `src/shared/services/ads.ts` 实际上写死只会在 `configs.adsense_code` 存在时实例化 `AdsenseProvider`。
3. `ads.txt` 路由写死成 Google 条目。
4. settings 只有 `adsense_code`，没有 provider 选择，也没有 zone 参数。
5. 页面层还没有 `AdZone` 组件。
6. theme 页面才是真正适合挂 zone 的地方，不是 route 文件。
7. `blog-detail.tsx` 是 client 组件，广告位必须通过 server wrapper / server 插槽接入，不能直接在 client 组件里读 ads service。

## 5. 目标文件改动

### 5.1 新增

- `src/extensions/ads/types.ts`
- `src/extensions/ads/zones.ts`
- `src/extensions/ads/adsterra.tsx`
- `src/extensions/ads/ad-zone.tsx`

说明：

- `types.ts` 负责 provider 和 zone 契约，不要继续把类型散在 `index.tsx` 里。
- `zones.ts` 负责唯一 zone 列表和最小 helper。
- `ad-zone.tsx` 是广告模块自己的 UI 入口，不回流到 `shared/`。

### 5.2 修改

- `src/extensions/ads/index.tsx`
- `src/extensions/ads/adsense.tsx`
- `src/shared/services/ads.ts`
- `src/shared/services/settings/definitions/ads.ts`
- `src/shared/services/settings/registry.ts`
- `src/config/product-modules/index.ts`
- `src/app/layout.tsx`
- `src/app/ads.txt/route.ts`
- `src/themes/default/pages/landing.tsx`
- `src/themes/default/blocks/blog-detail.tsx`
- `docs/guides/modules/growth-support.md`
- `docs/guides/module-contract.md`

说明：

- `landing.tsx`、`blog-detail.tsx` 是首批最值得挂 zone 的地方。
- 首版不去所有页面散点插广告，只做 2 个真实可验证场景。
- 如果 `blog-detail.tsx` 仍保持 client 组件，则新增改动应优先落在对应 server page / server wrapper，而不是把 ads runtime 推进 client 边界。

## 6. 实现顺序

### Phase 1：重建 ads 运行时契约

目标：

- 把 `src/extensions/ads/index.tsx` 从“manager + export adsense”改成真正的 ads domain 入口。
- 引入 `AdsProviderName`、`AdsZoneName`、`AdsZoneContext`。
- 让 provider 支持 `renderZone()` 和 `getAdsTxtEntry()`。
- 新增 `resolveAdsRuntime(configs)`，让它成为唯一配置解析和校验入口。

验收：

- 广告模块存在唯一的 provider 契约。
- `index.tsx` 不再承载一堆类型和实现混写。
- `AdsManager` 如果保留，也只能表达“当前 active provider 的运行时包装”；更推荐直接删掉，改成更直白的 service。
- 所有 ads 读取方都从同一个 runtime snapshot 消费数据，不再各自散读 `configs.xxx`。

### Phase 2：破坏性替换 settings

目标：

- 删除 `adsense_code`。
- 新增 `ads_enabled`、`ads_provider` 以及 provider 专属配置项。
- 更新 Ads setting group 文案，让后台表达“选择 provider + 配置 zone”。
- 同一轮同步更新 settings key、setting group 文案、product module metadata、growth-support/module-contract 文档，不允许只改代码不改术语。

验收：

- `rg "adsense_code"` 在 `src/` 中不再有结果。
- product module metadata 不再把 ads 描述成 “Google Adsense”。
- settings 结构能表达 AdSense 和 Adsterra 的首版需求。
- Ads 相关文案和模块元数据不再出现旧的 adsense-only 术语。

### Phase 3：收敛 service 和 layout 注入

目标：

- `src/shared/services/ads.ts` 只解析一个 active provider。
- `src/app/layout.tsx` 继续负责全站注入，但改从新的 ads service 取数据。
- `src/app/ads.txt/route.ts` 改为 provider-aware。
- 同一请求内多个 ads 读取方共享一次 runtime snapshot，不重复解析。

验收：

- 布局层不需要知道 provider 名称。
- ads disabled 时 layout 注入为空且不报错。
- `ads.txt` 在 provider 不提供条目时返回空正文而不是抛异常。

### Phase 4：落地 zone registry 和 AdZone 组件

目标：

- 新增唯一 zone 注册表。
- 新增 `<AdZone zone=\"...\" pageType=\"...\" />` 组件。
- `AdZone` 从 ads service 或 ads runtime 上下文读取当前 provider，并决定渲染结果。
- `AdZone` 放在 `src/extensions/ads/` 内，不进入 `shared/`。

验收：

- 页面层不 import `AdsenseProvider` 或 `AdsterraProvider`。
- unsupported zone 返回 `null`，没有页面级 fallback 逻辑。
- zone 名称、zone metadata、settings key 约定都引用同一个 zone 事实源。

### Phase 5：挂首批真实 zone

目标：

- 在 landing 页面挂 `landing_inline_primary`
- 在 blog detail 页面通过 server wrapper / server 插槽挂 `blog_post_inline` 和 `blog_post_footer`

为什么是这两个：

- 都是公开页面，广告语义成立
- 都已有清晰的 UI 结构
- 都能在本地或 preview 中肉眼验证

为什么不在 pricing 页挂广告：

- pricing 页的主任务是帮助用户做购买决策
- 广告位会直接与价格卡、币种切换、支付入口争抢注意力
- 首版应优先保护转化路径，不把商业化组件插入购买区

落点建议：

- [`src/themes/default/pages/landing.tsx`](/Users/bin/Desktop/project/aooi/src/themes/default/pages/landing.tsx)
  在 Hero / Logos / 内容段之间插首个 inline zone
- [`src/themes/default/blocks/blog-detail.tsx`](/Users/bin/Desktop/project/aooi/src/themes/default/blocks/blog-detail.tsx)
  由其上游 server wrapper 决定是否插入 zone，自身继续保持 client 组件

验收：

- 首批 zone 能在 landing 和 blog detail 页面稳定出现或稳定返回空
- 不需要在 route 文件里写 provider 判断

### Phase 6：provider 实现

目标：

- 把现有 AdSense 改造成新 contract
- 新增 Adsterra provider

AdSense 首版要求：

- head script
- meta tag
- zone 渲染
- ads.txt

Adsterra 首版要求：

- 至少支持 1 个全站注入型能力
- 至少支持 1 个页面内 zone 型能力
- 不支持的模式明确返回 `null`，不伪装支持

验收：

- AdSense 和 Adsterra 都通过同一接口被解析
- 不再存在 provider 特判散落在 layout、route、page 三层

### Phase 7：文档同步

目标：

- 更新 growth support 和 module contract 文档
- 说明 ads 模块现在是“单 provider 激活 + 多 zone”

验收：

- 文档不再提 `adsense_code`
- 文档不再把 Ads 外部服务写死成 `Google Adsense`

## 7. 数据流

### 7.1 全站注入

1. `getAllConfigsSafe()` 读到统一 ads 配置
2. ads service 解析 `ads_enabled` 和 `ads_provider`
3. ads service 实例化一个 provider
4. `src/app/layout.tsx` 调用 provider 的 `getMetaTags()` / `getHeadScripts()` / `getBodyScripts()`
5. layout 注入对应内容

### 7.2 页面广告位

1. 页面组件渲染 `<AdZone zone=\"...\" pageType=\"...\" />`
2. `AdZone` 取当前 active provider
3. provider 判断 `supportsZone(zone)`
4. 支持则渲染，不支持返回 `null`

### 7.3 ads.txt

1. `src/app/ads.txt/route.ts` 读取 ads service
2. ads service 返回当前 provider 的 `getAdsTxtEntry()`
3. 有值则输出，无值则输出空正文

## 7.5 Interaction state coverage

广告位不是“有就显示，没有就算了”。
首版必须把用户可见状态写清楚，避免页面出现莫名其妙的空白块或静默失败。

```text
FEATURE / ZONE         | RENDERED                          | DISABLED                                  | UNSUPPORTED                              | MISCONFIGURED
-----------------------|-----------------------------------|--------------------------------------------|-------------------------------------------|---------------------------------------------
landing_inline_primary | 渲染一个独立区块，作为首屏后转场位 | 完全不渲染，不保留空白高度                  | 完全不渲染，不保留空白高度                 | 完全不渲染，不保留空白高度；记录日志
blog_post_inline       | 渲染正文中后段轻转场广告位         | 完全不渲染，不打断正文节奏                  | 完全不渲染，不打断正文节奏                 | 完全不渲染，不打断正文节奏；记录日志
blog_post_footer       | 渲染正文结束后的补充广告位         | 完全不渲染，不保留额外尾部留白              | 完全不渲染，不保留额外尾部留白             | 完全不渲染，不保留额外尾部留白；记录日志
global head/body ads   | 注入 provider 脚本或 meta          | 不注入任何 ads 相关 script/meta             | 只注入 provider 支持的部分，不补伪 fallback | 不注入对应脚本；记录日志
ads.txt                | 返回 provider 条目                | 返回空正文，200 text/plain                  | 返回空正文，200 text/plain                 | 返回空正文，200 text/plain；记录日志
```

规则：

- `disabled`、`unsupported`、`misconfigured` 三种状态都不应在页面上留下占位空洞
- `misconfigured` 是运维/日志问题，不是用户教育机会；不要在公开页面显示报错文案
- 页面广告位没有独立 loading skeleton，首版以稳定布局和无闪烁为优先
- `blog_post_inline` 额外支持 partial state：当正文长度或内容块数量不足时直接跳过，不保留空白；`blog_post_footer` 仍可独立显示
- `blog_post_inline` 首版只支持数据库文章提供的可拆分正文；本地 MDX 文章默认只挂 `blog_post_footer`
- `landing_inline_primary` 必须绑定“首个已渲染主区块之后”的落点，而不是绑定某个可选区块

## 7.6 User journey and emotional arc

广告位不能只按“哪里能插”来实现，还要按用户当下在做什么来约束语气和密度。

```text
STEP | USER DOES                    | USER FEELS                     | ADS BEHAVIOR
-----|------------------------------|--------------------------------|-----------------------------------------------
1    | 进入 landing 首屏            | 判断这是什么、值不值得继续看   | 不出现广告；首屏只服务品牌和主行动
2    | 滑过 landing 首屏进入正文前段 | 愿意继续浏览，注意力开始转移   | `landing_inline_primary` 作为首屏后转场位出现
3    | 进入 blog 并开始阅读正文      | 沉浸，希望内容连续             | 不在标题区或正文首屏内显示广告
4    | 阅读到 blog 正文中后段        | 已进入内容节奏，可接受轻转场   | `blog_post_inline` 只允许低打断感呈现
5    | 读完整篇 blog，准备离开/继续点 | 放松，愿意接受补充信息         | `blog_post_footer` 可作为阅读后的补充位出现
```

设计约束：

- `landing_inline_primary` 的目标是承接第二层注意力，不稀释品牌第一印象
- `blog_post_inline` 的目标是轻转场，不得比正文主内容更抢眼
- `blog_post_footer` 才允许承担更明显的补充/推荐角色

## 7.7 Anti-slop visual rules

广告位的目标是融入当前页面节奏，不是突然插入一块“第三方模块 UI”。

首版硬规则：

- `landing_inline_primary`
  - 默认不是 SaaS 卡片，不使用夸张渐变、彩色 badge、装饰性 icon 圆圈
  - 应更像页面内容段之间的独立区块，而不是新建一张促销卡
- `blog_post_inline`
  - 视觉对比度不得高于相邻正文主内容
  - 默认不使用厚边框、重阴影、大面积品牌底色
  - 不允许长成“插在正文里的 landing section”
- `blog_post_footer`
  - 可以有更明确的分区感，但不能长成第二个 CTA hero
  - 视觉语气应更接近“阅读后补充推荐”，而不是“重新抢主任务”

禁用模式：

- 3-column feature grid 风格广告块
- icon-in-circle + title + description 的 SaaS 卡片模板
- 高饱和渐变背景
- 过度圆角和厚阴影叠加
- 任何会让广告位比正文标题或主要 CTA 更显眼的处理

## 8. 边界和风险

### 风险 1：把 provider 能力扁平化

如果把 Adsterra 的所有模式都当成“就是一段 script”，系统会再次撒谎。

控制方法：

- 必须保留 `renderZone()` 这层能力。
- 必须显式区分全站注入和页面内 placement。

### 风险 2：继续保留多 provider manager 语义

当前 `HeadInjectionManager<T>` 容易把 ads 误导成“多 provider 同时并列”。

控制方法：

- ads service 只解析一个 active provider。
- 不要为了复用 `HeadInjectionManager` 强行保留错误模型。

### 风险 3：在 route 层硬塞广告位

这个 repo 的 landing / blog 页面都经过 theme 层渲染。

控制方法：

- 首批 zone 放到 `src/themes/default/...` 的 server page / server wrapper 层。
- route 文件继续只负责取数据和选 page component，client block 不直接读 ads runtime。

### 风险 4：settings 变成 provider 参数坟场

如果每新增一个 provider 就加 20 个松散 key，后台会很快变得不可读。

控制方法：

- 第一轮只支持真正要落地的 provider 参数。
- 不为“未来可能支持的广告格式”预留空字段。

## 9. 测试与验证

最小必要验证：

1. `pnpm lint`
2. `pnpm test` 或等价最小测试集合
3. 手动验证 `ads.txt`
4. 本地或 preview 验证 2 个首批 zone 页面

建议新增的测试点：

- `src/shared/services/ads.test.ts`
  - `ads_enabled=false` 返回 empty runtime
  - `adsense` / `adsterra` 在合法配置下解析成功
  - provider 缺失必需 key 时返回 safe empty runtime
  - 单请求内多个 zone 共享同一个 runtime snapshot
- `src/app/ads.txt/route.test.ts`
  - adsense provider 返回 Google 条目
  - provider 无 `ads.txt` 条目时返回空正文
  - ads disabled 时返回空正文
  - runtime/config 失败时记录日志并返回空正文
- 扩展 `src/config/product-modules/index.test.ts`
  - ads 模块 settingKeys 指向新 ads key
  - ads 模块 externalServices / metadata 已从 adsense-only 收敛
- 扩展 ads settings 相关测试
  - 新 ads settings key 已注册
  - `adsense_code` 已完全移除
- 页面级集成测试或最小 E2E
  - landing: active provider 渲染主 zone，ads off 时为空
  - blog detail: inline + footer zone 与正文/侧栏共存

手动验证清单：

- Landing 页能看到 `landing_inline_primary`
- Blog detail 页能看到 2 个 zone
- 切换 provider 后全站脚本和 zone 同步变化
- `GET /ads.txt` 输出跟 active provider 一致

## 10. 实施建议

建议按两个 PR 切：

### PR 1：契约和配置收敛

- 重建 ads types / service / settings / ads.txt
- AdSense 先迁到新 contract
- `AdZone` 组件和 zone registry 落地

### PR 2：Adsterra + 首批页面接入

- 新增 Adsterra provider
- 挂 landing / blog detail 首批 zone
- 更新文档

这样拆的原因不是保兼容，而是把“骨架收敛”和“首个第二 provider 落地”分开验证。

## 11. 兼容性决策

### Compatibility Decision

- Compatibility required: no
- 本次直接更新调用方并删除旧路径，不保留 `adsense_code`、旧 `ads.txt` 逻辑或旧 provider 解析分支

### Refactor Check

- Thin wrappers added: none
- Aliases preserved: none
- Legacy branches preserved: none

### Plan Check

- Breaking changes accepted: yes
- Transitional layers planned: none
- Old paths scheduled for deletion: yes
- Direct caller updates planned: yes
