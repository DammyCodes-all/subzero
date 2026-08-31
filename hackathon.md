# Hackathon log

- **Project:** subzero
- **Event:** Convex All Gas Hackathon
- **What it does:** AI subscription protection assistant — finds subscriptions, warns before renewals, and researches verified cancellation routes with evidence.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** https://aromatic-quail-684.convex.cloud
- **Components:** none
- **Convex features:** schema, tables, indexes, auth, queries, mutations, actions, http, scheduler, crons
- **Auth:** Convex Auth
- **AI models:** gpt-4o-mini
- **Started:** 2026-08-28T08:01:06Z
- **Last updated:** 2026-08-29T18:55:00Z

## Log

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
