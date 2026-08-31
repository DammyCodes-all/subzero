"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { buildGmailQuery, getAccessToken, getMessage, listMessages } from "./lib/gmail";
import { normalizeEmail } from "./ingestion/normalize";

const COOLDOWN_MS = 10 * 60 * 1000;
const PRICE_HINT = /(\$|€|£|₦|₹|¥)\s*[\d,]+|[\d,]+\s*(USD|EUR|GBP|NGN|INR|JPY|CAD|AUD)/i;
const KEYWORDS = /receipt|trial|renewal|subscription|invoice|charged|billed|cancelled|canceled|payment|plan|order number|GPA\./i;

async function processOneEmail(
  ctx: any,
  userId: string,
  subject: string,
  text: string,
  html: string,
  messageId: string,
): Promise<{ status: string; subscriptionId?: string }> {
  const normalized = normalizeEmail({ text, html, subject });
  const hay = `${normalized.text} ${normalized.subject}`;
  if (!KEYWORDS.test(hay)) return { status: "skipped" };
  if (!PRICE_HINT.test(hay) && !/cancelled|canceled/i.test(hay)) {
    if (!/trial|renewal|subscription/i.test(hay)) return { status: "skipped" };
  }
  const extracted: any = await ctx.runAction(internal.ingestion.extract.extractSubscription, {
    text: normalized.text,
    subject: normalized.subject,
  });
  if (!extracted.isConfirmation && (!extracted.merchant || extracted.price === undefined)) {
    return { status: "unparsed" };
  }
  const source = `Gmail: ${subject.slice(0, 80)}`;
  const result: any = await ctx.runMutation(internal.ingestion.persist.persistExtracted, {
    userId,
    extracted,
    svixId: `gmail:${messageId}`,
    messageId: `gmail:${messageId}`,
    source,
  });
  if (result.isDuplicate) return { status: "duplicate" };
  if (result.isNew && result.subscriptionId && !extracted.isConfirmation) {
    await ctx.scheduler.runAfter(0, internal.research.researchCancellationRoute, {
      subscriptionId: result.subscriptionId,
    });
  }
  return { status: extracted.isConfirmation ? "cancelled" : result.isNew ? "created" : "merged", subscriptionId: result.subscriptionId };
}

export const scanGmail = action({
  args: {},
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    merged: v.number(),
    skipped: v.number(),
    unparsed: v.number(),
    duplicate: v.number(),
    cancelled: v.number(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, _args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const conn: any = await ctx.runQuery(internal.gmail.getConnectionInternal, { userId });
    if (conn?.lastGmailScanAt && Date.now() - conn.lastGmailScanAt < COOLDOWN_MS) {
      return { scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, reason: "cooldown" };
    }
    const fixture = process.env.FIXTURE_GMAIL === "1";
    let scanned = 0, created = 0, merged = 0, skipped = 0, unparsed = 0, duplicate = 0, cancelled = 0;
    if (fixture) {
      const { fixtures } = await import("./ingestion/fixtures");
      const list = Object.values(fixtures);
      for (const f of list) {
        scanned++;
        const r = await processOneEmail(ctx, userId, f.subject, f.text, f.html ?? "", `fixture:${f.subject.slice(0,20)}`);
        if (r.status === "created") created++;
        else if (r.status === "merged") merged++;
        else if (r.status === "skipped") skipped++;
        else if (r.status === "unparsed") unparsed++;
        else if (r.status === "duplicate") duplicate++;
        else if (r.status === "cancelled") cancelled++;
      }
      if (conn?._id) await ctx.runMutation(internal.gmail.touchScan as any, { connId: conn._id });
      return { scanned, created, merged, skipped, unparsed, duplicate, cancelled };
    }

    if (!conn || !conn.gmailRefreshToken || !conn.gmailScopeGranted || conn.status !== "connected") {
      return { scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, reason: "no_consent" };
    }

    let accessToken: string;
    try {
      const tok = await getAccessToken(conn.gmailRefreshToken);
      accessToken = tok.accessToken;
    } catch (e: any) {
      return { scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, reason: String(e).slice(0,200) };
    }

    const q = buildGmailQuery(60);
    let pageToken: string | undefined = undefined;
    let pages = 0;
    const maxPages = 2;
    do {
      const { messages, nextPageToken } = await listMessages(accessToken, q, 15, pageToken);
      pageToken = nextPageToken;
      pages++;
      for (let i = 0; i < messages.length; i += 5) {
        const batch = messages.slice(i, i + 5);
        const fetched = await Promise.all(
          batch.map((m) => getMessage(accessToken, m.id).catch(() => null)),
        );
        for (const msg of fetched) {
          if (!msg) { skipped++; continue; }
          scanned++;
          try {
            const r = await processOneEmail(ctx, userId, msg.subject, msg.text, msg.html, msg.id);
            if (r.status === "created") created++;
            else if (r.status === "merged") merged++;
            else if (r.status === "skipped") skipped++;
            else if (r.status === "unparsed") unparsed++;
            else if (r.status === "duplicate") duplicate++;
            else if (r.status === "cancelled") cancelled++;
          } catch {
            unparsed++;
          }
        }
      }
      if (!pageToken) break;
    } while (pages < maxPages);

    if (conn?._id) await ctx.runMutation(internal.gmail.touchScan as any, { connId: conn._id });
    return { scanned, created, merged, skipped, unparsed, duplicate, cancelled };
  },
});

export const scanForUser = internalAction({
  args: { userId: v.string() },
  returns: v.object({ scanned: v.number(), created: v.number(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const conn: any = await ctx.runQuery(internal.gmail.getConnectionInternal, { userId: args.userId });
    const fixture = process.env.FIXTURE_GMAIL === "1";
    if (fixture) {
      if (conn?.lastGmailScanAt && Date.now() - conn.lastGmailScanAt < COOLDOWN_MS) return { scanned: 0, created: 0, reason: "cooldown" };
      const { fixtures } = await import("./ingestion/fixtures");
      let scanned = 0, created = 0;
      for (const f of Object.values(fixtures)) {
        scanned++;
        const r = await processOneEmail(ctx, args.userId, f.subject, f.text, f.html ?? "", `fixture:${f.subject.slice(0,20)}`);
        if (r.status === "created") created++;
      }
      if (conn?._id) await ctx.runMutation(internal.gmail.touchScan, { connId: conn._id });
      return { scanned, created };
    }
    if (!conn || !conn.gmailRefreshToken) return { scanned: 0, created: 0, reason: "no_consent" };
    if (conn.lastGmailScanAt && Date.now() - conn.lastGmailScanAt < COOLDOWN_MS) return { scanned: 0, created: 0, reason: "cooldown" };
    try {
      const tok = await getAccessToken(conn.gmailRefreshToken);
      const q = buildGmailQuery(60);
      const { messages } = await listMessages(tok.accessToken, q, 15);
      let scanned = 0, created = 0;
      for (const m of messages.slice(0, 5)) {
        const msg = await getMessage(tok.accessToken, m.id).catch(() => null);
        if (!msg) continue;
        scanned++;
        const r = await processOneEmail(ctx, args.userId, msg.subject, msg.text, msg.html, msg.id).catch(() => ({ status: "unparsed" }));
        if (r.status === "created") created++;
      }
      if (conn?._id) await ctx.runMutation(internal.gmail.touchScan, { connId: conn._id });
      return { scanned, created };
    } catch (e: any) {
      return { scanned: 0, created: 0, reason: String(e).slice(0,200) };
    }
  },
});

export const triggerScanForCurrentUser: any = action({
  args: {},
  returns: v.object({ scanned: v.number(), created: v.number(), reason: v.optional(v.string()) }),
  handler: async (ctx: any) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.runAction(internal.gmailActions.scanForUser, { userId });
  },
});
