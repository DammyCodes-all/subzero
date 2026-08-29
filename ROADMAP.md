# SubZero — Hackathon Build Roadmap & Status

This document tracks the core build status, completed phases, and remaining tasks for the **SubZero** hackathon project.

---

## 📊 Core Build Status

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | **AI Extraction Engine** (OpenAI / Groq structured JSON extraction & evidence linking) | **Complete** |
| **Auto-Ingestion** | **Email Forwarding & Webhooks** (AgentMail inbound pipeline + manual paste UI) | **Complete** |
| **Phase 2** | **Cancellation Research Engine** (Firecrawl help-page scraper + AI step extraction) | **Complete** |
| **Phase 3** | **Action Engine UI** (Dynamic CTAs for `open_web` & `send_email` modal) | **Complete** |
| **Phase 4** | **The Nudge Engine** (Scheduled `7d`/`3d`/`24h` warnings + daily cron sweep) | **Complete** |

---

## 🔮 What's Left Before Submission

### 1. Phase 5: Gmail API Historical Scan (Optional Ingestion Path)
- **Goal:** Allow users who click "Connect Google" to trigger a one-time historical scan of their last 30 days of Gmail messages for billing/subscription receipts.
- **Implementation Note:** Google Auth is already set up in Convex Auth. We can add a Convex action that queries the Gmail `messages.list` endpoint for `subject:receipt OR subject:subscription OR subject:renewal` and pipes discovered emails into our extraction engine.

### 2. Phase 6: Final Verification & Typecheck Audit
- **Goal:** Run `pnpm typecheck` to ensure 0 TypeScript errors across the entire codebase.

---

## 🎯 Next Steps & Recommendation

The core protection loop (Ingestion → Extraction → Research → Action Engine → Nudge Engine) is **100% functional**.

- **Option A:** Build **Phase 5 (Gmail API Scan)** to complete the final optional ingestion path from the product spec.
- **Option B:** Perform **Phase 6 (Final Verification Audit)** to lock in the submission.
