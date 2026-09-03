# Next.js 16.3 Instant Navigation — Research + Application

## TL;DR
Next 16.3 ships **Instant Navigations**: server-driven App Router with SPA-like commit via **Cache Components** + **Partial Prefetching** + `<Suspense>`/`useLinkStatus`.

Applied to SubZero (was `16.2.10` → `16.3.4`):
- `next.config.ts:3` `cacheComponents: true` + `partialPrefetching: true`
- 5 `loading.tsx` App Shells (`src/app/dashboard/loading.tsx:1`, `src/app/dashboard/subscriptions/loading.tsx:1`, `src/app/dashboard/connections/loading.tsx:1`, `src/app/dashboard/settings/loading.tsx:1`, `src/app/subscriptions/[id]/loading.tsx:1`) — static, no `use client`, prefetched once per route
- `src/components/ui/LinkPending.tsx:1` `useLinkStatus()` pending UI (`LinkPendingDot`, `PendingWrap`, `LinkPendingOverlay`) — slow-network feedback per [Prefetching](https://nextjs.org/docs/app/guides/prefetching) / [Link](https://nextjs.org/docs/app/api-reference/components/link)
- Wired `src/components/layout/Sidebar.tsx` + `src/components/dashboard/DashboardView.tsx` + `src/components/subscriptions/SubscriptionsView.tsx` for instant pending states
- Build `next 16.3.4 (Turbopack)` ✓ `Cache Components enabled` `Partial Prefetching enabled` — routes `○` static + `/subscriptions/[id]` `◐ Partial Prerender` (13.1s)

## Research
- **Blog**: `next-16-3-instant-navigations` — Stream (`<Suspense>`), Cache (`'use cache'`), or Block (`export const instant = false`). Shell per route cached on client; N links to same route → 1 prefetch (was N).
- **Guides**: `/docs/app/guides/instant-navigation`, `/docs/app/guides/prefetching`, `/docs/app/guides/optimizing-prefetching`
- **Config**: `cacheComponents` (`next.config.ts`, requires Node runtime) + `partialPrefetching: true` (requires `cacheComponents`, validates in `next dev/build`). `cacheComponents` also enables PPR by default + Activity preservation (hidden routes keep state).
- **Link**: default prefetches shell on viewport entry (production only, task queue: viewport → hover → newer replaces older). `prefetch={true}` opts into per-link URL data (`params`/`searchParams` + `'use cache'` content). `prefetch={false}` disables for large lists. `prefetch` segment config overrides app-level.
- **UX**: `loading.tsx` = streamed fallback + prefetched shell; `useLinkStatus` inside `<Link>` → `pending` boolean for skeleton/opacity/dot (no extra fetch). `useRouter().prefetch(href, {onInvalidate})` for manual warming.
- **13 vs 16.3**: 13 introduced `app/` + Layouts/RSC/Streaming/`fetch` cache + viewport prefetch per-Link. 16.3 refines it to per-route shell + `cacheComponents` + validation overlay + Navigation Inspector + `instant()` Playwright helper.

## What changed per route
| Route | Before | After |
|-------|--------|-------|
| `/`, `/auth` | static, no shell | static (auth already had `Suspense` at `src/app/auth/page.tsx:7`) |
| `/dashboard` | client `useQuery` + inline `DashboardSkeleton`, no `loading.tsx` | `src/app/dashboard/loading.tsx` App Shell + `LinkPending` on `View all` + hero/row overlays → client nav resolves synchronously (`useSearchParams` sync on nav) |
| `/dashboard/subscriptions` | client list, no shell | `loading.tsx` table skeleton, grid cards with `LinkPendingOverlay` — shell shared across paginated links |
| `/subscriptions/[id]` | client `useParams` + `DetailSkeleton` inline | `loading.tsx` + `◐ Partial Prerender` — param-specific data streams after shell commits |
| `Sidebar` | `Link` no status, no prefetch hint | `PendingWrap` + `LinkPendingDot` on each `NAV_ITEMS` link; Activity keeps `collapsed` state across navs |

## Why this helps SubZero (Convex client data)
All data is `convex/react` `useQuery` (`undefined=loading`) — no `'use cache'` on DB reads. Instant still wins:
- Navigation commits on shell immediately (no server round-trip for static shell)
- `loading.tsx` shows meaningful skeleton instead of blank/spinner (prefetched)
- `useLinkStatus` gives perceived responsiveness on slow 3G before Convex query returns
- Activity (`cacheComponents`) preserves `Sidebar`/`Topbar` state + form inputs when navigating back

## Verify
```bash
pnpm install # next 16.3.4
pnpm build   # ✓ 36.8s compile + 13.1s prerender, no type errors
# dev: open Next DevTools → Navigation Inspector → Pause on navigations → click Sidebar
# see "Loading shell (Client nav)" then real content streams
```

## Next steps (not done, demo-deferred)
- `'use cache'` for marketing hero/fetch (`src/app/page.tsx:4` static copy) → shell ships cached at CDN; `cacheLife` tuning
- `prefetch={true}` on `/subscriptions/[id]` cards once detail fetch moves to `'use cache'` (params-aware)
- `instant()` e2e with `@next/playwright` to lock shells in CI
- `export const instant = false` on `/dashboard/connections` if Gmail scan should block navigation
