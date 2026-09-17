import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const record = internalMutation({
  args: {
    operation: v.union(v.literal("extraction"), v.literal("research")),
    provider: v.string(),
    model: v.string(),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    latencyMs: v.number(),
    success: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsage", {
      ...args,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const cleanupOld = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(500);
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

// Circuit-breaker read: providers whose LATEST row inside the window is a
// failure. A later success clears the cooldown. Callers skip these unless
// every provider is cooling down (fail open).
export const recentFailedProviders = internalQuery({
  args: {
    operation: v.union(v.literal("extraction"), v.literal("research")),
    windowMs: v.number(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - Math.max(0, args.windowMs);
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_operation_createdAt", (q) =>
        q.eq("operation", args.operation).gte("createdAt", cutoff),
      )
      .order("desc")
      .take(100);
    const seen = new Set<string>();
    const out = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.provider)) continue;
      seen.add(row.provider);
      if (!row.success) out.add(row.provider);
    }
    return [...out];
  },
});
