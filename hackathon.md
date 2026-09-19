# SubZero — Hackathon log

> Judges TL;DR: SubZero watches your subscriptions so renewals don't blindside you. It pulls receipts out of Gmail, warns you 7 days, 3 days, and 24 hours before each charge, and looks up how to cancel with quotes from the merchant's own help pages. Live and realtime at the URL below.

- **Project:** SubZero
- **Event:** Convex All Gas Hackathon (sponsored by OpenAI, Firecrawl, AgentMail)
- **What it does:** Finds subscriptions from Gmail receipts, warns before renewals and trial charges, and researches verified cancellation routes with evidence quotes.
- **Who it's for:** People losing money to trials that convert silently and renewals that arrive unannounced. Students, freelancers, families. Anyone with a Gmail inbox and a card on file somewhere.
- **Live app:** https://elated-oriole-157.convex.site
- **Repo:** https://github.com/DammyCodes-all/subzero (public)
- **Demo video (<3 min):** (link would be pasted here)
- **Frontend:** Next.js 16 static export served from the Convex deployment via `@convex-dev/static-hosting` (registered). Gmail OAuth runs on Convex HTTP (`GET /gmail/oauth/callback`), so no Next.js API routes remain.
- **Convex deployment:** prod site https://elated-oriole-157.convex.site / api https://elated-oriole-157.convex.cloud. Prod `SITE_URL` points at the live site so outbound mail links land there. Dev: https://aromatic-quail-684.convex.cloud
- **Components:** `@firecrawl/firecrawl-convex 0.1.1` (research search/scrape), `@agentmail/convex 0.1.0` (durable outbound sends), `@convex-dev/static-hosting 0.2.1` (registered, serves the static export)
- **Convex features:** schema, tables, indexes, auth, queries, mutations, actions, http, scheduler, crons, components
- **Auth:** Convex Auth (Google)
- **Built with:** agentic coding workflow plus the Convex plugin (convex-expert / convex-reviewer, MCP server, Agent Skills for auth, schemas, migrations)
- **AI models:** Groq `openai/gpt-oss-120b` / `openai/gpt-oss-20b`, OpenRouter `liquid/lfm-2.5-2.6b:free`, and OpenAI `gpt-4o-mini` in one provider chain. Every call uses the OpenAI-compatible Chat Completions interface. Extraction (`convex/ingestion/extract.ts`) and research synthesis (`convex/research.ts`) run across the chain with rotation, backoff, and JSON repair.
- **Tests:** 29 passing across 9 files (`pnpm vitest run`, verified 2026-09-19)
- **Started:** 2026-08-28T08:01:06Z
- **Last updated:** 2026-09-19T00:00:00Z

## Why it fits this hackathon

This isn't a developer tool. A judge can connect a Gmail account and see their own renewals show up with dates, prices, and cancel steps. That matters more than any architecture diagram.

The loop is short enough to feel in a week. A trial ending tomorrow triggers a warning today. A renewal in two days comes with the merchant's cancellation path already researched and quoted. Most subscription apps stop at tracking. This one tells you what to click.

## Sponsor stack

| Sponsor | What it does in the product |
| --- | --- |
| OpenAI (plus Groq/OpenRouter) | Turns each receipt into merchant, price, renewal date, trial end, billing provider. Turns scraped help pages into cancellation steps with a difficulty rating. The chain rotates providers, backs off on rate limits, retries unparseable JSON once, and logs every call. See `convex/lib/llm.ts`, `convex/lib/aiModels.ts`, `convex/ingestion/extract.ts`, `convex/research.ts`, `convex/lib/aiUsage.ts`. |
| Firecrawl (official component) | Searches the merchant's help center and scrapes the cancellation pages for every new subscription. Quotes get stored with their URLs. Requests are paced with jitter, results cached 30 days, refreshable from the subscription card with a 10-minute cooldown. See `convex/lib/firecrawl.ts`, `convex/research.ts`, `convex/researchCache.ts`, `convex/lib/researchSchedule.ts`, `src/components/subscriptions/SubscriptionResearchRefresh.tsx`. |
| AgentMail (official component) | Each user gets a forwarding inbox, and inbound receipts arrive through a verified webhook. Renewal nudges, trial warnings, and cancellation emails go out through the component's queue with retries, and delivery status is a live query. See `convex/lib/agentmail.ts`, `convex/agentmail.ts`, `convex/notifications.ts`, `convex/http.ts`, `convex/convex.config.ts`, `patches/@agentmail+convex@0.1.0.patch`. |

## Convex depth

| Feature | Proof |
| --- | --- |
| Schema + indexes | 13 app tables + authTables, per-user/dedup/renewal/trial/message indexes (see `convex/schema.ts`). |
| Realtime queries | Dashboard, subscriptions, connections, scan health all useQuery (see `src/components/connections/ConnectionsView.tsx`, `src/hooks/`). |
| Mutations + actions | subscriptions.upsert, actions.deleteSubscription plus tombstones, markStarted lifecycle guard (see `convex/subscriptions.ts`, `convex/actions.ts`). |
| Scheduler + crons | 7d/3d/24h renewal plus trial nudges via ctx.scheduler, daily sweep plus stale-reminder sweep (see `convex/notifications.ts`, `convex/crons.ts`). |
| HTTP | AgentMail webhook, Gmail OAuth callback, Firecrawl prefix (see `convex/http.ts`). |
| Components | AgentMail, Firecrawl, static hosting registered (see `convex/convex.config.ts`). |
| Auth | Convex Auth Google, per-user ownership guards, no cross-user merges (see `convex/auth.ts`, `convex/gmail.ts`). |
| Resilience | Retry queues (gmailScanFailures), resumable backfill drain, research retry plus cache, idempotent ingestion (see `convex/gmailBackfillDrain.ts`, `convex/gmailRetries.ts`, `convex/ingestion/persist.ts`). |

## Try it in 2 minutes

1. Open the live app and sign in with Google.
2. Connect Gmail for a real scan that drains fast with per-connection progress. No Gmail handy? Skip to step 3 and paste a receipt instead.
3. Paste any receipt instead if you prefer: Subscriptions header, manual add, Extract, check the preview, Save.
4. Open a subscription. You'll see evidence quotes with sources, a difficulty chip, the cancel steps, and one action card. Could be a merchant link, a provider redirect, an email draft, or support steps.
5. On a `send_email` subscription, Review & send drafts and sends a real cancellation email through AgentMail.
6. Renewal and trial warnings (7 days, 3 days, 24 hours) arrive as plain-spoken emails with links back to the live site.

## Log

### 2026-09-19 - working tree
Deleted the dead `convex/seed.ts` mock seeder. The UI button was already gone and nothing imported it, so it was just sitting there confusing anyone reading the repo. Codegen and typecheck pass after the removal. Also removed the last "seed mocks" mentions from this log's judge path and the README testing list.

### 2026-09-19 - working tree

Rewrote `hackathon.md` and `README.md` for judging: short judge summary with live URL, repo, and demo/social slots; sponsor table pointing at the exact files where OpenAI, Firecrawl, and AgentMail run; Convex depth table; a 2-minute path through the app. Also cleared out stale claims (public repo URL, Next.js 16 with Hugeicons, the deleted `convex/ai.ts` and `[id]` route, Groq-first model order, registered static hosting). Second pass to strip the generic marketing tone. Tests now 29 passing across 9 files. Still open before submit: paste the YouTube URL and publish the X/LinkedIn post with all 4 tags.

### 2026-09-15 - working tree

Manual paste is back as full AI flow (`convex/manual.ts previewPaste` + `ManualAddDialog.tsx`: paste, Extract, editable preview, Save via `subscriptions.upsert` + `evidence.add manual`; entry in Subscriptions header and empty state). Trial warnings now send full 7d/3d/24h before `trialEndsAt` (`trial_7d/trial_3d/trial_24h` in `convex/schema.ts`, `convex/notifications.ts`) reusing lead-time prefs; stuck `user_started` gets one `reminder` after 3d via daily sweep (`sweepStaleReminders`, `startedAt` in schema, once-only dedup). Lifecycle uses `cancellation_pending` in code (`docs/product-spec.md` fixed) and research infra failures now set `subscriptions.status=failed` with retry path resetting to active. Dashboard stays lean by choice (monthly pace, attention, active incl trials; annual/saved/health parked in spec). Manage card gains Refresh research (`SubscriptionResearchRefresh.tsx`: 10-min cooldown, old steps kept; skipped on cancelled/hidden). An Edit-details row shipped then got cut per feedback, with its mutation removed too. Tests 18 passing across 5 files.

### 2026-09-14 - f5025a7

Delete-my-account now confirms through an animated dialog (`src/components/settings/DeleteAccountDialog.tsx`: Base UI AlertDialog with a motion spring panel and blur backdrop, focus trap, Escape and backdrop close) instead of the inline expanding block. SettingsView only opens it and passes the confirm handler.

### 2026-09-14 - 36bff4a

Shared nav routes (`src/components/layout/navigation.ts`) for the sidebar and mobile bottom bar, covered by `tests/navigation.test.ts` (suite now 16 passing across 5 files). Also in this commit: fresh receipts resurface legacy hidden rows (`convex/ingestion/persist.ts` merge branch clears `hidden`), since Remove is a hard delete now and anything still hidden predates tombstones.

### 2026-09-14 - 9c46cfb

Full account deletion backend: `userData.deleteMyAccount` wipes app data plus auth accounts, sessions with refresh tokens, and the user row; both wipe paths share one helper that now also clears `userSettings`, scan runs and failures, and OAuth states. Client signs out and lands on `/`. Dashboard shows the onboarding panel with no stats row when there is nothing to summarize.

### 2026-09-14 - f92b58c

Remove is now permanent delete: `actions.deleteSubscription` hard-deletes the row plus evidence, drafts, and notifications, and writes a `deletedSubscriptions` tombstone (`convex/schema.ts`) so rescans suppress the same receipt instead of resurrecting it. Genuine changes still surface under a new dedup key. Cancelled and hidden rows sink below live ones in the subscriptions sort (`src/components/subscriptions/SubscriptionsView.tsx`). Convex features: mutations, scheduled functions.

### 2026-09-14 - ce47d82

Fixed forwarding misfire: self-mail detection strips email addresses before checking (`convex/lib/selfMail.ts`), so the quoted forwarding address in a forwarded receipt no longer counts as a SubZero marker. This was the prod `skipped: self mail` cause; user verified forwarding works end to end on prod after deploy with per-deployment webhook secrets.

### 2026-09-14 - 0e43fc9

First Gmail scan drains fast: new `convex/gmailBackfillDrain.ts` self-chains (~20s per hop) instead of waiting on the 15m cron, with `MANUAL_PER_RUN=50` and `BACKFILL_PER_TICK=25`. Convex features: scheduled functions, actions.

### 2026-09-14 - d64a8b9

Removed the forced `/` to `/dashboard` bounce for signed-in users (`MarketingHomeRedirect` deleted); the header already offers a dashboard link.

### 2026-09-13 - efba8af

Marketing refactor: `CancelPathsSection` uses shared `ROUTES` for cancellation paths with motion effects.

### 2026-09-13 - working tree

Fixed live Gmail auto-sync (poll was 400ing on `labelsAdded` vs `labelAdded` single `labelAdded` + `-unsubscribe` killed recall, so history cursor never advanced; fixed `convex/lib/gmail.ts:26` queries + transient keeps cursor), sorted subscriptions by next bill (`src/components/subscriptions/SubscriptionsView.tsx`), fixed `every unknown` (`convex/lib/emailTemplates.ts:38` `unknown→period`), aligned all 4 outbound templates to the dark `EmailLayout` design (shared `shell()` with `#0b1310`, logo, lime button `convex/lib/emailTemplates.ts:63`, plus `trialEndingTemplate`/`actionReminderTemplate` now HTML), set prod `SITE_URL` to live site `https://elated-oriole-157.convex.site` (`convex/convex.config.ts`, `.env.example`, mail links), and made manual `markCancelled` always mail (`convex/notifications.ts:189` auto dedups 30d, manual bypass).

### 2026-09-12 - working tree

Shipped the live URL: registered `@convex-dev/static-hosting`, migrated Gmail OAuth to Convex (`gmailOAuth.getAuthUrl` action + `GET /gmail/oauth/callback` in `convex/http.ts`, state table `gmailOAuthStates`), switched to Next.js static export, moved subscription detail to `/dashboard/subscriptions?sub=` (dynamic `[id]` route removed), and pointed all email CTAs at the static-friendly link. Signed-in visitors to `/` now bounce to `/dashboard`.

### 2026-09-12 - working tree

Wired the narrative email templates to real sends (`convex/lib/emailTemplates.ts` mirrors `src/emails/` voice/subjects, HTML + text via `enqueueSend`), made missing mail keys fail loudly in prod instead of marking sent, fixed `subscriptions.upsert` and `seed` to schedule nudges + research like the internal path, removed manual receipt pasting (`ScanEmailDialog`, dead `Header`, `convex/ai.ts`), made the 404 auth-aware, and added vitest (`tests/`: dedup, difficulty, email templates, subjects — 10 passing) with `pnpm check`.

### 2026-09-11 - working tree

Fixed silent total outbound failure: the AgentMail component's functions are isolated from app env, so every send died in the workpool with "AGENTMAIL_API_KEY is not set" while notifications were marked sent. Declared the vars via a pnpm patch (`patches/@agentmail+convex@0.1.0.patch`) and forwarded the key by reference in `convex/convex.config.ts`. Removed the `/dashboard/emails` demo page and preview fixtures after sending all 8 templates to the owner's inbox as a real-client check (logo via absolute Convex storage URL).

### 2026-09-11 - working tree

Designed the 8 subscription notification emails as narrative letters (`src/emails/`: `RenewalEmail` 7d/3d/24h, `TrialEmail`, `CancelledEmail` auto/manual, `ReminderEmail`, `RequestSentEmail`) with a shared voice (`shared.tsx`: `NarrativeTitle`, inline links, single `MainButton` only where a charge is imminent, no merchant icons, we-voice, no em dashes) and adaptable subject lines (`subjects.ts`). Preview-only at `/dashboard/emails` via fixtures mirroring live subs plus `renderEmail.ts` choke point — live dispatch in `convex/notifications.ts` still uses the old inline copy; wiring the new templates to real sends is pending.

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
