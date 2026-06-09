# Gate 0-3 Dependency Version Notes

Gate 0-3 uses exact versions in `package.json` and a regenerated
`pnpm-lock.yaml` to avoid the previous invalid-version failure.

| Package                   | Version in branch | Purpose                                        |
| ------------------------- | ----------------: | ---------------------------------------------- |
| `@tanstack/react-start`   |        `1.168.25` | TanStack Start full-stack app                  |
| `@tanstack/react-router`  |        `1.170.15` | Native file routes and server routes           |
| `@tanstack/react-query`   |         `5.101.0` | Future data/query layer for admin/member Gates |
| `@tanstack/react-form`    |          `1.33.0` | Future form layer for admin/member Gates       |
| `@cloudflare/vite-plugin` |          `1.40.1` | Cloudflare Workers Vite integration            |
| `@vitejs/plugin-react`    |           `6.0.2` | React plugin for Vite                          |
| `vite`                    |          `8.0.16` | Build tool used by TanStack Start              |

`pnpm install --no-frozen-lockfile` completed on 2026-06-10 and regenerated
the lockfile. pnpm still reports existing Fumadocs peer warnings with Next 16
and a `fumadocs-mdx` Vite peer warning; they did not block the Gate 0-3
verification commands.
