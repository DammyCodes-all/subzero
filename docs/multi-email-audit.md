# Multi-Email Connection Audit

> Date: September 1, 2026
> Scope: Connecting multiple Gmail accounts to one user, email forwarding, cron/reminders, signup guards

---

## Background

Users can now connect more than one Gmail account to a single SubZero account. This audit covers the correctness of Gmail scanning, email forwarding routing, notification delivery, and signup flows under this new multi-email model.

---

## Critical Issues

### 1. Gmail scan only scans the first connection

**File:** `convex/gmail.ts` — `getConnectionInternal`
**File:** `convex/gmailActions.ts` — `scanGmail`

`getConnectionInternal` queries all connections for a user but returns only the **first** Google connection via `rows.find((c) => c.provider === "google")`. `scanGmail` then uses this single connection to authenticate with Gmail and scan messages.

**Impact:** If a user connects Gmail A and Gmail B, pressing "Scan Now" only scans Gmail A. Gmail B is silently ignored. Subscriptions in the second inbox are never discovered.

**Fix:** `getConnectionInternal` should return **all** Google connections. `scanGmail` should iterate over each connection, authenticate separately (each has its own refresh token), and scan all inboxes. Deduplication via `dedupKey` already prevents duplicate subscriptions.

---

### 2. Notifications sent to wrong email

**File:** `convex/notifications.ts` — `getNotificationDetails`

When delivering a renewal nudge, the system resolves the recipient email by querying the **first** connection for the user:

```ts
const conn = await ctx.db
  .query("connections")
  .withIndex("by_user", (q) => q.eq("userId", notif.userId))
  .first();
return { userEmail: conn?.accountEmail ?? null };
```

With multiple connections, this returns whichever connection is first in the DB — not necessarily the email associated with the subscription.

**Impact:** A subscription from Gmail B could get renewal reminders sent to Gmail A's address. The user misses the alert on the email that actually matters.

**Fix options:**
- Store a `sourceEmail` on the subscription record (which inbox it came from) and use that as the notification recipient.
- Or send the nudge to **all** connected emails (simplest, but noisy).
- Or let the user set a preferred notification email in settings.

---

### 3. No duplicate-email guard on signup

**File:** `convex/auth.ts` — `createOrUpdateUser`

The auth system links accounts by email: same email -> same user. But there is no check preventing User A from creating an account with `work@company.com` if that email is already connected as a Gmail account to User B.

**Impact:** Two different users now "own" the same email in different ways — one as their sign-in email, the other as a connected Gmail inbox. This can cause confusion in forwarding resolution, notifications, and data ownership.

**Fix:** During `createOrUpdateUser`, after finding a new email, query the `connections` table for `accountEmail === emailNorm`. If a match exists under a **different** userId, block the signup and prompt the user to sign in to the existing account instead.

---

### 4. disconnectGmail disconnects ALL connections at once

**File:** `convex/gmail.ts` — `disconnectGmail`

`disconnectGmail` finds **every** Google connection for the authenticated user and sets all of them to `status: "disconnected"`. There is no parameter to target a specific connection.

**Impact:** User connects Gmail A and B, then wants to remove B. They click "Disconnect" — both A and B get disconnected. There is no way to disconnect just one.

**Fix:** Add an optional `connectionId` argument to `disconnectGmail`. If provided, disconnect only that connection. If omitted (backward compat), disconnect all.

---

## Design Issues

### 5. AgentMail inbox is global, not per-user

**File:** `convex/agentmail.ts` — `getOrCreateInbox`, `resolveUserByInbox`

The forwarding inbox is a shared address (`subzero-agent@agentmail.to`) for all users. When an email arrives, `resolveUserByInbox` tries to figure out which user it belongs to by matching the `from` address against `connections.accountEmail`. When it can't match, it falls back to:
- The most recently created connection
- The single agentmail connection (if only one exists globally)

**Impact:** With many users, the fallback heuristics become unreliable. A forwarded email from an unrecognized address could be routed to the wrong user.

**Mitigation (low priority for now):** This is acceptable for small scale. For production, consider per-user AgentMail inboxes or stricter `from`-address matching with explicit user confirmation.

---

### 6. Forwarding alias is one address for all connected emails

**File:** `src/components/ForwardingCard.tsx`

`ForwardingCard` displays a single forwarding address. Users with multiple Gmail accounts need to set up forwarding rules in **each** Gmail account to forward to this same address. There is no per-email guidance, no verification that forwarding is configured, and no way to confirm which emails are actually forwarding.

**Impact:** Users may connect Gmail B but forget to set up forwarding in Gmail B's settings. They think both inboxes are being monitored, but only Gmail A forwards emails.

**Mitigation:** Show a per-connection status indicator (e.g., "Forwarding configured: Yes/No") or a setup checklist per connected email.

---

### 7. DedupKey is email-agnostic

**File:** `convex/lib/dedup.ts`

The deduplication key is based on `merchant + product + billingProvider + price + currency`. It does not include any email-source information.

**Impact:** If the same receipt arrives from both Gmail A and Gmail B (e.g., user forwarded the same email from both accounts), the second is treated as a duplicate. This is arguably correct (no duplicate subscription), but it means the system cannot track which email source a subscription originated from — which matters for notification routing (see Issue #2).

**Fix (ties into Issue #2):** Add a `sourceEmail` field to the subscriptions table. Use it for notification routing. The dedupKey can remain email-agnostic (same subscription = one record), but the source email is preserved.

---

### 8. Scan cooldown is per-connection, but UI has one button

**File:** `convex/gmailActions.ts` — `scanGmail`
**File:** `src/components/connections/ConnectionsView.tsx`

The cooldown check (`lastGmailScanAt`) is stored per-connection. But the UI has a single "Scan Now" button that triggers `scanGmail`, which (after Issue #1 fix) would scan all connections. The cooldown is checked against only one connection's timestamp.

**Impact:** If Gmail A was scanned 5 minutes ago but Gmail B was never scanned, the cooldown on A blocks scanning B too (once Issue #1 is fixed and scan iterates all connections).

**Fix:** Check cooldown per-connection during the scan loop. Skip connections that are on cooldown, scan the rest. Or move to a global per-user cooldown.

---

## What Already Works

| Area | Status |
|---|---|
| `storeByEmail` inserts separate rows per email | Fixed in this session |
| `getMyConnections` returns all connections | Works correctly |
| `resolveUserByInbox` routes forwarded emails | Reasonable fallback logic |
| Auth deduplicates users by email | Same email -> one user |
| DedupKey prevents duplicate subscriptions | Works correctly |

---

## Suggested Fix Priority

| Priority | Issue | Effort |
|---|---|---|
| **P0** | #1 — Scan only first connection | Medium |
| **P0** | #2 — Notifications to wrong email | Medium |
| **P1** | #3 — No signup guard for connected emails | Low |
| **P1** | #4 — Disconnect all at once | Low |
| **P2** | #7 — DedupKey missing source email | Low |
| **P2** | #8 — Cooldown blocks all connections | Low |
| **P3** | #5 — Global AgentMail inbox | High (infra) |
| **P3** | #6 — No per-email forwarding verification | Medium (UI) |
