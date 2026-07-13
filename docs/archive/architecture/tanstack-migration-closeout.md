# TanStack 迁移完成记录

状态：已完成（本地工程合同）

## 结果

仓库已收敛为单一的 TanStack Start + Vite + Cloudflare 结构：

- 页面与 API 路由位于 `apps/web/src/routes/**`。
- 服务端组装位于 `src/server/**` 与 `apps/web/src/server/**`。
- 构建产物为 `dist/client/**` 和 `dist/server/server.mjs`。
- Next.js、next-intl、OpenNext 与 server-only 不再属于运行时或构建依赖。
- HTTP 路由、请求响应合同、数据库结构、站点配置、Worker 名称和现有 Cloudflare 资源保持不变。

## 持久门禁

```bash
pnpm check
pnpm arch:check
SITE=dev-local pnpm build
pnpm client:boundary
pnpm i18n:check --strict
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:check
pnpm cf:build:no-db --site=mp4-compressor
RESEND_API_KEY=ci-resend-api-key-not-for-production SITE=dev-local pnpm cf:typegen:check
```

迁移期 inventory、validator、Gate 4/5 检查器和兼容命令已删除；后续只维护上述现行门禁。
