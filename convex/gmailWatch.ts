"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  getAccessToken,
  getHistory,
  getProfileHistoryId,
  getMessage,
  listMessages,
  buildGmailQuery,
  buildBroadInboxQuery,
  watchGmail,
  stopWatch,
} from "./lib/gmail";
import { processOneEmail } from "./lib/processEmail";

const COOLDOWN_MS = 10 * 60 * 1000;

export const ensureWatchForConn = internalAction({
  args: { connId: v.id("connections") },
  returns: v.object({
    watched: v.boolean(),
    expiration: v.optional(v.number()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const topic = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topic) return { watched: false, reason: "no_topic" };
    const conn: any = await ctx.runQuery(internal.gmail.getConnectionByIdInternal, {
      connId: args.connId,
    } as any);
    if (!conn || !conn.gmailRefreshToken || conn.status !== "connected" || !conn.gmailScopeGranted) {
      return { watched: false, reason: "no_consent" };
    }
    try {
      const tok = await getAccessToken(conn.gmailRefreshToken);
      const res = await watchGmail(tok.accessToken, topic);
      await ctx.runMutation(internal.gmail.storeWatchState, {
        connId: args.connId,
        historyId: res.historyId,
        expiration: res.expiration,
        topic,
      });
      return { watched: true, expiration: res.expiration };
    } catch (e: any) {
      console.error("ensureWatch failed", args.connId, String(e));
      return { watched: false, reason: String(e).slice(0, 200) };
    }
  },
});

export const stopWatchForConn = internalAction({
  args: { connId: v.id("connections"), refreshToken: v.optional(v.string()) },
  returns: v.object({ stopped: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    let token = args.refreshToken;
    if (!token) {
      const conn: any = await ctx.runQuery(internal.gmail.getConnectionByIdInternal, {
        connId: args.connId,
      } as any);
      token = conn?.gmailRefreshToken;
    }
    if (!token) return { stopped: false, reason: "no_token" };
    try {
      const tok = await getAccessToken(token);
      await stopWatch(tok.accessToken);
      await ctx.runMutation(internal.gmail.clearWatchState, { connId: args.connId });
      return { stopped: true };
    } catch (e: any) {
      console.error("stopWatch failed", args.connId, String(e));
      // Still clear local state to avoid stuck expiration
      try { await ctx.runMutation(internal.gmail.clearWatchState, { connId: args.connId }); } catch {}
      return { stopped: false, reason: String(e).slice(0, 200) };
    }
  },
});

export const renewWatchesForAll = internalAction({
  args: {},
  returns: v.object({ renewed: v.number(), skipped: v.number(), failed: v.number() }),
  handler: async (ctx) => {
    const topic = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topic) return { renewed: 0, skipped: 0, failed: 0 };
    const conns: any[] = await ctx.runQuery(internal.gmail.listAllGmailConnectionsInternal, {} as any);
    let renewed = 0, skipped = 0, failed = 0;
    const now = Date.now();
    for (const conn of conns) {
      const exp = conn.gmailWatchExpiration;
      const needsRenew = !exp || exp - now < 2 * 24 * 60 * 60 * 1000;
      if (!needsRenew) {
        skipped++;
        continue;
      }
      if (!conn.gmailRefreshToken || conn.status !== "connected" || !conn.gmailScopeGranted) {
        skipped++;
        continue;
      }
      try {
        const tok = await getAccessToken(conn.gmailRefreshToken);
        const res = await watchGmail(tok.accessToken, topic);
        await ctx.runMutation(internal.gmail.storeWatchState, {
          connId: conn._id,
          historyId: res.historyId,
          expiration: res.expiration,
          topic,
        });
        renewed++;
        await new Promise((r) => setTimeout(r, 200));
      } catch (e: any) {
        console.error("renew watch failed", conn._id, String(e));
        failed++;
      }
    }
    return { renewed, skipped, failed };
  },
});

export const ingestIncremental = internalAction({
  args: {
    userId: v.string(),
    connId: v.id("connections"),
    startHistoryId: v.optional(v.string()),
  },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    merged: v.number(),
    skipped: v.number(),
    unparsed: v.number(),
    duplicate: v.number(),
    cancelled: v.number(),
    historyId: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Load connection to get refresh token and historyId fallback
    const conn: any = await ctx.runQuery(internal.gmail.getConnectionByIdInternal, {
      connId: args.connId,
    } as any);
    if (!conn || !conn.gmailRefreshToken) {
      return { scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, reason: "no_consent" };
    }
    const storedHistoryId = conn.gmailHistoryId as string | undefined;
    const startId = args.startHistoryId ?? storedHistoryId;
    let accessToken: string;
    try {
      const tok = await getAccessToken(conn.gmailRefreshToken);
      accessToken = tok.accessToken;
    } catch (e: any) {
      // Surface revoked/expired refresh tokens so UI can prompt reconnect
      const msg = String(e?.message ?? e);
      if (/400|401|403|invalid_grant|revoked|expired/i.test(msg)) {
        try {
          await ctx.runMutation(internal.gmail.markTokenInvalid, { connId: args.connId });
        } catch {}
      }
      return { scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, reason: "token_failed" };
    }

    let historyIdToUse = startId;
    let messagesAdded: { id: string; threadId: string }[] = [];
    let latestHistoryId: string | undefined;

    if (historyIdToUse) {
      try {
        const h = await getHistory(accessToken, historyIdToUse);
        messagesAdded = h.messagesAdded;
        latestHistoryId = h.historyId;
      } catch (e: any) {
        if (e.code === "INVALID_HISTORY" || String(e.message).includes("404")) {
          // Fallback to full sync (small window)
          console.warn("history 404 fallback to list", args.connId, String(e).slice(0, 200));
          return await fallbackListIngest(ctx, args.userId, conn, accessToken);
        }
        throw e;
      }
    } else {
      // No historyId yet — fallbackListIngest already seeds historyId via profile
      return await fallbackListIngest(ctx, args.userId, conn, accessToken);
    }

    if (messagesAdded.length === 0) {
      // No new messages, but still update historyId to latest to move cursor
      if (latestHistoryId && latestHistoryId !== storedHistoryId) {
        await ctx.runMutation(internal.gmail.updateHistoryId, { connId: args.connId, historyId: latestHistoryId });
      } else if (latestHistoryId) {
        // Touch scan time to avoid rapid re-poll
        await ctx.runMutation(internal.gmail.touchScan, { connId: args.connId });
      }
      return { scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, historyId: latestHistoryId };
    }

    // Deduplicate message ids — process all (no silent drop); cap at 100 to bound single action
    const deduped = Array.from(new Map(messagesAdded.map((m) => [m.id, m])).values());
    if (deduped.length > 100) {
      console.warn("ingestIncremental large burst, capping at 100", { total: deduped.length, connId: args.connId });
    }
    const uniq = deduped.slice(0, 100);

    let scanned = 0, created = 0, merged = 0, skipped = 0, unparsed = 0, duplicate = 0, cancelled = 0;

    for (const m of uniq) {
      try {
        const msg = await getMessage(accessToken, m.id).catch(() => null);
        if (!msg) { skipped++; continue; }
        scanned++;
        const r = await processOneEmail(ctx, args.userId, msg.subject, msg.text, msg.html, msg.id, conn.accountEmail, conn._id, msg.from).catch(() => ({ status: "unparsed" as const }));
        if (r.status === "created") created++;
        else if (r.status === "merged") merged++;
        else if (r.status === "skipped") skipped++;
        else if (r.status === "unparsed") unparsed++;
        else if (r.status === "duplicate") duplicate++;
        else if (r.status === "cancelled") cancelled++;
        await new Promise((rr) => setTimeout(rr, 450));
      } catch {
        unparsed++;
      }
    }

    const newHistoryId = latestHistoryId ?? storedHistoryId;
    if (newHistoryId) {
      await ctx.runMutation(internal.gmail.touchHistoryAndScan, { connId: args.connId, historyId: newHistoryId });
    } else {
      await ctx.runMutation(internal.gmail.touchScan, { connId: args.connId });
    }

    return { scanned, created, merged, skipped, unparsed, duplicate, cancelled, historyId: newHistoryId };
  },
});

async function fallbackListIngest(
  ctx: any,
  userId: string,
  conn: any,
  accessToken: string,
): Promise<{ scanned: number; created: number; merged: number; skipped: number; unparsed: number; duplicate: number; cancelled: number; historyId?: string; reason?: string }> {
  // Hybrid: narrow subject filter first (cheap), if 0 hits retry broad inbox (catches "Thanks for your payment")
  const res = await ingestListQuery(ctx, userId, conn, accessToken, buildGmailQuery(7), 10);
  if (res.scanned > 0 || res.messagesFound > 0) {
    return await seedHistory(ctx, conn, accessToken, res);
  }
  const broad = await ingestListQuery(ctx, userId, conn, accessToken, buildBroadInboxQuery(7), 10);
  // Merge counts so caller sees total work
  const merged = {
    scanned: res.scanned + broad.scanned,
    created: res.created + broad.created,
    merged: res.merged + broad.merged,
    skipped: res.skipped + broad.skipped,
    unparsed: res.unparsed + broad.unparsed,
    duplicate: res.duplicate + broad.duplicate,
    cancelled: res.cancelled + broad.cancelled,
  };
  return await seedHistory(ctx, conn, accessToken, { ...merged, messagesFound: broad.messagesFound });
}

async function ingestListQuery(
  ctx: any,
  userId: string,
  conn: any,
  accessToken: string,
  q: string,
  max: number,
): Promise<{ scanned: number; created: number; merged: number; skipped: number; unparsed: number; duplicate: number; cancelled: number; messagesFound: number }> {
  let scanned = 0, created = 0, merged = 0, skipped = 0, unparsed = 0, duplicate = 0, cancelled = 0;
  const { messages } = await listMessages(accessToken, q, max);
  const slice = messages.slice(0, max);
  for (const m of slice) {
    const msg = await getMessage(accessToken, m.id).catch(() => null);
    if (!msg) { skipped++; continue; }
    scanned++;
    const r = await processOneEmail(ctx, userId, msg.subject, msg.text, msg.html, msg.id, conn.accountEmail, conn._id, msg.from).catch(() => ({ status: "unparsed" as const }));
    if (r.status === "created") created++;
    else if (r.status === "merged") merged++;
    else if (r.status === "skipped") skipped++;
    else if (r.status === "unparsed") unparsed++;
    else if (r.status === "duplicate") duplicate++;
    else if (r.status === "cancelled") cancelled++;
    await new Promise((rr) => setTimeout(rr, 450));
  }
  return { scanned, created, merged, skipped, unparsed, duplicate, cancelled, messagesFound: messages.length };
}

async function seedHistory(
  ctx: any,
  conn: any,
  accessToken: string,
  counts: { scanned: number; created: number; merged: number; skipped: number; unparsed: number; duplicate: number; cancelled: number; messagesFound?: number },
): Promise<{ scanned: number; created: number; merged: number; skipped: number; unparsed: number; duplicate: number; cancelled: number; historyId?: string; reason?: string }> {
  try {
    const hid = await getProfileHistoryId(accessToken);
    await ctx.runMutation(internal.gmail.updateHistoryId, { connId: conn._id, historyId: hid });
    await ctx.runMutation(internal.gmail.touchScan, { connId: conn._id });
    return { ...counts, historyId: hid, reason: "fallback_list" };
  } catch {
    await ctx.runMutation(internal.gmail.touchScan, { connId: conn._id });
    return { ...counts, reason: "fallback_list" };
  }
}

export const pollIncrementalForUser = internalAction({
  args: { userId: v.string() },
  returns: v.object({ scanned: v.number(), created: v.number(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const conns: any[] = await ctx.runQuery(internal.gmail.getConnectionsInternal, { userId: args.userId });
    const fixture = process.env.FIXTURE_GMAIL === "1";
    if (fixture) {
      // In fixture mode, delegate to scanForUser fixtures logic (reuse)
      const r: any = await ctx.runAction(internal.gmailActions.scanForUser, { userId: args.userId });
      return { scanned: r.scanned, created: r.created, reason: r.reason };
    }
    const active = conns.filter((c) => c.gmailRefreshToken && c.status === "connected" && c.gmailScopeGranted);
    if (active.length === 0) return { scanned: 0, created: 0, reason: "no_consent" };
    const eligible = active.filter((c) => !(c.lastGmailScanAt && Date.now() - c.lastGmailScanAt < COOLDOWN_MS));
    if (eligible.length === 0) return { scanned: 0, created: 0, reason: "cooldown" };
    let scanned = 0, created = 0;
    for (const conn of eligible) {
      try {
        const res: any = await ctx.runAction(internal.gmailWatch.ingestIncremental, {
          userId: args.userId,
          connId: conn._id,
        });
        scanned += res.scanned;
        created += res.created;
      } catch (e: any) {
        console.error("pollIncrementalForUser conn failed", conn._id, String(e));
      }
    }
    return { scanned, created };
  },
});

export const pollAllUsersIncremental = internalAction({
  args: {},
  returns: v.object({ polled: v.number(), scanned: v.number(), created: v.number() }),
  handler: async (ctx) => {
    const conns: any[] = await ctx.runQuery(internal.gmail.listAllGmailConnectionsInternal, {} as any);
    // Fan-out via scheduler to avoid single-run cron guard timeout at scale
    let scheduled = 0;
    for (const c of conns) {
      if (!c.gmailRefreshToken || c.status !== "connected" || !c.gmailScopeGranted) continue;
      if (c.lastGmailScanAt && Date.now() - c.lastGmailScanAt < COOLDOWN_MS) continue;
      try {
        await ctx.scheduler.runAfter(0, internal.gmailWatch.ingestIncremental, {
          userId: c.userId,
          connId: c._id,
        });
        scheduled++;
      } catch (e: any) {
        console.error("pollAll schedule failed", c._id, String(e));
      }
    }
    return { polled: scheduled, scanned: 0, created: 0 };
  },
});
