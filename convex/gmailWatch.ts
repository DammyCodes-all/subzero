"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  getAccessToken,
  getHistory,
  getProfileHistoryId,
  isAuthError,
  watchGmail,
  stopWatch,
} from "./lib/gmail";
import { BACKFILL_PER_TICK, runBackfillBatch } from "./gmailBackfill";
import {
  fetchAndHandle,
  newScanCounters,
  runDueRetries,
} from "./lib/gmailProcess";

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
    const conn: any = await ctx.runQuery(internal.gmailConnectionState.getConnectionByIdInternal, {
      connId: args.connId,
    } as any);
    if (!conn || !conn.gmailRefreshToken || conn.status !== "connected" || !conn.gmailScopeGranted) {
      return { watched: false, reason: "no_consent" };
    }
    try {
      const tok = await getAccessToken(conn.gmailRefreshToken);
      const res = await watchGmail(tok.accessToken, topic);
      await ctx.runMutation(internal.gmailConnectionState.storeWatchState, {
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
      const conn: any = await ctx.runQuery(internal.gmailConnectionState.getConnectionByIdInternal, {
        connId: args.connId,
      } as any);
      token = conn?.gmailRefreshToken;
    }
    if (!token) return { stopped: false, reason: "no_token" };
    try {
      const tok = await getAccessToken(token);
      await stopWatch(tok.accessToken);
      await ctx.runMutation(internal.gmailConnectionState.clearWatchState, { connId: args.connId });
      return { stopped: true };
    } catch (e: any) {
      console.error("stopWatch failed", args.connId, String(e));
      // Still clear local state to avoid stuck expiration
      try { await ctx.runMutation(internal.gmailConnectionState.clearWatchState, { connId: args.connId }); } catch {}
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
    const conns: any[] = await ctx.runQuery(internal.gmailConnectionState.listAllGmailConnectionsInternal, {} as any);
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
        await ctx.runMutation(internal.gmailConnectionState.storeWatchState, {
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
    trigger: v.optional(
      v.union(
        v.literal("poll"),
        v.literal("push"),
        v.literal("manual"),
        v.literal("connect"),
      ),
    ),
  },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    merged: v.number(),
    skipped: v.number(),
    unparsed: v.number(),
    duplicate: v.number(),
    cancelled: v.number(),
    failed: v.number(),
    historyId: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const trigger = args.trigger ?? "poll";
    const finish = async (counts: {
      scanned: number;
      created: number;
      merged: number;
      skipped: number;
      unparsed: number;
      duplicate: number;
      cancelled: number;
      failed: number;
      historyId?: string;
      reason?: string;
    }) => {
      try {
        await ctx.runMutation(internal.gmailRetries.recordRun, {
          userId: args.userId,
          connId: args.connId,
          trigger,
          scanned: counts.scanned,
          created: counts.created,
          failed: counts.failed,
        });
      } catch (e) {
        console.error("recordRun failed", args.connId, String(e).slice(0, 200));
      }
      return counts;
    };
    // Load connection to get refresh token and historyId fallback
    const conn: any = await ctx.runQuery(internal.gmailConnectionState.getConnectionByIdInternal, {
      connId: args.connId,
    } as any);
    if (!conn || !conn.gmailRefreshToken) {
      return await finish({ scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, failed: 0, reason: "no_consent" });
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
      if (isAuthError(msg)) {
        try {
          await ctx.runMutation(internal.gmail.markTokenInvalid, { connId: args.connId });
        } catch {}
      }
      return await finish({ scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, failed: 0, reason: "token_failed" });
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
          // Dead cursor — seed the live cursor and start the resumable backfill
          console.warn("history 404 starting backfill", args.connId, String(e).slice(0, 200));
          return await finish(await fallbackListIngest(ctx, args.userId, conn, accessToken));
        }
        // Transient Gmail error (rate limit, 5xx): don't throw and skip the
        // tick silently — record it and keep the cursor so the next cron
        // retries from the same place.
        console.error("history transient, keeping cursor", args.connId, String(e).slice(0, 200));
        return await finish({ scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, failed: 0, reason: "transient" });
      }
    } else {
      // No historyId yet — fallbackListIngest already seeds historyId via profile
      return await finish(await fallbackListIngest(ctx, args.userId, conn, accessToken));
    }

    if (messagesAdded.length === 0) {
      // No new messages, but still update historyId to latest to move cursor
      if (latestHistoryId && latestHistoryId !== storedHistoryId) {
        await ctx.runMutation(internal.gmailConnectionState.updateHistoryId, { connId: args.connId, historyId: latestHistoryId });
      } else if (latestHistoryId) {
        // Touch scan time to avoid rapid re-poll
        await ctx.runMutation(internal.gmailConnectionState.touchScan, { connId: args.connId });
      }
      return await finish({ scanned: 0, created: 0, merged: 0, skipped: 0, unparsed: 0, duplicate: 0, cancelled: 0, failed: 0, historyId: latestHistoryId });
    }

    // Deduplicate message ids — process all (no silent drop); cap at 100 to bound single action
    const deduped = Array.from(new Map(messagesAdded.map((m) => [m.id, m])).values());
    if (deduped.length > 100) {
      console.warn("ingestIncremental large burst, capping at 100", { total: deduped.length, connId: args.connId });
    }
    const uniq = deduped.slice(0, 100);

    const c = newScanCounters();

    for (const m of uniq) {
      await fetchAndHandle(ctx, args.userId, conn, accessToken, m.id, c);
      await new Promise((rr) => setTimeout(rr, 450));
    }

    // Live mail first, then due retries from the safety net, then backfill.
    await runDueRetries(ctx, args.userId, conn, accessToken, 25, c);
    await runBackfillBatch(ctx, args.userId, conn, accessToken, BACKFILL_PER_TICK, c);

    const newHistoryId = latestHistoryId ?? storedHistoryId;
    if (newHistoryId) {
      await ctx.runMutation(internal.gmailConnectionState.touchHistoryAndScan, { connId: args.connId, historyId: newHistoryId });
    } else {
      await ctx.runMutation(internal.gmailConnectionState.touchScan, { connId: args.connId });
    }

    return await finish({ ...c, historyId: newHistoryId });
  },
});

async function fallbackListIngest(
  ctx: any,
  userId: string,
  conn: any,
  accessToken: string,
): Promise<{ scanned: number; created: number; merged: number; skipped: number; unparsed: number; duplicate: number; cancelled: number; failed: number; historyId?: string; reason?: string }> {
  // Dead cursor (or first sync): seed the live cursor for future ticks and
  // start the resumable 90-day backfill instead of a one-shot 7-day list.
  // The first batch runs inline so a fresh connection shows results fast.
  let historyId: string | undefined;
  try {
    historyId = await getProfileHistoryId(accessToken);
    await ctx.runMutation(internal.gmailConnectionState.updateHistoryId, {
      connId: conn._id,
      historyId,
    });
  } catch {
    await ctx.runMutation(internal.gmailConnectionState.touchScan, { connId: conn._id });
  }
  await ctx.runMutation(internal.gmailBackfill.seedBackfill, { connId: conn._id });
  const c = newScanCounters();
  await runBackfillBatch(
    ctx,
    userId,
    {
      ...conn,
      gmailBackfillSeededAt: Date.now(),
      gmailBackfillQuery: "narrow",
      gmailBackfillPageToken: undefined,
      gmailBackfillProcessed: 0,
    },
    accessToken,
    BACKFILL_PER_TICK,
    c,
  );
  return { ...c, historyId, reason: "backfill_started" };
}

export const pollIncrementalForUser = internalAction({
  args: { userId: v.string() },
  returns: v.object({ scanned: v.number(), created: v.number(), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const conns: any[] = await ctx.runQuery(internal.gmailConnectionState.getConnectionsInternal, { userId: args.userId });
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
          trigger: "connect",
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
  returns: v.object({
    polled: v.number(),
    scanned: v.number(),
    created: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx) => {
    const conns: any[] = await ctx.runQuery(internal.gmailConnectionState.listAllGmailConnectionsInternal, {} as any);
    const eligible = conns.filter(
      (c) =>
        c.gmailRefreshToken &&
        c.status === "connected" &&
        c.gmailScopeGranted &&
        !(c.lastGmailScanAt && Date.now() - c.lastGmailScanAt < COOLDOWN_MS),
    );
    // Small fleet: run inline and report real totals. Large fleet: fan out
    // via scheduler to avoid single-run cron guard timeout at scale.
    if (eligible.length <= 5) {
      let scanned = 0,
        created = 0,
        failed = 0;
      for (const c of eligible) {
        try {
          const res: any = await ctx.runAction(
            internal.gmailWatch.ingestIncremental,
            {
              userId: c.userId,
              connId: c._id,
              trigger: "poll",
            },
          );
          scanned += res.scanned;
          created += res.created;
          failed += res.failed ?? 0;
        } catch (e: any) {
          console.error("pollAll inline failed", c._id, String(e));
        }
      }
      return { polled: eligible.length, scanned, created, failed };
    }
    let scheduled = 0;
    for (const c of eligible) {
      try {
        await ctx.scheduler.runAfter(0, internal.gmailWatch.ingestIncremental, {
          userId: c.userId,
          connId: c._id,
          trigger: "poll",
        });
        scheduled++;
      } catch (e: any) {
        console.error("pollAll schedule failed", c._id, String(e));
      }
    }
    return { polled: scheduled, scanned: 0, created: 0, failed: 0 };
  },
});
