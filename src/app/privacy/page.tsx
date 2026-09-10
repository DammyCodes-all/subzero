import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_LAST_UPDATED,
  LegalBody,
  LegalLayout,
  LegalList,
  LegalNote,
  LegalSection,
} from "@/components/marketing/legal";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { PRIVACY_SECTIONS } from "./sections";

export const metadata: Metadata = {
  title: "Privacy Policy — SubZero",
  description:
    "How SubZero handles your Gmail data, what we store, what we never touch, and how to disconnect or delete everything.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <LegalLayout
        eyebrow="Legal"
        title="Privacy Policy"
        intro="SubZero exists to read as little of your inbox as possible. This policy explains exactly what we access, what we store, what we never touch, and how you take it all back."
        updated={LEGAL_LAST_UPDATED}
        sections={PRIVACY_SECTIONS}
      >
        <LegalBody>
          <LegalSection id="overview" title="1. Overview">
            <p>
              SubZero finds your subscriptions from receipts and trial emails,
              warns you before renewals, and researches how to cancel each one.
              To do that we need{" "}
              <strong>limited, read-only access to parts of your inbox</strong>{" "}
              — nothing more.
            </p>
            <LegalNote title="The short version">
              <p>
                We ask for Gmail <strong>read-only</strong> access, search only
                for billing-related mail, and store only the{" "}
                <strong>subscription facts plus a short quote</strong> that
                proves each one. We never copy your whole inbox, never see your
                bank or card numbers, and never log in to your merchant
                accounts. Disconnect any time from your dashboard — deleting
                your data also disconnects Gmail automatically.
              </p>
            </LegalNote>
          </LegalSection>

          <LegalSection id="data-we-collect" title="2. Data we collect">
            <p>What we hold depends on how you use SubZero:</p>
            <LegalList>
              <li>
                <strong>Account.</strong> Name, email address, and profile photo
                when you sign in with Google or with email and password.
              </li>
              <li>
                <strong>Gmail connection.</strong> The connected Gmail address,
                an OAuth refresh token, whether the Gmail scope was granted, and
                sync state (last scan time, inbox watch cursor). Tokens are
                stored server-side in our database, never in your browser.
              </li>
              <li>
                <strong>Subscriptions.</strong> Merchant, product, price,
                currency, billing interval, status, trial end and next renewal
                dates, cancellation difficulty and method, merchant or provider
                URL, billing provider (e.g. Google Play), and which inbox it was
                detected from.
              </li>
              <li>
                <strong>Evidence excerpts.</strong> A short quote (up to ~10,000
                characters) from the receipt or help page that backs each
                subscription fact, plus its source label, message reference,
                confidence score, and retrieval time. We store the excerpt — not
                the full email body.
              </li>
              <li>
                <strong>Forwarded and uploaded mail.</strong> If you forward a
                receipt to your SubZero inbox address or upload one, we process
                that message the same way and keep the same
                subscription-plus-excerpt records.
              </li>
              <li>
                <strong>Cancellation activity.</strong> The researched action
                type, its status, step-by-step instructions, and any
                cancellation email draft you review before sending.
              </li>
              <li>
                <strong>Reminders.</strong> Scheduled renewal nudges (7 days, 3
                days, 24 hours, confirmation), their delivery status, and your
                notification preferences.
              </li>
              <li>
                <strong>Scan history.</strong> Sender and subject metadata for
                messages we looked at, and whether each became a new
                subscription, a merge, a duplicate, or was skipped. This is how
                we avoid re-processing the same mail.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="gmail-access" title="3. Gmail access, in detail">
            <p>
              Connecting Gmail is optional, but it is the main way SubZero finds
              subscriptions. Here is exactly what that connection does:
            </p>
            <LegalList>
              <li>
                <strong>Scopes.</strong> Sign-in requests{" "}
                <code className="font-mono text-sm text-foreground">
                  openid email profile
                </code>{" "}
                plus{" "}
                <code className="font-mono text-sm text-foreground">
                  gmail.readonly
                </code>
                . The separate inbox connection requests{" "}
                <code className="font-mono text-sm text-foreground">
                  gmail.readonly
                </code>
                ,{" "}
                <code className="font-mono text-sm text-foreground">
                  userinfo.email
                </code>
                , and{" "}
                <code className="font-mono text-sm text-foreground">
                  userinfo.profile
                </code>
                . Read-only means SubZero can read matching messages — it cannot
                send, delete, or modify anything in your Gmail.
              </li>
              <li>
                <strong>Narrow search.</strong> We query only your inbox for
                billing-related mail — roughly{" "}
                <code className="font-mono text-sm text-foreground">
                  subject:(receipt OR invoice OR trial OR renewal OR
                  subscription) in:inbox
                </code>{" "}
                over the last 90 days — plus a 7-day inbox fallback when our
                update cursor expires. Everything else is never listed.
              </li>
              <li>
                <strong>Keyword filtering.</strong> A message is only parsed
                when its subject and text mention billing terms (receipt, trial,
                renewal, charged, cancelled, and similar) with a price or
                subscription signal. Non-matching mail is ignored and not
                stored.
              </li>
              <li>
                <strong>Inbox watch.</strong> While connected, we register a
                Gmail push watch limited to your inbox so new receipts arrive
                promptly. Disconnecting stops the watch.
              </li>
              <li>
                <strong>Offline access.</strong> We keep a refresh token so
                renewals can be checked while you are away. It is stored
                server-side and cleared the moment you disconnect.
              </li>
            </LegalList>
            <p>
              SubZero&apos;s use of information received from Google APIs
              adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements: Gmail data is used only
              to provide the subscription features you see in the product, is
              never sold, never used for advertising, and is shared with service
              providers only as described in section 6.
            </p>
          </LegalSection>

          <LegalSection id="what-we-never-touch" title="4. What we never touch">
            <p>
              Transparency cuts both ways. These are things SubZero does not
              have access to and does not store:
            </p>
            <LegalList>
              <li>
                <strong>Your whole inbox.</strong> We never copy, back up, or
                browse your mail beyond the billing-related search above. Full
                message bodies are processed in memory to extract facts; only
                the short evidence quote is kept.
              </li>
              <li>
                <strong>Send-as-Gmail.</strong> The Gmail scope is read-only.
                Renewal nudges and cancellation emails go out through our own
                mail service (AgentMail), never by impersonating your Gmail
                account.
              </li>
              <li>
                <strong>Bank and card data.</strong> No bank connections, no
                card numbers, no transaction scraping. If a price appears in a
                receipt, that price is the only financial figure we keep.
              </li>
              <li>
                <strong>Merchant logins.</strong> We never ask for, store, or
                use your passwords for Netflix, Adobe, Apple, or anyone else —
                and we never log in to merchant accounts on your behalf.
              </li>
              <li>
                <strong>Automatic cancellation.</strong> SubZero researches the
                route and drafts the step or email. You confirm and take the
                action — nothing is cancelled without you.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="how-we-use-data" title="5. How we use data">
            <LegalList>
              <li>
                <strong>Detect subscriptions.</strong> An AI extraction pass
                reads billing-related messages and pulls structured facts —
                merchant, price, renewal date, billing provider — each kept
                alongside its evidence quote.
              </li>
              <li>
                <strong>Research cancellation paths.</strong> For each merchant
                we fetch the current public help page and turn it into
                structured steps with a friction rating. If we cannot verify a
                path, we say so instead of inventing one.
              </li>
              <li>
                <strong>Remind you.</strong> We schedule 7-day, 3-day, and
                24-hour nudges before renewals, plus a confirmation note when a
                cancellation lands. You can tune these in settings.
              </li>
              <li>
                <strong>Confirm outcomes.</strong> When a cancellation
                confirmation email arrives, we match it to the subscription and
                mark it cancelled.
              </li>
            </LegalList>
            <p>
              We do not sell your data, do not use it for advertising, and do
              not train shared models on it.
            </p>
          </LegalSection>

          <LegalSection id="third-parties" title="6. Third parties">
            <p>
              SubZero runs on a small set of processors, each seeing only what
              it needs:
            </p>
            <LegalList>
              <li>
                <strong>Convex.</strong> Database, hosting, and scheduled jobs —
                stores your subscriptions, evidence, settings, and connection
                tokens.
              </li>
              <li>
                <strong>Google.</strong> Sign-in (OpenID) and the Gmail API
                under the read-only scopes above.
              </li>
              <li>
                <strong>AI providers (Groq, OpenAI, OpenRouter).</strong>{" "}
                Receipt text and merchant help content are sent for extraction
                and structuring. Current extraction model:{" "}
                <code className="font-mono text-sm text-foreground">
                  openai/gpt-oss-120b
                </code>{" "}
                via Groq, with OpenAI fallback.
              </li>
              <li>
                <strong>Firecrawl.</strong> Fetches current merchant help and
                cancellation pages so steps and friction ratings reflect the
                live source.
              </li>
              <li>
                <strong>AgentMail.</strong> Your forwarding inbox address (e.g.{" "}
                <code className="font-mono text-sm text-foreground">
                  subzero-agent@agentmail.to
                </code>
                ) and the outbound channel for renewal nudges and cancellation
                emails you approve.
              </li>
            </LegalList>
            <p>
              We disclose data to authorities only when required by law, and we
              will push back on overbroad requests where we can.
            </p>
          </LegalSection>

          <LegalSection id="retention-deletion" title="7. Retention & deletion">
            <LegalList>
              <li>
                <strong>While connected.</strong> Gmail sync state and refresh
                tokens are kept so renewals stay up to date. Scan metadata is
                kept to avoid duplicate work.
              </li>
              <li>
                <strong>Disconnect.</strong> Disconnecting in{" "}
                <Link href="/dashboard/connections">Connections</Link>{" "}
                immediately clears your refresh token, marks the connection
                disconnected, and stops the inbox watch. Nothing new syncs in
                afterwards.
              </li>
              <li>
                <strong>Delete everything.</strong> Deleting your data in{" "}
                <Link href="/dashboard/settings">Settings</Link> removes your
                subscriptions, evidence excerpts, cancellation drafts,
                notification history, and scan metadata — and auto-disconnects
                Gmail as part of the same operation.
              </li>
              <li>
                <strong>What remains.</strong> Core sign-in records are kept as
                required to operate your account and meet legal obligations.
                Backups, if any, expire on their normal cycle.
              </li>
              <li>
                <strong>Also revoke at Google.</strong> For full assurance,
                remove SubZero under Google Account → Security → Third-party
                access. That invalidates our access even if a cached token still
                existed.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="security" title="8. Security">
            <LegalList>
              <li>
                <strong>Least privilege.</strong> Read-only Gmail scope, narrow
                inbox queries, and no merchant credentials by design.
              </li>
              <li>
                <strong>Server-side secrets.</strong> Refresh tokens and API
                keys live in server deployment configuration — never in URLs,
                logs, or client-visible state.
              </li>
              <li>
                <strong>Scoped access.</strong> Every dashboard query and
                mutation checks that the caller owns the data it touches; one
                user cannot disconnect or read another user&apos;s inbox.
              </li>
              <li>
                <strong>No guarantees.</strong> No system is perfectly secure.
                If we learn of a breach affecting your data, we will notify you
                as required by law.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="your-choices" title="9. Your choices">
            <LegalList>
              <li>
                <strong>Connect or skip Gmail.</strong> Prefer not to connect?
                Forward receipts to your SubZero inbox address or add
                subscriptions manually instead.
              </li>
              <li>
                <strong>Control nudges.</strong> Toggle 7-day, 3-day, and
                24-hour reminders in settings.
              </li>
              <li>
                <strong>Access and correction.</strong> Your subscriptions,
                evidence, and settings are visible and editable in the
                dashboard. Export what you need from settings.
              </li>
              <li>
                <strong>Delete.</strong> Use dashboard deletion any time, or
                email us and we will do it for you.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="changes-contact" title="10. Changes & contact">
            <p>
              If this policy changes materially, we will update the date above
              and, where appropriate, notify you in the product or by email.
              Continued use after the change means you accept the updated
              policy.
            </p>
            <p>
              Questions or requests:{" "}
              <a href="mailto:support@subzero.app">support@subzero.app</a>. For
              Gmail-scope questions, include the address you connected so we can
              locate the right connection — and nothing else sensitive.
            </p>
          </LegalSection>
        </LegalBody>
      </LegalLayout>
    </MarketingLayout>
  );
}
