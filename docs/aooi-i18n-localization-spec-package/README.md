# aooi i18n Localization SPEC Package

这个压缩包包含三份文件：

1. `aooi-i18n-localization-spec.md`
   完整 SPEC，包含 Problem Statement / Proposed Solution / Technical Constraints / Non-goals / Success Criteria。

2. `decision-log.md`
   需求梳理过程中的关键决策，方便追溯为什么这么设计。

3. `implementation-pr-plan.md`
   建议的 PR 拆分计划：6 个技术 PR + 3 个 rollout / 防回归 PR。

建议使用方式：

- 先把 `aooi-i18n-localization-spec.md` 放进仓库 docs。
- 再把 `implementation-pr-plan.md` 拆成 Codex 执行任务。旧网站不强制 rollout，首批只要求 `ai-remover`、`background-remover` 以及后续新站。
- `decision-log.md` 作为需求变更时的对照基线。
