# SubZero — End-to-End Testing Roadmap & Verification Guide

This document outlines the step-by-step procedures, expected outcomes, and verification criteria for testing all core features of **SubZero** end-to-end.

---

## 📋 End-to-End Test Matrix

| # | Feature | Test Target | Primary Verification Method |
|---|---|---|---|
| 1 | **Auth & Identity Persistence** | Convex Auth / `getAuthUserId` | Login, reload, verify single `connections` record |
| 2 | **Inbound Forwarding Pipeline** | AgentMail Webhook (`/agentmail/inbound`) | Forward receipt email, check Convex logs & DB |
| 3 | **AI Extraction Engine** | Groq / OpenAI Structured Parser | Paste raw receipt text via UI modal |
| 4 | **Cancellation Research Engine** | Firecrawl Help Scraper + AI Parser | Automatic background run on sub creation |
| 5 | **Action Engine UI** | Cancellation CTAs & Modals | Click Cancel CTA, inspect instructions & state |
| 6 | **The Nudge Engine** | Reminders (`7d`/`3d`/`24h`) & Daily Cron | Check `notifications` table & trigger `deliverNudge` |
| 7 | **Gmail Historical Scan** | Gmail API Search & Ingestion | Click "Scan Gmail" button from dashboard |

---

## 🧪 Detailed Test Procedures & Expected Outcomes

### Test 1: Authentication & Persistent User Identity
- **Goal:** Verify that logging in across multiple sessions binds data to a single canonical user ID without creating duplicate `connections` rows.
- **Steps:**
  1. Open the app and click **Sign In** using Google OAuth.
  2. Open the **Convex Dashboard** $\rightarrow$ **Data Explorer** $\rightarrow$ `connections` table.
  3. Log out and log back in, or open the app in a new browser tab.
  4. Inspect the `connections` table again.
- **Expected Outcome:**
  - Only **one** `connections` row exists for `provider: "agentmail"`.
  - `accountEmail` contains the user's email address.
  - `userId` uses the canonical format (e.g. `kh7f5sh...`), avoiding duplicate rows on new sessions.

---

### Test 2: Inbound Email Forwarding Pipeline (AgentMail)
- **Goal:** Verify that forwarding a subscription receipt to the AgentMail inbox creates a real-time subscription and evidence record.
- **Steps:**
  1. Forward a real or sample subscription receipt email (e.g., Netflix, Spotify, Adobe, ChatGPT) to your AgentMail address (e.g., `truella@agentmail.to` or `subzero-agent@agentmail.to`).
  2. Open **Convex Dashboard** $\rightarrow$ **Logs**.
  3. Refresh the SubZero Dashboard UI.
- **Expected Outcome:**
  - Convex logs show:
    ```text
    [ingestion] Resolving user: inboxId=...
    [ingestion] Resolved userId: <canonical_user_id>
    [extract] Provider: Groq (or OpenAI) ...
    [ingestion] Persisting: merchant="...", price=...
    ```
  - A new active subscription appears instantly on the SubZero Dashboard UI without manual page refresh.
  - An entry is inserted into the `evidence` table linked to the subscription.

---

### Test 3: Manual Email Scan & AI Extraction Engine
- **Goal:** Verify structured JSON extraction for merchant, amount, currency, and renewal interval via the UI.
- **Steps:**
  1. On the SubZero Dashboard, click the **Scan Email / Paste Receipt** button.
  2. Paste sample receipt text:
     > *"Thank you for your purchase! Your monthly subscription to Notion Plus for $10.00 USD has been renewed. Your next billing date is September 30, 2026."*
  3. Click **Extract Subscription**.
- **Expected Outcome:**
  - UI displays an extraction preview card showing:
    - **Merchant:** Notion (or Notion Plus)
    - **Price:** $10.00 USD
    - **Billing Interval:** Monthly
    - **Status:** Active
  - Subscription card is added to the main list.

---

### Test 4: Automatic Cancellation Research Engine (Firecrawl)
- **Goal:** Verify that creating a subscription automatically triggers Firecrawl help page scraping and populates cancellation instructions.
- **Steps:**
  1. Add a subscription for a common service (e.g., **Adobe** or **Canva**).
  2. Open **Convex Dashboard** $\rightarrow$ **Logs** to observe background scheduler.
  3. Inspect the subscription card on the SubZero Dashboard after 5–10 seconds.
- **Expected Outcome:**
  - Background scheduler runs `internal.research.researchCancellationRoute`.
  - Firecrawl searches the web for cancellation pages.
  - The subscription record is updated with:
    - `cancellationMethod`: `open_web` or `send_email`
    - `cancellationDifficulty`: `medium` / `high` / `low`
    - `cancellationUrl`: Direct link to merchant account management.
  - A new evidence document with `sourceType: "firecrawl"` is inserted.

---

### Test 5: Action Engine UI (Cancellation Execution)
- **Goal:** Verify interactive cancellation modal and status transitions.
- **Steps:**
  1. Click **Cancel Subscription** on any active subscription card.
  2. Review the step-by-step instructions and difficulty pill displayed in the modal.
  3. Click the external link (for `open_web`) or copy draft email (for `send_email`).
  4. Click **Confirm Cancellation**.
- **Expected Outcome:**
  - Modal opens smoothly with step-by-step bullet points.
  - Subscription status changes to `cancelled` in the database and UI.
  - Total monthly/yearly savings on dashboard header update reactively.

---

### Test 6: The Nudge Engine (Scheduled Renewal Warnings & Crons)
- **Goal:** Verify milestone notification scheduling (`7d`, `3d`, `24h`) and outbound delivery.
- **Steps:**
  1. Open **Convex Dashboard** $\rightarrow$ **Data Explorer** $\rightarrow$ `notifications` table after creating a subscription with a `nextRenewalAt` date.
  2. Observe the scheduled notification rows.
  3. (Optional) Run `internal.notifications.deliverNudge` manually from the Convex dashboard for a pending notification.
- **Expected Outcome:**
  - Three notification documents exist in `notifications` table with statuses `pending`.
  - Invoking `deliverNudge` sends an outbound email alert via AgentMail containing:
    - Merchant name & price.
    - Days remaining until renewal.
    - Direct cancellation link CTA.
  - Notification status updates to `sent`.

---

### Test 7: Gmail Historical Scan
- **Goal:** Verify scanning past emails via Gmail API.
- **Steps:**
  1. Ensure Google OAuth is connected with `gmail.readonly` scope.
  2. Click **Scan Gmail** on the dashboard.
  3. Observe scan progress indicator.
- **Expected Outcome:**
  - The action returns a summary object:
    ```json
    {
      "scanned": 15,
      "created": 2,
      "merged": 1,
      "skipped": 12,
      "duplicate": 0
    }
    ```
  - Discovered subscriptions appear in the UI bound to your user account.

---

## 🎯 Verification Checklist

- [ ] `npx tsc --noEmit` runs clean with **0 errors**.
- [ ] User login creates **1 persistent connection record**.
- [ ] Inbound email forwarding extracts merchant & price and reflects live in UI.
- [ ] Research pipeline populates cancellation URL and difficulty automatically.
- [ ] Cancel modal transitions subscription status to `cancelled`.
- [ ] Scheduled renewal notifications populate in `notifications` table.
