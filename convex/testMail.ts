"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import {
  renewalNudgeTemplate,
  trialEndingTemplate,
  cancelledTemplate,
  actionReminderTemplate,
} from "./lib/emailTemplates";

// Test mailer — sends template previews to harliarmeen@gmail.com
// Uses AGENTMAIL_API_KEY from Convex env. No auth required for local testing,
// but rate-limit to avoid spam: caller should use sparingly.

const TEST_TO = "harliarmeen@gmail.com";

async function sendViaAgentMail(to: string, subject: string, text: string) {
  const apiKey =
    (process.env.AGENTMAIL_API_KEY as string | undefined) ??
    (process.env as unknown as Record<string, string>).AGENTMAIL_API_KEY;
  if (!apiKey) {
    console.log(`[testMail mock] To:${to} Subject:${subject}\n${text.slice(0, 400)}`);
    return { mock: true, to, subject };
  }
  const inboxId =
    (process.env.AGENTMAIL_INBOX as string | undefined) ?? "subzero-agent@agentmail.to";
  const res = await fetch(
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, subject, text }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`AgentMail ${res.status}: ${body.slice(0, 400)}`);
  return { mock: false, to, subject, body: body.slice(0, 300) };
}

const typeValidator = v.union(
  v.literal("7d"),
  v.literal("3d"),
  v.literal("24h"),
  v.literal("trial"),
  v.literal("cancelled"),
  v.literal("reminder"),
  v.literal("all"),
);

export const sendTestMail = action({
  args: {
    type: typeValidator,
    to: v.optional(v.string()),
    merchant: v.optional(v.string()),
  },
  returns: v.object({ sent: v.number(), to: v.string(), type: v.string() }),
  handler: async (_ctx, args) => {
    const to = (args.to ?? TEST_TO).trim().toLowerCase();
    const merchant = args.merchant ?? "Google One";
    const base = {
      merchant,
      product: merchant === "Google One" ? "Google AI Plus (400 GB)" : "Premium",
      price: 7700,
      currency: "NGN",
      billingInterval: "monthly" as const,
      nextRenewalAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
      trialEndsAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
      cancellationUrl: "https://play.google.com/store/account/subscriptions",
      cancellationDifficulty: "high" as const,
      subscriptionId: "test-preview-id",
      dashboardUrl: `${process.env.SITE_URL ?? "http://localhost:3000"}/subscriptions/test-preview-id`,
    };

    const sendOne = async (t: string) => {
      let tpl: { subject: string; text: string };
      if (t === "7d") tpl = renewalNudgeTemplate(base, "7d");
      else if (t === "3d") tpl = renewalNudgeTemplate(base, "3d");
      else if (t === "24h") tpl = renewalNudgeTemplate(base, "24h");
      else if (t === "trial") tpl = trialEndingTemplate(base);
      else if (t === "cancelled") tpl = cancelledTemplate(base);
      else if (t === "reminder") tpl = actionReminderTemplate(base);
      else throw new Error(`unknown type ${t}`);
      await sendViaAgentMail(to, tpl.subject, tpl.text);
    };

    if (args.type === "all") {
      const types = ["7d", "3d", "24h", "trial", "cancelled", "reminder"] as const;
      for (const t of types) {
        await sendOne(t);
        // small gap to avoid rate limit
        await new Promise((r) => setTimeout(r, 800));
      }
      return { sent: types.length, to, type: "all" };
    }
    await sendOne(args.type);
    return { sent: 1, to, type: args.type };
  },
});

// Convenience: send one of each with realistic merchants/currencies
export const sendAllVariants = action({
  args: { to: v.optional(v.string()) },
  returns: v.object({ sent: v.number(), to: v.string() }),
  handler: async (_ctx, args) => {
    const to = (args.to ?? TEST_TO).trim().toLowerCase();
    const variants: Array<{ type: "7d" | "3d" | "24h" | "trial"; input: Parameters<typeof renewalNudgeTemplate>[0] }> = [
      {
        type: "7d",
        input: {
          merchant: "Google One",
          product: "Google AI Plus (400 GB)",
          price: 7700,
          currency: "NGN",
          billingInterval: "monthly",
          nextRenewalAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          cancellationUrl: "https://play.google.com/store/account/subscriptions",
          cancellationDifficulty: "high",
          subscriptionId: "demo-google",
        },
      },
      {
        type: "3d",
        input: {
          merchant: "Adobe",
          product: "Creative Cloud",
          price: 54.99,
          currency: "USD",
          billingInterval: "monthly",
          nextRenewalAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
          cancellationUrl: "https://account.adobe.com/plans",
          cancellationDifficulty: "high",
          subscriptionId: "demo-adobe",
        },
      },
      {
        type: "24h",
        input: {
          merchant: "Snap Inc",
          product: "Snapchat+",
          price: 2300,
          currency: "NGN",
          billingInterval: "yearly",
          nextRenewalAt: Date.now() + 1 * 24 * 60 * 60 * 1000,
          cancellationUrl: "https://play.google.com/store/account/subscriptions",
          cancellationDifficulty: "medium",
          subscriptionId: "demo-snap",
        },
      },
      {
        type: "trial",
        input: {
          merchant: "Notion",
          product: "Notion Plus",
          price: 10,
          currency: "USD",
          billingInterval: "monthly",
          trialEndsAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
          nextRenewalAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
          cancellationUrl: "https://notion.so/settings/billing",
          cancellationDifficulty: "low",
          subscriptionId: "demo-notion",
        },
      },
    ];

    for (const v of variants) {
      const tpl =
        v.type === "trial"
          ? trialEndingTemplate(v.input)
          : renewalNudgeTemplate(v.input, v.type as "7d" | "3d" | "24h");
      await sendViaAgentMail(to, tpl.subject, tpl.text);
      await new Promise((r) => setTimeout(r, 800));
    }
    // + cancelled + reminder
    const cancelled = cancelledTemplate({
      merchant: "Spotify",
      price: 9.99,
      currency: "USD",
      billingInterval: "monthly",
      subscriptionId: "demo-spotify",
    });
    await sendViaAgentMail(to, cancelled.subject, cancelled.text);
    await new Promise((r) => setTimeout(r, 800));
    const reminder = actionReminderTemplate({
      merchant: "Canva",
      price: 15,
      currency: "USD",
      billingInterval: "monthly",
      nextRenewalAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
      subscriptionId: "demo-canva",
    });
    await sendViaAgentMail(to, reminder.subject, reminder.text);

    return { sent: variants.length + 2, to };
  },
});
