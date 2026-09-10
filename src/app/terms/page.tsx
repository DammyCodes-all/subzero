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
import { TERMS_SECTIONS } from "./sections";

export const metadata: Metadata = {
  title: "Terms of Service — SubZero",
  description:
    "The rules for using SubZero: what the service does, what it doesn't do, and where responsibility sits when you cancel.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <MarketingLayout>
      <LegalLayout
        eyebrow="Legal"
        title="Terms of Service"
        intro="SubZero finds your subscriptions, warns you before they renew, and shows the verified way to cancel. You stay in control — especially of the cancel button."
        updated={LEGAL_LAST_UPDATED}
        sections={TERMS_SECTIONS}
      >
        <LegalBody>
          <LegalSection id="what-subzero-is" title="1. What SubZero is">
            <p>
              SubZero is a subscription awareness tool. It detects subscriptions
              from your connected Gmail inbox, forwarded mail, or manual
              entries; tracks trial ends and renewal dates; shows the evidence
              behind each fact; researches each merchant&apos;s current
              cancellation path; and sends renewal reminders before you are
              charged.
            </p>
            <LegalNote title="The deal in one paragraph">
              <p>
                We surface what needs attention and the exact next step.{" "}
                <strong>You take the action.</strong> SubZero never cancels,
                pauses, or pays for anything without your explicit confirmation
                in the product.
              </p>
            </LegalNote>
          </LegalSection>

          <LegalSection id="what-subzero-is-not" title="2. What SubZero is not">
            <p>To keep expectations honest, SubZero does not provide:</p>
            <LegalList>
              <li>Bank or card connections of any kind.</li>
              <li>Logging in to merchant accounts on your behalf.</li>
              <li>
                One-click browser automation that cancels inside merchant sites
                for you.
              </li>
              <li>Phone calls, support chats, or refund negotiation.</li>
              <li>
                Financial, legal, or tax advice — renewal dates and cancellation
                steps are information, not advice.
              </li>
              <li>
                Automatic cancellation without you confirming. The service is
                deliberately built so the sensitive step stays with you.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="accounts" title="3. Accounts">
            <LegalList>
              <li>
                <strong>Sign-in.</strong> You may register with Google or with
                an email address and password (minimum 8 characters). One
                person, one account; keep your credentials private.
              </li>
              <li>
                <strong>Accurate details.</strong> Use an email address you
                control. Each connected Gmail address can only be linked to one
                SubZero account.
              </li>
              <li>
                <strong>Responsibility.</strong> You are responsible for
                activity under your account. Tell us promptly at{" "}
                <a href="mailto:support@subzero.app">support@subzero.app</a> if
                you suspect unauthorized access.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="inbox-connections" title="4. Inbox connections">
            <LegalList>
              <li>
                <strong>Gmail is read-only.</strong> The connection requests{" "}
                <code className="font-mono text-sm text-foreground">
                  gmail.readonly
                </code>{" "}
                (plus basic profile/email to identify the account). SubZero
                cannot send, delete, or alter Gmail messages. Outbound mail such
                as nudges and approved cancellation emails is sent through our
                own mail service, not your Gmail account.
              </li>
              <li>
                <strong>Forwarding is your choice.</strong> Anything you forward
                to your SubZero inbox address is processed as if it came from
                Gmail. Only forward mail you want us to read.
              </li>
              <li>
                <strong>Disconnect any time.</strong> Remove the connection in{" "}
                <Link href="/dashboard/connections">Connections</Link>.
                Disconnecting clears the stored refresh token and stops further
                syncing and inbox watching. You can also revoke access in your
                Google Account security settings.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="accuracy" title="5. Accuracy & AI limits">
            <p>
              Subscription facts are extracted by AI from receipts and trial
              mail, then merged across messages by merchant, amount, and dates.
              Cancellation research is grounded in the merchant&apos;s current
              public help pages — but merchants change pages, prices, and flows
              without notice.
            </p>
            <LegalList>
              <li>
                <strong>Evidence first.</strong> Important fields carry the
                source quote they came from. If we cannot back a claim, we do
                not show it — and an <strong>unknown</strong> cancellation route
                means exactly that: unverified, not a suggestion to guess.
              </li>
              <li>
                <strong>Verify before money moves.</strong> Always confirm the
                renewal date, amount, and cancellation steps with the merchant
                before acting, especially close to a charge.
              </li>
              <li>
                <strong>No guarantees.</strong> Extraction, renewal dates,
                friction ratings, and research may be incomplete or out of date.
                SubZero is an aid, not a warranty that a cancellation will
                succeed or a charge will be avoided.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="cancellation" title="6. Cancellation guidance">
            <p>
              For each subscription SubZero assigns one researched action type,
              and the dashboard button matches it:
            </p>
            <LegalList>
              <li>
                <strong>Open web</strong> — cancel on the merchant site (“Open
                cancellation”).
              </li>
              <li>
                <strong>Open provider</strong> — you are billed through Apple,
                Google Play, or Amazon, so you must cancel there.
              </li>
              <li>
                <strong>Review & send</strong> — the merchant accepts email
                cancellation; the message is sent via our mail service only
                after you review it.
              </li>
              <li>
                <strong>Contact support</strong> — cancellation requires talking
                to support; we point you to the verified channel.
              </li>
              <li>
                <strong>Manual</strong> — follow the listed steps yourself (e.g.
                Settings → Account → Subscription → Cancel).
              </li>
              <li>
                <strong>Unknown</strong> — no current path could be verified; we
                tell you so rather than inventing one.
              </li>
            </LegalList>
            <p>
              Friction ratings (Low, Medium, High, Very High) describe
              observable effort — step count, login requirements, provider
              detours, support involvement — and always ship with the reason,
              not just the label. Completing the cancellation, meeting the
              merchant&apos;s deadlines, and keeping any confirmation are your
              responsibility.
            </p>
          </LegalSection>

          <LegalSection id="notifications" title="7. Notifications">
            <p>
              SubZero schedules reminders around 7 days, 3 days, and 24 hours
              before a detected renewal, plus a note when a cancellation
              confirmation is detected. Timing depends on the accuracy of the
              underlying renewal data and on mail delivery outside our control.
              You can adjust reminder preferences in{" "}
              <Link href="/dashboard/settings">Settings</Link>, but reminders
              are a courtesy — missing one does not make us responsible for a
              charge.
            </p>
          </LegalSection>

          <LegalSection id="acceptable-use" title="8. Acceptable use">
            <p>You agree not to:</p>
            <LegalList>
              <li>
                Connect an inbox you do not own or lack permission to share.
              </li>
              <li>Forward someone else&apos;s mail without their consent.</li>
              <li>
                Abuse, probe, or overload the service or its connected APIs.
              </li>
              <li>
                Use SubZero output as legal or financial advice to others.
              </li>
              <li>Attempt to access another user&apos;s data.</li>
            </LegalList>
            <p>
              We may suspend or terminate accounts that violate these terms or
              put the service, our providers, or other users at risk.
            </p>
          </LegalSection>

          <LegalSection id="third-parties" title="9. Third-party services">
            <p>
              SubZero depends on third parties: Google (sign-in and Gmail API),
              Convex (database and hosting), AI providers (receipt extraction
              and research structuring), Firecrawl (merchant help pages), and
              AgentMail (forwarding inbox and outbound mail). Your use of
              SubZero is also subject to those providers&apos; terms where
              applicable, and their outages or policy changes may affect the
              service. Merchant sites and billing providers (Apple, Google Play,
              Amazon) are entirely outside our control.
            </p>
          </LegalSection>

          <LegalSection id="disclaimers" title="10. Disclaimers">
            <p>
              THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT
              WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. WE DO NOT WARRANT THAT DETECTION WILL FIND EVERY
              SUBSCRIPTION, THAT RENEWAL DATA WILL BE CORRECT, THAT CANCELLATION
              STEPS WILL WORK, OR THAT THE SERVICE WILL BE UNINTERRUPTED OR
              ERROR-FREE.
            </p>
          </LegalSection>

          <LegalSection id="liability" title="11. Limitation of liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SUBZERO AND ITS OPERATORS
              ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              OR PUNITIVE DAMAGES — INCLUDING RENEWAL CHARGES, LATE FEES, OR
              LOST REFUNDS — ARISING FROM YOUR USE OF OR INABILITY TO USE THE
              SERVICE, EVEN IF ADVISED OF THE POSSIBILITY. TOTAL LIABILITY FOR
              ANY CLAIM IS LIMITED TO THE AMOUNTS YOU PAID FOR THE SERVICE IN
              THE 12 MONTHS BEFORE THE CLAIM (OR $50 IF YOU PAID NOTHING).
            </p>
            <p>
              Some jurisdictions do not allow these exclusions, so parts of this
              section may not apply to you — your mandatory consumer rights are
              unaffected.
            </p>
          </LegalSection>

          <LegalSection id="termination" title="12. Termination & deletion">
            <LegalList>
              <li>
                <strong>By you.</strong> Stop using SubZero any time. Disconnect
                inboxes in{" "}
                <Link href="/dashboard/connections">Connections</Link> and
                delete data in <Link href="/dashboard/settings">Settings</Link>,
                which removes subscriptions, evidence, drafts, notification
                history, and scan metadata, and disconnects Gmail in the same
                step.
              </li>
              <li>
                <strong>By us.</strong> We may suspend or terminate access for
                violations of these terms, abuse, or prolonged inactivity, and
                we may discontinue parts of the service with reasonable notice
                where possible.
              </li>
              <li>
                <strong>After termination.</strong> Your license to use the
                service ends; core account records may be retained as needed to
                operate, comply with law, or resolve disputes, as described in
                the <Link href="/privacy">Privacy Policy</Link>.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="changes-contact" title="13. Changes & contact">
            <p>
              We may update these terms as the product evolves. Material changes
              will be flagged by updating the date above and, where appropriate,
              by in-product or email notice. Continued use after the update
              means you accept the new terms.
            </p>
            <p>
              Contact:{" "}
              <a href="mailto:support@subzero.app">support@subzero.app</a>. Our{" "}
              <Link href="/privacy">Privacy Policy</Link> explains how we handle
              your data.
            </p>
          </LegalSection>
        </LegalBody>
      </LegalLayout>
    </MarketingLayout>
  );
}
