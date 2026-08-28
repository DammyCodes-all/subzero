# Hackathon log

- **Project:** subzero
- **Event:** Convex All Gas Hackathon
- **What it does:** AI subscription protection assistant — finds subscriptions, warns before renewals, and researches verified cancellation routes with evidence.
- **Live app:** not deployed
- **Repo:** none
- **Frontend:** Convex static hosting
- **Convex deployment:** https://aromatic-quail-684.convex.cloud
- **Components:** none
- **Convex features:** schema, tables, indexes, auth
- **Auth:** Convex Auth
- **AI models:** none
- **Started:** 2026-08-28T08:01:06Z
- **Last updated:** 2026-08-28T09:02:33Z

## Log

### 2026-08-28 - working tree
Set up subzero project scaffolding inside dev folder. Initialized hackathon build log, global Convex skills and MCP server, and project-local hackathon skill. No app features yet.

### 2026-08-28 - working tree
Provisioned Convex dev deployment aromatic-quail-684, pushed schema (connections, subscriptions, evidence, cancellationActions, notifications) with indexes, installed Convex Auth with Google provider, and AI files (`convex/_generated/ai/guidelines.md`, `AGENTS.md`, `CLAUDE.md`). Added Firecrawl and AgentMail (subzero-agent) to Convex env. Convex features: schema, tables, indexes, auth (`convex/schema.ts`, `convex/auth.ts`, `convex/auth.config.ts`).
