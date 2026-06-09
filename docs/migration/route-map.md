# TanStack Native Route Map

Gate 0-3 only creates real TanStack route files for the vertical slice. Unmigrated routes are inventoried here but are intentionally not generated as placeholders.

| Legacy route                                  | Gate 0-3 TanStack status                           |
| --------------------------------------------- | -------------------------------------------------- |
| `src/app/[locale]/(landing)/pricing/page.tsx` | `apps/web/src/routes/$locale/pricing.tsx`          |
| `src/app/api/payment/checkout/route.ts`       | `apps/web/src/routes/api/payment/checkout.ts`      |
| `src/app/api/payment/notify/route.ts`         | `apps/web/src/routes/api/payment/notify.ts`        |
| `src/app/api/user/get-user-credits/route.ts`  | `apps/web/src/routes/api/user/get-user-credits.ts` |

All other routes remain legacy baseline until Gate 4-7.
