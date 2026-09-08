# Hackathon log

- **Project:** subzero
- **Event:** Convex All Gas Hackathon
- **What it does:** AI subscription protection assistant — finds subscriptions, warns before renewals, and researches verified cancellation routes with evidence.
- **Live app:** not deployed
- **Repo:** local only, not yet public
- **Frontend:** Next.js locally; Convex static hosting deferred (Gmail OAuth lives in Next.js API routes, which a static export cannot serve)
- **Convex deployment:** https://aromatic-quail-684.convex.cloud
- **Components:** `@firecrawl/firecrawl-convex 0.1.1` (research search/scrape), `@agentmail/convex 0.1.0` (durable outbound sends), `@convex-dev/static-hosting 0.2.1` (installed, not registered)
- **Convex features:** schema, tables, indexes, auth, queries, mutations, actions, http, scheduler, crons, components
- **Auth:** Convex Auth
- **AI models:** Groq `openai/gpt-oss-120b` primary, OpenRouter then OpenAI `gpt-4o-mini` fallback (`convex/ingestion/extract.ts`, `convex/research.ts`); no `OPENAI_API_KEY` set on the deployment
- **Started:** 2026-08-28T08:01:06Z
- **Last updated:** 2026-09-08T00:00:00Z

## Log

### 2026-09-08 - working tree
Closed three product gaps: lifecycle wiring (CTA clicks in `ActionCard`, `SubscriptionDetailView`, `HowToCancel` flip to `user_started` via `useCancelStarted`, guarded forward-only in `convex/actions.ts`; email send path walks `action_ready → user_started → cancellation_pending` server-side), difficulty reasons (observable-only chips from `difficultyReasons` in `src/lib/cancellation.ts`, rendered in `HowToCancel`), and first-scan results summary (`FirstScanSummary` with live counts + top cards, shown once per productive first scan from `useFirstScan`).

### 2026-09-08 - working tree
Installed official sponsor components and migrated off raw fetches: `@firecrawl/firecrawl-convex` now powers research search/scrape via `convex/lib/firecrawl.ts` (`convex/research.ts`), and `@agentmail/convex` now powers durable outbound sends (cancellation emails, renewal nudges, confirmations) via `convex/lib/agentmail.ts` (`convex/agentmail.ts`, `convex/notifications.ts`) with workpool retries and reactive delivery status. Inbound AgentMail routing stays custom in `convex/http.ts`. `@convex-dev/static-hosting` installed but not registered — Gmail OAuth lives in Next.js API routes, which a static export cannot serve. Corrected the build log header (components, truthful Groq-first model order, deploy status). Convex features: components, actions, mutations (`convex/convex.config.ts`, `convex/lib/firecrawl.ts`, `convex/lib/agentmail.ts`).

### 2026-08-28 - working tree
Set up subzero project scaffolding inside dev folder. Initialized hackathon build log, global Convex skills and MCP server, and project-local hackathon skill. No app features yet.

### 2026-08-28 - working tree
Provisioned Convex dev deployment aromatic-quail-684, pushed schema (connections, subscriptions, evidence, cancellationActions, notifications) with indexes, installed Convex Auth with Google provider, and AI files (`convex/_generated/ai/guidelines.md`, `AGENTS.md`, `CLAUDE.md`). Added Firecrawl and AgentMail (subzero-agent) to Convex env. Convex features: schema, tables, indexes, auth (`convex/schema.ts`, `convex/auth.ts`, `convex/auth.config.ts`).

### 2026-08-28 - working tree
Refined data model per grill: added `by_user_and_dedup` index and `gmailScopeGranted`/`attemptedAt` fields, and implemented lean modules `lib/dedup.ts` (dedupKey), `lib/difficulty.ts` (getDifficulty), `subscriptions.ts` (list, needsAttention, upsert), `evidence.ts`, and `seed.ts` (8 mocks: Adobe 2d high, Canva 6d etc). Convex features: queries, mutations, indexes (`convex/schema.ts`, `convex/lib/dedup.ts`, `convex/subscriptions.ts`).

### 2026-08-28 - working tree
Wired design system (Ink #0A1420, Frost #E7F1FA, Glacier #5FB8E0, Ember #F2664B — Frost 60%/15% for text/borders, 8-10px radius restraint, status dots circular) with Space Grotesk/Inter/Plex Mono via next/font and dark-only `globals.css` backed by shadcn `button.tsx`. Built auth flow: `ConvexClientProvider`, `SignInButton` (google), `UserMenu`, `AuthGuard` and `/dashboard` reading `subscriptions.needsAttention`/`list` live. Convex features: auth, queries (`src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/button.tsx`, `src/components/SignInButton.tsx`).

### 2026-08-29 - working tree
Implemented Phase 1: Real AI extraction engine using OpenAI gpt-4o-mini (`convex/ai.ts`) to extract structured subscription details and evidence snippets from raw email text. Created action-safe internal mutations `upsertInternal` and `addInternal` (`convex/subscriptions.ts`, `convex/evidence.ts`), AgentMail webhook endpoint at `/api/agentmail-webhook` (`convex/http.ts`, `convex/connections.ts`), and interactive UI dialog (`src/components/ScanEmailDialog.tsx`). Convex features: schema, tables, indexes, auth, queries, mutations, actions, http (`convex/ai.ts`, `convex/http.ts`, `convex/connections.ts`).

### 2026-08-29 - working tree
Implemented Phase 2: Cancellation Research Engine (`convex/research.ts`). Created `researchCancellationRoute` internalAction that uses Firecrawl (`https://api.firecrawl.dev/v1/search`) to scrape merchant help centers for cancellation procedures, then uses Groq/OpenAI to extract a structured JSON response (cancellation method, instructions array, difficulty, and exact evidence quote). Scheduled this research pipeline to trigger automatically via `ctx.scheduler.runAfter` on new subscription creation in `convex/ai.ts` (paste/UI) and `convex/ingestion/process.ts` (email forwarding pipeline). Results automatically patch the subscription status and add Firecrawl evidence. Convex features: actions, queries, mutations, scheduling.

### 2026-08-29 - working tree
Implemented Phase 4: The Nudge Engine (Scheduled Notifications & Reminders). Created `convex/notifications.ts` and `convex/crons.ts`. Automatically schedules 3 renewal lead-time milestones (7d, 3d, 24h) via `ctx.scheduler` upon subscription ingestion/upsert. Configured `deliverNudge` internalAction to deliver outbound email alerts via AgentMail with renewal urgency, price, merchant name, and direct cancellation link. Added daily cron job (`daily renewal nudge sweep`) for renewal sweeps. Convex features: scheduler, crons, actions, mutations, queries.

### 2026-08-31 - working tree
Fixed user identity resolution and duplicate connection creation by standardizing Auth calls to `getAuthUserId(ctx)` across `convex/agentmail.ts`, `convex/subscriptions.ts`, `convex/gmail.ts`, and `convex/gmailActions.ts`. Resolved session ID mismatch where queries failed to match subscriptions created across different auth sessions. Completed Phase 5 (Gmail API Scan) with canonical user binding. Convex features: auth, queries, mutations, actions, schema, indexes.

### 2026-09-01 - working tree
Hardened multi-email support after a two-document audit (`dev_audit.md`, `docs/multi-email-audit.md`). Added `sourceEmail` to `subscriptions` and `ingestionAttempts` (`convex/schema.ts`) and plumbed it through Gmail scan + forwarding pipelines (`convex/ingestion/persist.ts`, `convex/ingestion/process.ts`, `convex/gmailActions.ts`) so renewal nudges (`convex/notifications.ts`) and cancellation emails (`convex/agentmail.ts`) deliver to the inbox the subscription was detected from, not the first connection. Made webhook signature verification a hard 401 in production (`convex/http.ts`), blocked password signup from merging into OAuth-only accounts and new signups using an email already connected to another account (`convex/auth.ts`), added cross-user email-ownership guards in `storeByEmail`/`storeGmailToken` (`convex/gmail.ts`), and per-connection Gmail scanning with per-connection cooldown plus targeted disconnect via `connectionId` (`convex/gmail.ts`, `convex/gmailActions.ts`, `src/components/connections/ConnectionsView.tsx`). Replaced heuristic routing in `resolveUserByInbox` — removed `.take(100)` broad scans and "most recent connection" guessing, refusing ambiguous shared-inbox emails instead (`convex/agentmail.ts`). Added per-account forwarding guidance to `ForwardingCard.tsx`. Convex features: auth, schema, indexes, queries, mutations, actions, http, scheduler, crons.
