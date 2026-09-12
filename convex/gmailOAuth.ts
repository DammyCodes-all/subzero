import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
} from "./_generated/server";

function convexSiteUrl(): string {
  const url =
    process.env.CONVEX_SITE_URL ??
    (process.env.SITE_URL as string | undefined) ??
    "";
  return url.replace(/\/$/, "");
}

export const createState = internalMutation({
  args: { userId: v.string(), state: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Cleanup states older than 15 min for this user.
    const old = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const row of old) {
      if (row.createdAt < now - 15 * 60 * 1000) await ctx.db.delete(row._id);
    }
    await ctx.db.insert("gmailOAuthStates", {
      state: args.state,
      userId: args.userId,
      createdAt: now,
    });
  },
});

export const consumeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();
    if (!row) return null;
    await ctx.db.delete(row._id);
    if (row.createdAt < Date.now() - 15 * 60 * 1000) return null;
    return { userId: row.userId };
  },
});

// Sweep abandoned states (started but never completed). Tiny table, runs daily.
export const cleanupExpiredStates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    const rows = await ctx.db.query("gmailOAuthStates").collect();
    for (const row of rows) {
      if (row.createdAt < cutoff) await ctx.db.delete(row._id);
    }
  },
});

// Authenticated action: frontend calls this, then navigates to the returned URL.
export const getAuthUrl = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const clientId =
      process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
    if (!clientId) throw new Error("Gmail OAuth is not configured");
    const siteUrl = convexSiteUrl();
    if (!siteUrl) throw new Error("CONVEX_SITE_URL is not set");
    const redirectUri = `${siteUrl}/gmail/oauth/callback`;
    const state =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await ctx.runMutation(internal.gmailOAuth.createState, { userId, state });
    const scope = encodeURIComponent(
      "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    );
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}` +
      `&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
    return { url };
  },
});
