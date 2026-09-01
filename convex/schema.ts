import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  connections: defineTable({
    userId: v.string(),
    provider: v.union(v.literal("google"), v.literal("agentmail")),
    gmailRefreshToken: v.optional(v.string()),
    status: v.union(v.literal("connected"), v.literal("disconnected")),
    gmailScopeGranted: v.optional(v.boolean()),
    accountEmail: v.optional(v.string()),
    agentmailInbox: v.optional(v.string()),
    lastGmailScanAt: v.optional(v.number()),
    gmailHistoryId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_agentmailInbox", ["agentmailInbox"])
    .index("by_accountEmail", ["accountEmail"])
    .index("by_accountEmail_status", ["accountEmail", "status"])
    .index("by_user_accountEmail", ["userId", "accountEmail"]),

  subscriptions: defineTable({
    userId: v.string(),
    merchant: v.string(),
    product: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    billingInterval: v.union(
      v.literal("monthly"),
      v.literal("yearly"),
      v.literal("weekly"),
      v.literal("unknown"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("action_ready"),
      v.literal("user_started"),
      v.literal("cancellation_pending"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    trialEndsAt: v.optional(v.number()),
    nextRenewalAt: v.optional(v.number()),
    cancellationDifficulty: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("very_high"),
      ),
    ),
    cancellationMethod: v.optional(
      v.union(
        v.literal("open_web"),
        v.literal("open_provider"),
        v.literal("send_email"),
        v.literal("contact_support"),
        v.literal("manual"),
        v.literal("unknown"),
      ),
    ),
    cancellationUrl: v.optional(v.string()),
    billingProvider: v.optional(v.string()),
    sourceEmail: v.optional(v.string()),
    sourceConnectionId: v.optional(v.id("connections")),
    dedupKey: v.string(),
    researchStatus: v.optional(
      v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    ),
    researchedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_dedup", ["userId", "dedupKey"])
    .index("by_user_and_renewal", ["userId", "nextRenewalAt"])
    .index("by_merchant", ["merchant"])
    .index("by_renewal", ["nextRenewalAt"])
    .index("by_researchStatus", ["researchStatus"]),

  evidence: defineTable({
    subscriptionId: v.id("subscriptions"),
    source: v.string(),
    sourceType: v.union(
      v.literal("email"),
      v.literal("firecrawl"),
      v.literal("manual"),
    ),
    excerpt: v.string(),
    url: v.optional(v.string()),
    confidence: v.number(),
    retrievedAt: v.number(),
    svixId: v.optional(v.string()),
    messageId: v.optional(v.string()),
  })
    .index("by_subscription", ["subscriptionId"])
    .index("by_svixId", ["svixId"])
    .index("by_messageId", ["messageId"]),

  cancellationActions: defineTable({
    subscriptionId: v.id("subscriptions"),
    type: v.union(
      v.literal("open_web"),
      v.literal("open_provider"),
      v.literal("send_email"),
      v.literal("contact_support"),
      v.literal("manual"),
      v.literal("unknown"),
    ),
    status: v.union(
      v.literal("ready"),
      v.literal("started"),
      v.literal("pending"),
      v.literal("done"),
      v.literal("failed"),
    ),
    instructions: v.optional(v.array(v.string())),
    draft: v.optional(v.string()),
  }).index("by_subscription", ["subscriptionId"]),

  notifications: defineTable({
    userId: v.string(),
    subscriptionId: v.id("subscriptions"),
    scheduledAt: v.number(),
    type: v.union(
      v.literal("7d"),
      v.literal("3d"),
      v.literal("24h"),
      v.literal("confirmed"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
    ),
    attemptedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_scheduled", ["scheduledAt"])
    .index("by_subscription_and_type", ["subscriptionId", "type"]),

  ingestionAttempts: defineTable({
    userId: v.string(),
    svixId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    inboxId: v.string(),
    from: v.optional(v.string()),
    subject: v.optional(v.string()),
    status: v.union(
      v.literal("processing"),
      v.literal("created"),
      v.literal("merged"),
      v.literal("duplicate"),
      v.literal("skipped"),
      v.literal("unparsed"),
      v.literal("no_user"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    subscriptionId: v.optional(v.id("subscriptions")),
    sourceEmail: v.optional(v.string()),
    sourceConnectionId: v.optional(v.id("connections")),
    reason: v.optional(v.string()),
    receivedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_receivedAt", ["userId", "receivedAt"])
    .index("by_svixId", ["svixId"])
    .index("by_messageId", ["messageId"]),
});
