# Background Remover deployment

Background Remover uses one App Worker and one State Worker. Its site modules
derive database and storage requirements; its product runtime contract derives
Workers AI, R2, and Durable Object limiting.

Verify the complete deploy contract with:

```bash
SITE=background-remover pnpm site:gate -- --cloudflare
```

Deploy production with:

```bash
SITE=background-remover pnpm release:cf
```

The release requires the product secrets and variables, migrates and checks the
database journal, deploys the State Worker, then atomically deploys the App
Worker. Verify real Cloudflare Images `segment=foreground` behavior after
deployment.
