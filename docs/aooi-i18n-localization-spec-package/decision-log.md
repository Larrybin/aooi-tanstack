# Decision Log：aooi Site-level i18n / SEO Localization

1. 多语言第一目标：SEO + 产品体验都要，但 SEO 更重要。
2. 语言粒度：每个 site 自己配置 supportedLocales。
3. SEO 页面：本地化重写；产品 UI：准确翻译。
4. 覆盖范围：全站多语言。
5. 质量标准：所有页面同一标准，不能出现英文 fallback。
6. 第一版每个 site 支持 3–5 个语言。
7. V1 不做 slug 本地化。
8. 内容资产分层：全局 UI 翻译 + site 级 SEO/内容翻译。
9. 本地开发 warning，CI / production build 严格失败。
10. 内容生产：AI 生成 + 人工审核后发布。
11. 每个 site 有 i18n 审核 manifest。
12. 审核粒度：按页面审核。
13. 页面清单：自动扫描基础路由 + site include/exclude/required。
14. 源语言：英文永远是唯一源语言。
15. 目标语言关键词 brief：用户自行提供，不入库。
16. CI 不校验 SEO brief。
17. 人工审核重点按页面类型区分。
18. sitemap / hreflang：只有 SEO 可索引且 approved 的页面进入。
19. indexable 页面：自动推断 + site 显式覆盖。
20. 英文 fallback 判定：key/file 完整 + 英文残留检测 + glossary allowlist。
21. glossary 粒度：global + site 合并。
22. global glossary 防误伤；site glossary 管标准译法和风险表达。
23. site glossary 检查分层。
24. 语言切换器：dev 显示全部；production 只显示可发布语言；默认 footer。
25. 语言切换器固定 footer，不允许 site 覆盖。
26. build warning；CI / cf:build fail。
27. 独立命令：i18n:check，支持 --strict。
28. AI 生成内容通过独立分支 / PR。
29. AI 生成 PR manifest 初始 pending。
30. AI 生成 PR 是 Draft PR + i18n-pending-review label。
31. 英文源用户可见文案变化后，对应翻译 approved 失效。
32. 英文源变化和翻译更新必须同 PR 完成。
33. 只有用户可见文案变化触发重新审核。
34. 强制英文源内容资产化。
35. 新增/修改文件禁止硬编码用户可见英文，允许 i18n-exempt。
36. i18n-exempt 必须写 reason，品牌/术语类需进 glossary。
37. 旧站不强制迁移到完整多语言规则，只有明确纳入 rollout-required 清单时才执行。
38. rollout-required site 严格；legacy / optional site 不因未完成 rollout 阻断。
39. 全库推荐语言组合，但每个 rollout-required site 必须显式确认 supportedLocales。
40. 推荐语言池：en / es / pt-BR / ja / de / fr / ko / zh。
41. V1 每站从候选池选 3–5 个语言，后续扩到 6–8。
42. AI 生成能力做仓库内置 Codex skill。
43. Codex skill 拆成 i18n-localize 和 i18n-review。
44. i18n-review 只有用户明确确认后才能写 approved。
45. 默认按页面批准，允许批量选择。
46. manifest 每页记录 status / sourceHash / targetHash。
47. sourceHash 按页面类型区分。
48. targetHash 按页面类型区分。
49. 每个 site 一个 JSON manifest。
50. manifest 页面 key 使用 pageId，同时记录 path。
51. 页面清单单独放 pages.json。
52. pages.json 字段：pageId / path / type / indexable / required / source / hashScope。
53. 页面类型：seo / blog / docs / legal / product-ui / auth / admin。
54. blog/docs：自动扫描 + frontmatter 控制 + site exclude。
55. blog/docs frontmatter：published + indexable；pageId 自动生成。
56. SEO brief 来源：用户自行提供。
57. SEO brief 不入库，执行时临时粘贴。
58. CI 不校验 brief。
59. 未支持语言 URL：production 404。
60. 默认语言 URL 不带前缀。
61. 不做浏览器语言自动跳转。
62. footer 语言切换保留当前 path 和 query。
63. 不记住用户语言偏好。
64. hreflang x-default 指向默认语言当前页面。
65. 每个语言页面 canonical 指向自己。
66. site.config i18n 使用标准配置。
67. 全局语言注册表 + site 选择子集。
68. registry 字段：code / name / englishName / direction / hreflang。
69. registry 用 JSON 作为唯一数据源。
70. registry 与 site i18n 配置用 Zod 校验，预留 JSON Schema。
71. glossary：global JSON + site JSON + Zod 校验。
72. global glossary 极简 preserve；site glossary 支持 preserve / terms / forbidden。
73. forbidden：seo/blog/docs/product-ui/legal strict fail；admin/auth warning。
74. 英文残留：全站 strict fail。
75. 默认语言 en 不进入 manifest 审核。
76. 默认语言源内容按页面类型分层检查。
77. 目标语言内容按页面类型分层 strict。
78. i18n:check 输出 terminal + JSON report。
79. report severity：error / warning / info。
80. strict 模式只因 error fail，warning 不阻断。
81. 成功标准分为 technical complete 与 rollout complete。
82. PR 拆分：技术底座拆 PR + 站点迁移拆 PR。
83. Technical Complete 拆成 6 个技术 PR。
84. Rollout Complete 不再强制旧站一次性迁移。
85. `mamamiya` 与 `dev-local` 作为 legacy / optional 站点，不作为 V1 强制 rollout 阻断项。
86. 首批强制 rollout 站点为 `ai-remover` 与 `background-remover`。
87. 后续新增正式站点需要显式纳入 rollout-required 清单后，才执行同一门槛。
88. 首批强制 rollout 语言：en / zh / ja。
