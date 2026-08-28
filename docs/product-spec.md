# SubZero — Product Spec

SubZero finds your subscriptions before they charge you, and figures out how to get out.

Not a tracker that lists what you pay. A heads-up that tells you what needs attention this week and the exact steps to cancel.

## The problem

People don’t lose money because they love Netflix. They lose it because trials turn into charges while they’re not looking.

Subscriptions live everywhere — inbox, Apple, Google Play — renewals sneak up, and canceling is rarely one click. Sometimes it’s seven screens in a merchant portal. Sometimes it’s hidden in a help doc. Sometimes you’re on the wrong site entirely because you’re billed through a provider and didn’t know.

The real friction isn’t remembering you have subscriptions. It’s knowing which one renews when, and what you actually have to do to stop it.

## What SubZero does

SubZero pulls subscription info together, watches renewal dates, and researches each merchant’s current cancellation path so you see a clear next step before the charge hits.

Tracker versus SubZero:

- Tracker: here’s everything you have
- SubZero: here’s the two that need you this week, and here’s how to cancel each one

## How subscriptions get in

Three ways, one object after.

**1. Gmail (main path)**
You connect Google, SubZero scans for receipts and trial emails, an OpenAI pass picks out real subscriptions, and they show up. No manual list of fifteen services.

Example empty state becomes: “We found 8 subscriptions — $127.96 coming up — 2 need you this week.”

**2. Forwarding**
Don’t want Gmail connected, or we missed something? Forward the email to your SubZero address (AgentMail). It goes through the same extraction.

**3. Manual**
Upload a receipt or type details. Fallback, not the default.

Internally they all become the same Subscription. The rest of the system doesn’t care where it came from.

```
Gmail ─┐
AgentMail ─┤→ Ingestion → Subscription
Upload ─┘
```

## Auth

Google OAuth for SubZero identity. Gmail access is separate.

Convex handles the backend side, but it can’t bypass Google’s Gmail verification. So we ask for the minimum, explain why, and let people disconnect. For the hackathon we’ll prove the flow with test users first before assuming production scopes will pass review.

## When an email lands

OpenAI pulls structured fields — merchant, product, price, currency, interval, trial end, next renewal, billing provider, account hint.

Then we don’t trust it alone. Every important field keeps evidence. If we say you renew September 3, you see:

> Renews Sep 3, 2026 — Source: Adobe email “Your trial ends September 3, 2026 and your plan will renew…”

If we can’t back it, we don’t show it.

## Same subscription, many emails

One subscription can send trial started, reminder, receipt, and cancellation confirmation. SubZero merges them. We match on merchant normalization plus amount and dates, update the existing record instead of creating five copies.

## Data shape

We split things so evidence and actions stay inspectable.

- **User** — who owns the account
- **Connection** — Google/AgentMail link and token status
- **Subscription** — merchant, product, price, currency, interval, status, trialEndsAt, nextRenewalAt, difficulty, method, cancellationUrl, billingProvider
- **Evidence** — source, sourceType, excerpt, url/messageId, confidence, retrievedAt
- **Cancellation Action** — type, status, instructions, draft, execution time
- **Notification** — scheduled reminder and delivery status

That gives a clean chain: what we know → why we believe it → what you can do → what we told you.

## What Firecrawl does

After we know the merchant, Firecrawl looks for the current help page — how to cancel, where renewal terms live, refund wording, where account management sits. OpenAI turns that into structured steps, but the page is kept as evidence.

We don’t want “AI says it’s hard.” We want:

> High friction — 7 steps, login required, multiple confirmations — Source: Adobe’s cancellation help page (dated)

## Cancel is not “send email”

SubZero picks the right kind of action. Six types, no guessing:

- **OPEN_WEB** — cancel on the merchant site. Button says Open cancellation.
- **OPEN_PROVIDER** — you pay Apple/Google/Amazon, you have to cancel there. “Billed through Google Play — Open Google Play.”
- **SEND_EMAIL** — merchant actually accepts email cancellation. Button says Review & send, sent via AgentMail.
- **CONTACT_SUPPORT** — you have to talk to support. Button says Contact support.
- **MANUAL** — we know the steps but can’t automate: Settings → Account → Subscription → Cancel.
- **UNKNOWN** — we couldn’t verify a current path, so we say so. Never invent a route.

That last one matters. If we aren’t sure, we say unknown.

## How hard is it to cancel

Not an arbitrary score. We look at what’s observable: how many steps, whether you need to log in, whether a provider is involved, whether support is required.

- Low — direct, few steps
- Medium — a few screens and confirmations
- High — many steps or provider detour or support
- Very High — phone/support or no self-serve path we could verify

We show why, not just the label.

## What it looks like

Adobe Creative Cloud — $54.99/mo — renews in 2 days — High — 7 steps. Steps 1–4 listed, evidence shows Adobe email plus Adobe policy, button says Open cancellation.

ChatGPT Plus — $20/mo — renews in 6 days — “Billed through Google Play. You need to cancel there.” — button says Open Google Play.

Same system, different CTA because the situation is different.

## Status doesn’t stop at “here’s how”

```
active → action ready → user started → pending → cancelled
                                         ↘ failed
```

If a confirmation email arrives, we pick it up and close the loop. Subscription detected → renewal → researched → you act → confirmation → SubZero marks cancelled.

## How AgentMail fits

It’s both ways.

Inbound — you forward receipts to subzero-agent@agentmail.to.

Outbound — SubZero sends renewal nudges, action reminders, and cancellation emails or confirmations. So AgentMail is the product’s mail layer, not just an inbox.

## Where Convex sits

Convex isn’t just storage. Subscriptions live there, the dashboard is realtime, and scheduled checks live there too. Renewal in 7 days → Convex schedules a reminder → 3 days → AgentMail → 1 day → AgentMail. Same place tracks action state.

## Privacy

We ask for the least Gmail access we can, don’t copy your whole inbox, and keep only what the feature needs. You can disconnect Google, and later delete subscriptions, evidence, uploads, drafts, and notification history. Permissions and data use should be obvious, not buried.

## Dashboard

Not a finance dashboard. No budgets, net worth, or giant charts. It answers one question: what needs your attention?

Top: Needs attention — Adobe $54.99 in 2 days (red), Canva $15 in 6 days (yellow).
Below: All subscriptions — flat list.

## Nudges

Through AgentMail, roughly 7 days, 3 days, 24 hours, then after. “Renews tomorrow” when it matters, “Cancelled” when it’s done. Users will be able to tune this later.

## What we are not building

- Bank connections
- Logging into merchant accounts for you
- One-click browser automation to cancel
- Phone calls or refund negotiation
- Full budgeting or legal advice
- Auto-cancel without you confirming

SubZero finds the right route. You do the sensitive part. That keeps it safer and actually shippable.

## How it flows end to end

You → Google auth → email comes in (Gmail/AgentMail/upload) → OpenAI extracts → dedup → Convex stores → Firecrawl researches → OpenAI structures → evidence attached → action engine picks WEB/PROVIDER/EMAIL/SUPPORT/MANUAL/UNKNOWN → you act → confirmation updates Convex → AgentMail notifies.

## First run we’ll demo

Landing: SubZero, “Your subscriptions shouldn’t surprise you,” Find my subscriptions → Connect Google → Scanning → “We found 8 — $127.96 upcoming — 2 need you this week” → Adobe card, high friction, see how to cancel → evidence → Open cancellation.

If that path is solid, the rest is product work.

## Biggest risk before polish

Three things to prove early, with mocks first so Gmail verification doesn’t block us:

1. Gmail (or fixture) → OpenAI → Convex dedup → stored
2. Firecrawl returns a usable cancellation page for a few real merchants
3. AgentMail sends and receives

Get those three moving and the demo holds.

## In one line

SubZero finds your subscriptions, warns you before they renew, and shows the verified way to cancel before you’re charged.
