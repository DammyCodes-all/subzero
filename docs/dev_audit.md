# Multi-Email Account System — Security & Correctness Audit

Date: 2026-09-01
---

## Architecture Overview

```
User (users table)
  |-- userId: "abc123"
  |-- email: "alice@gmail.com"       (auth login email, 1 per user)
  |
  +-- Connection 1 (connections table)
  |     provider: "agentmail"
  |     agentmailInbox: "subzero-agent@agentmail.to"
  |     accountEmail: "alice@gmail.com"
  |
  +-- Connection 2 (connections table)
  |     provider: "google"
  |     accountEmail: "alice@gmail.com"
  |     gmailRefreshToken: "..."
  |
  +-- Connection 3 (connections table)          <-- MULTI-EMAIL
        provider: "google"
        accountEmail: "alice.work@company.com"  <-- different email
        gmailRefreshToken: "..."
```

### Inbound Email Routing Flow

```
AgentMail Webhook
  --> http.ts: POST /agentmail/inbound
    --> agentmail.resolveUserByInbox(inboxId, from, to)
      --> 1. Match by agentmailInbox index
      --> 2. If multiple matches, match by fromEmail -> accountEmail
      --> 3. Fallback: fromEmail -> accountEmail index (broad scan)
      --> 4. Fallback: fromEmail -> users.email (broad scan)
      --> 5. Fallback: single agentmail connection globally
    --> ingestion.process.processForwardedEmail
      --> normalize -> keyword filter -> LLM extract -> persist
```

### Nudge Delivery Flow

```
Cron (every 24h): sweepUpcomingNudges
  --> Find subscriptions renewing in 7 days
  --> For each: schedule notifications at 7d, 3d, 24h
    --> deliverNudge(notificationId)
      --> getNotificationDetails(notificationId)
        --> Query connections by userId (first row wins)
        --> Use that accountEmail as recipient
      --> POST https://api.agentmail.to/v1/messages/send
```

---

## Findings

### CRITICAL

#### C1. Nudge delivery sends to wrong email for multi-email users

**File:** `convex/notifications.ts:54-73`
**Function:** `getNotificationDetails`

The function resolves the recipient email by querying `connections` with `by_user` index and taking the **first row**. If a user has 3 connections, it picks whichever is first in creation order — not the email associated with the subscription.

**Scenario:**
- User connects `alice@gmail.com` (connection 1, created first)
- User connects `alice.work@company.com` (connection 2)
- Subscription detected from `alice.work@company.com` emails
- Nudge gets sent to `alice@gmail.com` — subscription owner may never see it

**Impact:** Users miss renewal reminders for subscriptions detected from their secondary emails. They get charged unexpectedly. Support tickets. Churn.

**Fix:** Store which connection/email a subscription was ingested from. Use that connection for nudge delivery instead of "first connection by userId."

---

#### C2. Shared inbox fallback silently routes to arbitrary user

**File:** `convex/agentmail.ts:166-170`
**Function:** `resolveUserByInbox`

When multiple users share the same `agentmailInbox` (the global `AGENTMAIL_INBOX` env), and `fromEmail` doesn't match any user's `accountEmail`, the function falls back to the **most recently created connection**. This silently routes another user's email to an arbitrary recipient.

**Scenario:**
- Shared inbox `subzero-agent@agentmail.to` has 50 users
- Email arrives from `unknown-sender@external.com` (not matching any `accountEmail`)
- Function picks the most recently created connection — sends someone else's subscription data to a random user

**Impact:** Privacy leak. User A sees User B's subscription data. Potential GDPR/compliance violation.

**Fix:** When inbox is shared and no `fromEmail` match is found, **reject the email** — return null, log an ingestion attempt with `status: "no_user"`. Never guess.

---

#### C3. Password signup silently merges into existing OAuth account

**File:** `convex/auth.ts:49-100`
**Function:** `createOrUpdateUser`

If a user with `alice@gmail.com` signed up via Google OAuth, and someone later tries to create a password account with the same email, `createOrUpdateUser` returns the existing user ID — **merging them into the same account** with no verification. The attacker now has password access to the OAuth-created account.

**Scenario:**
1. Alice signs up via Google OAuth with `alice@gmail.com` → gets account with Gmail access
2. Attacker goes to signup page, enters `alice@gmail.com` + password
3. `createOrUpdateUser` sees existing email, returns Alice's userId
4. Attacker now has password-based access to Alice's account

**Impact:** Account takeover. Attacker can access all subscriptions, connected Gmail data, and send cancellation requests.

**Fix:** Either:
- (a) Block password signup entirely if email exists via OAuth (require login with original provider)
- (b) Require email verification before linking/merging accounts across providers
- (c) Add `authProvider` field to users table and refuse cross-provider merges without verification

---

### HIGH

#### H1. Webhook signature verification is soft-ignored in production

**File:** `convex/http.ts:68-70`

On svix signature verification failure, the code logs a warning but **continues processing**. This was added as a hackathon demo bypass but is still active.

**Impact:** Anyone can POST forged emails to `/agentmail/inbound` and inject fake subscription data — fake cancellations, fake evidence, corrupted user dashboards.

**Fix:** Return 401 on verification failure. Gate the bypass behind `CONVEX_SITE` or `NODE_ENV !== "production"` so it only works in dev.

---

#### H2. No uniqueness constraint on `connections.accountEmail`

**File:** `convex/schema.ts` — `connections` table

Multiple connection rows can have the same `accountEmail` across different users. `getUserIdForEmail` (`connections.ts:12-19`) returns the first match — if two users somehow share an email, the second user's lookup silently gets the wrong userId.

**Impact:** Inbound emails routed to wrong user. Subscription data leaked. Nudges sent to wrong person.

**Fix:** Add a unique partial index on `connections.accountEmail` where `status = "connected"`. Add a guard in `gmail.storeByEmail` to check for existing email ownership before insert.

---

#### H3. Gmail `storeByEmail` doesn't check cross-user email ownership

**File:** `convex/gmail.ts:159-207`

`storeByEmail` checks if the **current user** already has a connection for the email. It does **not** check if a **different user** already owns that email. User B can connect an email already connected to User A, overwriting the refresh token.

**Scenario:**
1. User A connects `shared@company.com` via Gmail OAuth → refresh token stored
2. User B connects `shared@company.com` via Gmail OAuth → refresh token overwritten
3. User A's Gmail scans now fail. User B gets User A's subscription data.

**Impact:** Account data corruption. Potential privilege escalation via shared/corporate emails.

**Fix:** Before inserting in `storeByEmail`, query `by_accountEmail` for the email. If it exists with a different `userId`, reject with a clear error message.

---

### MEDIUM

#### M1. Cron nudge sweep doesn't know which email to deliver to

**File:** `convex/crons.ts` + `convex/notifications.ts:178-187`

The sweep finds all subscriptions renewing in 7 days and creates notification records. But the delivery path (`deliverNudge` -> `getNotificationDetails`) has no knowledge of which email the subscription was detected from. Multi-email users get reminders at whatever connection happens to be "first."

**Impact:** Same as C1 — missed reminders for secondary-email subscriptions.

**Fix (ties into C1):** Store source connection on subscription. Use it during nudge scheduling and delivery.

---

#### M2. `resolveUserByInbox` does O(n) table scans as fallback

**File:** `convex/agentmail.ts:205-231`

The broad scan queries `connections.take(100)` and `users.take(100)` to find email matches when indexed lookups fail. This is:
- O(n) and will miss users beyond the limit
- Gets worse as user base grows
- Silent data loss — no error, just "user not found"

**Impact:** Emails silently dropped as user count exceeds 100. Routing failures become harder to diagnose.

**Fix:** Remove broad scans. Rely exclusively on indexed lookups (`by_accountEmail`, `by_agentmailInbox`). If no indexed match is found, return null. Add logging for unmatched emails.

---

#### M3. `users.email` is stale for multi-email users

**File:** `convex/schema.ts` — `users` table

`users.email` stores the auth login email. But connected emails live in `connections.accountEmail`. Any code path that reads `user.email` as the "contact email" gets potentially stale data — especially if the user's primary email changed after account creation.

**Impact:** Display issues. Wrong email in UI. Potential fallback to stale email in edge cases.

**Fix:** Make `users.email` explicitly the "auth/primary" email. Add a `primaryConnectionId` field or a clear convention: "all email-sending code reads from `connections`, never from `users.email` directly."

---

### LOW

#### L1. No uniqueness constraint on `connections.accountEmail` at DB level

Relies entirely on application logic to prevent duplicate connections. Race conditions during Gmail OAuth callback could create two rows for the same email+user pair.

**Fix:** Add a unique compound index on `(userId, accountEmail)` or a partial unique index on `accountEmail` where `status = "connected"`.

---

#### L2. Cancellation emails don't consider source email context

**File:** `convex/agentmail.ts:247-309`
**Function:** `sendCancellationEmail`

When sending a cancellation request via email, the function uses the user's AgentMail alias regardless of which email the subscription was detected from. If a subscription came from a work email, the cancellation request should ideally come from (or be aware of) that context.

**Impact:** Minor UX issue. Cancellation emails may come from an unexpected address.

**Fix:** Store source email on subscription. Optionally use it as the "from" address or include it in the cancellation email body for user awareness.

---

#### L3. Ingestion attempts don't track source connection

**File:** `convex/schema.ts` — `ingestionAttempts` table

The `ingestionAttempts` table stores `userId`, `inboxId`, `from`, `subject`, etc. — but no `connectionId` or `sourceEmail` field. This makes debugging multi-email routing issues harder. You can't easily trace "this email came from which connection?"

**Impact:** Operational blind spot. Harder to debug misroutes.

**Fix:** Add `connectionId` or `sourceEmail` to `ingestionAttempts`. Populate it during the routing step in `resolveUserByInbox`.

---

## Fix Roadmap

### Phase 1 — Security (do first)

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 1 | Return 401 on svix failure in production | `convex/http.ts` | Small |
| 2 | Block cross-user email hijacking in Gmail OAuth | `convex/gmail.ts` | Small |
| 3 | Require verification before merging accounts across providers | `convex/auth.ts` | Medium |

### Phase 2 — Nudge Correctness

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 4 | Add `sourceConnectionId` to `subscriptions` table | `convex/schema.ts`, `convex/ingestion/persist.ts` | Medium |
| 5 | Update `getNotificationDetails` to use subscription's source connection | `convex/notifications.ts` | Small |
| 6 | Update `deliverNudge` to send to correct email | `convex/notifications.ts` | Small |

### Phase 3 — Routing Robustness

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 7 | Remove `.take(100)` broad scans from `resolveUserByInbox` | `convex/agentmail.ts` | Small |
| 8 | Reject unmatched shared-inbox emails | `convex/agentmail.ts` | Small |
| 9 | Add routing decision logging | `convex/agentmail.ts`, `convex/ingestionAttempts.ts` | Small |

### Phase 4 — Data Model Cleanup

| # | Fix | Files | Effort |
|---|-----|-------|--------|
| 10 | Add unique partial index on `connections.accountEmail` | `convex/schema.ts` | Small |
| 11 | Track source email on `ingestionAttempts` | `convex/schema.ts`, `convex/ingestion/process.ts` | Small |
| 12 | Add `primaryConnectionId` to users or document convention | `convex/schema.ts` | Small |
