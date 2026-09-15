"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

// Full-paste preview: runs the same AI extraction as Gmail/forwarding
// but writes nothing. Client shows editable fields, then saves via
// subscriptions.upsert + evidence.add.
export const previewPaste = action({
  args: {
    text: v.string(),
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const text = args.text.slice(0, 15000).trim();
    if (text.length < 20) throw new Error("Paste a full receipt first");
    const subject = (args.subject ?? "Pasted receipt").slice(0, 300);
    const extracted: {
      merchant?: string;
      product?: string;
      price?: number;
      currency?: string;
      billingInterval: "monthly" | "yearly" | "weekly" | "unknown";
      nextRenewalAt?: number;
      trialEndsAt?: number;
      billingProvider?: string;
      isConfirmation: boolean;
      confidence: number;
      quote: string;
    } = await ctx.runAction(internal.ingestion.extract.extractSubscription, {
      text,
      subject,
    });
    return extracted;
  },
});
