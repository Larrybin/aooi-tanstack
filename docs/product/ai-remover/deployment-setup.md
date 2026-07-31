# AI Remover deployment

AI Remover uses one App Worker and one State Worker. Site modules derive
database, storage, auth, billing, and provider requirements. The AI Remover
runtime contract additionally derives Workers AI, R2, Durable Object limiting,
`STORAGE_PUBLIC_BASE_URL`, and `REMOVER_CLEANUP_SECRET`.

The App Worker owns the scheduled `/api/remover/cleanup` call at
`17 3 * * *`.

Verify:

```bash
SITE=ai-remover pnpm site:gate -- --cloudflare
```

Release:

```bash
SITE=ai-remover pnpm release:cf
```

The release migrates and verifies the database journal, deploys the State
Worker, then atomically deploys the App Worker.
