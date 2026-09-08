import { AgentMail } from "@agentmail/convex";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const client = new AgentMail(components.agentmail);

/**
 * Enqueue an outbound email via the official AgentMail component.
 * Must run as a mutation: the component persists the outbound row and its
 * workpool action delivers with bounded retries. Delivery status is then a
 * reactive query instead of a one-shot fetch result.
 */
export const enqueueSend = internalMutation({
  args: {
    inboxId: v.string(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await client.sendMessage(ctx, args.inboxId, {
      to: args.to,
      subject: args.subject,
      text: args.text,
      labels: args.labels,
    });
  },
});
