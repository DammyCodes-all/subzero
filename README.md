# SubZero

> Finds your subscriptions before they charge you, and shows the verified way out.
> Built for the **Convex All Gas Hackathon** (OpenAI + Firecrawl + AgentMail).

- **Live app:** https://elated-oriole-157.convex.site
- **Demo video (<3 min):** PASTE_YOUTUBE_URL_HERE
- **Repo:** https://github.com/DammyCodes-all/subzero
- **Build log:** [hackathon.md](./hackathon.md)

## The problem

Trials turn into charges while you aren't looking. Receipts hide in Gmail, renewals sneak up, and cancelling is rarely one click. Sometimes it's seven screens deep in a merchant portal. Sometimes you're billed through Google Play and standing in the wrong settings page entirely.

SubZero finds the subscriptions, watches every renewal and trial date, and hands you the cancellation steps with quotes from the merchant's own help docs.

## What it does

Connect Gmail and SubZero scans for receipts with a backfill that drains in seconds, not hours. Prefer not to connect anything? Forward receipts to your AgentMail inbox, or paste one in manually and check the AI's extraction before saving.

From there it watches the dates. Renewal and trial warnings go out at 7 days, 3 days, and 24 hours, with a daily sweep catching anything the scheduler missed.

Each subscription gets its cancellation route researched: help-center search and page scrapes through Firecrawl, steps and difficulty synthesized from the results, quotes stored with their source URLs. Depending on the merchant you get a direct link, a provider redirect, a drafted email you can send, or plain support steps. The status moves from `action_ready` to `user_started` to `cancellation_pending` to `cancelled`, so you can see where things stand.

## Sponsor stack

| Sponsor | Role | Implementation |
|---|---|---|
| OpenAI | Receipt extraction and cancellation synthesis over the Chat Completions interface. Groq-first provider chain with OpenRouter and OpenAI `gpt-4o-mini` fallbacks, rotation across keys, backoff on rate limits, one JSON repair retry, usage logging. | `convex/lib/llm.ts`, `convex/lib/aiModels.ts`, `convex/ingestion/extract.ts`, `convex/research.ts` |
| Firecrawl | Official `@firecrawl/firecrawl-convex` component. Help-center search plus page scrapes per subscription, paced with jitter, cached 30 days, refreshable from the UI. | `convex/lib/firecrawl.ts`, `convex/research.ts`, `convex/researchCache.ts` |
| AgentMail | Official `@agentmail/convex` component. Per-user forwarding inbox with a verified inbound webhook. Outbound sends go through the component queue with retries, and delivery status is a live query. | `convex/lib/agentmail.ts`, `convex/agentmail.ts`, `convex/notifications.ts`, `convex/http.ts` |

## Convex depth

Thirteen tables with per-user, dedup, renewal, and trial indexes (`convex/schema.ts`). Realtime queries, mutations, and actions across `src/`. Nudges run on the scheduler with cron sweeps behind them (`convex/notifications.ts`, `convex/crons.ts`). Webhooks and OAuth over HTTP (`convex/http.ts`), Google sign-in through Convex Auth, three registered components (`convex/convex.config.ts`).

The boring reliability parts are there too. Ingestion is idempotent, Gmail backfill resumes where it stopped, research retries into a cache, and deleted subscriptions leave tombstones so the next scan can't resurrect them.

## Tech stack

- Backend: Convex 1.45 (database, functions, sync, scheduler, crons, auth, components)
- Frontend: Next.js 16 static export, React 19, Tailwind CSS 4, Hugeicons only
- Auth: Convex Auth (`@convex-dev/auth`) with Google
- Email rendering: react-email
- Tests: Vitest — 29 passing across 9 files

## Getting started

Judges: use the live app above. Local dev:

```bash
pnpm install
npx convex dev      # terminal 1
pnpm dev            # terminal 2
```

### Convex env (deployment dashboard or `npx convex env set`)

```bash
GROQ_API_KEY="gsk_..."               # primary extraction/research
GROQ_API_KEY_2="gsk_..."             # optional extra org bucket
GROQ_API_KEY_3="gsk_..."             # optional extra org bucket
OPENROUTER_API_KEY="..."             # fallback
OPENAI_API_KEY="sk-..."              # OpenAI gpt-4o-mini fallback
FIRECRAWL_API_KEY="fc-..."
AGENTMAIL_API_KEY="am_..."
AGENTMAIL_WEBHOOK_SECRET="whsec_..."
SITE_URL="https://elated-oriole-157.convex.site"
CONVEX_SITE_URL="https://elated-oriole-157.convex.site"
```

### Local `.env.local`

```env
NEXT_PUBLIC_CONVEX_URL="https://<deployment>.convex.cloud"
NEXT_PUBLIC_CONVEX_SITE_URL="https://<deployment>.convex.site"
```

## Testing the flows

- **Manual paste:** Subscriptions header → manual add → Extract → editable preview → Save. Fastest way to see the full loop without connecting Gmail.
- **Gmail:** Connect Gmail → watch per-connection progress drain fast.
- **Forwarding:** forward any receipt to your AgentMail inbox → ingested with evidence.
- **Research:** open any subscription → Firecrawl quotes, difficulty, steps, Refresh research (10-min cooldown).
- **Send:** `send_email` subscriptions → Review & send → real AgentMail delivery.
- **Checks:** `pnpm check` (typecheck + biome + vitest).

## Project structure

- `convex/` — schema, ingestion, extraction, research, notifications, gmail, agentmail, http, crons
- `convex/lib/` — llm chain, firecrawl, agentmail, dedup, difficulty, email templates
- `src/` — Next.js app, dashboard, subscriptions, emails, hooks
- `tests/` — 9 vitest suites
- `hackathon.md` — evidence-backed build log judges read
