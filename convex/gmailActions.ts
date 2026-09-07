"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import {
  buildGmailQuery,
  getAccessToken,
  getMessage,
  getProfileHistoryId,
  listMessages,
} from "./lib/gmail";
import { processOneEmail } from "./lib/processEmail";

const COOLDOWN_MS = 10 * 60 * 1000;

const AUTH_ERROR_RE =
  /\b(400|401|403)\b|invalid_grant|invalid_client|\brevoked\b|\bexpired\b/i;

function isAuthError(msg: string): boolean {
  return AUTH_ERROR_RE.test(msg);
}

export const scanGmail = action({
  args: { connectionId: v.optional(v.id("connections")) },
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
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const conns: any[] = await ctx.runQuery(
      internal.gmail.getConnectionsInternal,
      { userId },
    );
    const fixture = process.env.FIXTURE_GMAIL === "1";
    let scanned = 0,
      created = 0,
      merged = 0,
      skipped = 0,
      unparsed = 0,
      duplicate = 0,
      cancelled = 0;

    if (fixture) {
      // Fixtures are user-agnostic — scan once
      const first = conns[0];
      if (
        first?.lastGmailScanAt &&
        Date.now() - first.lastGmailScanAt < COOLDOWN_MS
      ) {
        return {
          scanned: 0,
          created: 0,
          merged: 0,
          skipped: 0,
          unparsed: 0,
          duplicate: 0,
          cancelled: 0,
          reason: "cooldown",
        };
      }
      const { fixtures } = await import("./ingestion/fixtures");
      const list = Object.values(fixtures);
      for (const f of list) {
        scanned++;
        const r = await processOneEmail(
          ctx,
          userId,
          f.subject,
          f.text,
          f.html ?? "",
          `fixture:${f.subject.slice(0, 20)}`,
          undefined,
          undefined,
          f.from,
        );
        if (r.status === "created") created++;
        else if (r.status === "merged") merged++;
        else if (r.status === "skipped") skipped++;
        else if (r.status === "unparsed") unparsed++;
        else if (r.status === "duplicate") duplicate++;
        else if (r.status === "cancelled") cancelled++;
      }
      if (first?._id)
        await ctx.runMutation(internal.gmail.touchScan as any, {
          connId: first._id,
        });
      return {
        scanned,
        created,
        merged,
        skipped,
        unparsed,
        duplicate,
        cancelled,
      };
    }

    const active = conns.filter(
      (c) =>
        c.gmailRefreshToken &&
        c.gmailScopeGranted &&
        c.status === "connected" &&
        (!args.connectionId || c._id === args.connectionId),
    );
    if (active.length === 0) {
      return {
        scanned: 0,
        created: 0,
        merged: 0,
        skipped: 0,
        unparsed: 0,
        duplicate: 0,
        cancelled: 0,
        reason: "no_consent",
      };
    }

    let anyScanned = false;
    let authFailed = false;
    let completedAnyConn = false;
    for (const conn of active) {
      // Per-connection cooldown — skip connections scanned recently, scan the rest
      if (
        conn.lastGmailScanAt &&
        Date.now() - conn.lastGmailScanAt < COOLDOWN_MS
      ) {
        continue;
      }
      let accessToken: string;
      try {
        const tok = await getAccessToken(conn.gmailRefreshToken);
        accessToken = tok.accessToken;
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (isAuthError(msg)) {
          authFailed = true;
          try {
            await ctx.runMutation(internal.gmail.markTokenInvalid, {
              connId: conn._id,
            });
          } catch {}
        }
        // Non-auth token failures fall through to scan_failed below —
        // don't misreport them as no_consent.
        continue;
      }

      const q = buildGmailQuery(60);
      let pageToken: string | undefined;
      let pages = 0;
      const maxPages = 2;
      let connCompleted = false;
      try {
        do {
          const { messages, nextPageToken } = await listMessages(
            accessToken,
            q,
            15,
            pageToken,
          );
          pageToken = nextPageToken;
          pages++;
          for (let i = 0; i < messages.length; i += 5) {
            const batch = messages.slice(i, i + 5);
            const fetched = await Promise.all(
              batch.map((m) => getMessage(accessToken, m.id).catch(() => null)),
            );
            for (const msg of fetched) {
              if (!msg) {
                skipped++;
                continue;
              }
              scanned++;
              anyScanned = true;
              try {
                const r = await processOneEmail(
                  ctx,
                  userId,
                  msg.subject,
                  msg.text,
                  msg.html,
                  msg.id,
                  conn.accountEmail,
                  conn._id,
                  msg.from,
                );
                if (r.status === "created") created++;
                else if (r.status === "merged") merged++;
                else if (r.status === "skipped") skipped++;
                else if (r.status === "unparsed") unparsed++;
                else if (r.status === "duplicate") duplicate++;
                else if (r.status === "cancelled") cancelled++;
              } catch {
                unparsed++;
              }
              // Throttle to stay under Groq 8000 TPM when scanning 30 mails
              await new Promise((rr) => setTimeout(rr, 450));
            }
          }
          if (!pageToken) break;
        } while (pages < maxPages);
        connCompleted = true;
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (isAuthError(msg)) {
          authFailed = true;
          try {
            await ctx.runMutation(internal.gmail.markTokenInvalid, {
              connId: conn._id,
            });
          } catch {}
        }
        // Transient list failure — don't touchScan so retry isn't blocked by cooldown.
        continue;
      }

      if (connCompleted && conn?._id) {
        completedAnyConn = true;
        await ctx.runMutation(internal.gmail.touchScan as any, {
          connId: conn._id,
        });
        // Seed historyId for future incremental poll (proactive watching)
        try {
          const hid = await getProfileHistoryId(accessToken);
          await ctx.runMutation(internal.gmail.updateHistoryId as any, {
            connId: conn._id,
            historyId: hid,
          });
        } catch {}
        // Best-effort ensure watch if topic configured
        try {
          await ctx.scheduler.runAfter(
            0,
            internal.gmailWatch.ensureWatchForConn as any,
            { connId: conn._id },
          );
        } catch {}
      }
    }

    if (!anyScanned && scanned === 0) {
      if (authFailed && !completedAnyConn) {
        return {
          scanned,
          created,
          merged,
          skipped,
          unparsed,
          duplicate,
          cancelled,
          reason: "no_consent",
        };
      }
      const allOnCooldown = active.every(
        (c) =>
          c.lastGmailScanAt && Date.now() - c.lastGmailScanAt < COOLDOWN_MS,
      );
      if (allOnCooldown) {
        return {
          scanned,
          created,
          merged,
          skipped,
          unparsed,
          duplicate,
          cancelled,
          reason: "cooldown",
        };
      }
      if (!completedAnyConn) {
        return {
          scanned,
          created,
          merged,
          skipped,
          unparsed,
          duplicate,
          cancelled,
          reason: "scan_failed",
        };
      }
    }
    return {
      scanned,
      created,
      merged,
      skipped,
      unparsed,
      duplicate,
      cancelled,
    };
  },
});

export const scanForUser = internalAction({
  args: { userId: v.string() },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const conns: any[] = await ctx.runQuery(
      internal.gmail.getConnectionsInternal,
      { userId: args.userId },
    );
    const fixture = process.env.FIXTURE_GMAIL === "1";
    if (fixture) {
      const first = conns[0];
      if (
        first?.lastGmailScanAt &&
        Date.now() - first.lastGmailScanAt < COOLDOWN_MS
      )
        return { scanned: 0, created: 0, reason: "cooldown" };
      const { fixtures } = await import("./ingestion/fixtures");
      let scanned = 0,
        created = 0;
      for (const f of Object.values(fixtures)) {
        scanned++;
        const r = await processOneEmail(
          ctx,
          args.userId,
          f.subject,
          f.text,
          f.html ?? "",
          `fixture:${f.subject.slice(0, 20)}`,
          undefined,
          undefined,
          f.from,
        );
        if (r.status === "created") created++;
      }
      if (first?._id)
        await ctx.runMutation(internal.gmail.touchScan, { connId: first._id });
      return { scanned, created };
    }
    const active = conns.filter(
      (c) => c.gmailRefreshToken && c.status === "connected",
    );
    if (active.length === 0)
      return { scanned: 0, created: 0, reason: "no_consent" };
    const eligible = active.filter(
      (c) =>
        !(c.lastGmailScanAt && Date.now() - c.lastGmailScanAt < COOLDOWN_MS),
    );
    if (eligible.length === 0)
      return { scanned: 0, created: 0, reason: "cooldown" };
    let scanned = 0,
      created = 0;
    for (const conn of eligible) {
      try {
        const tok = await getAccessToken(conn.gmailRefreshToken);
        const q = buildGmailQuery(60);
        const { messages } = await listMessages(tok.accessToken, q, 15);
        for (const m of messages.slice(0, 5)) {
          const msg = await getMessage(tok.accessToken, m.id).catch(() => null);
          if (!msg) continue;
          scanned++;
          const r = await processOneEmail(
            ctx,
            args.userId,
            msg.subject,
            msg.text,
            msg.html,
            msg.id,
            conn.accountEmail,
            conn._id,
            msg.from,
          ).catch(() => ({ status: "unparsed" }));
          if (r.status === "created") created++;
          await new Promise((rr) => setTimeout(rr, 450));
        }
        if (conn?._id) {
          await ctx.runMutation(internal.gmail.touchScan, { connId: conn._id });
          try {
            const tok2 = await getAccessToken(conn.gmailRefreshToken);
            const hid = await getProfileHistoryId(tok2.accessToken);
            await ctx.runMutation(internal.gmail.updateHistoryId as any, {
              connId: conn._id,
              historyId: hid,
            });
          } catch {}
        }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (isAuthError(msg)) {
          try {
            await ctx.runMutation(internal.gmail.markTokenInvalid, {
              connId: conn._id,
            });
          } catch {}
        }
      }
    }
    return { scanned, created };
  },
});

export const triggerScanForCurrentUser: any = action({
  args: {},
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx: any) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.runAction(internal.gmailActions.scanForUser, { userId });
  },
});
