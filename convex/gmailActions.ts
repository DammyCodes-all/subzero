"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import {
  buildGmailQuery,
  getAccessToken,
  getMessage,
  getProfileHistoryId,
  isAuthError,
  listMessages,
} from "./lib/gmail";
import { processOneEmail } from "./lib/processEmail";

const COOLDOWN_MS = 10 * 60 * 1000;

export const scanForUser = internalAction({
  args: { userId: v.string() },
  returns: v.object({
    scanned: v.number(),
    created: v.number(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const conns: any[] = await ctx.runQuery(
      internal.gmailConnectionState.getConnectionsInternal,
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
        await ctx.runMutation(internal.gmailConnectionState.touchScan, { connId: first._id });
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
          await ctx.runMutation(internal.gmailConnectionState.touchScan, { connId: conn._id });
          try {
            const tok2 = await getAccessToken(conn.gmailRefreshToken);
            const hid = await getProfileHistoryId(tok2.accessToken);
            await ctx.runMutation(internal.gmailConnectionState.updateHistoryId as any, {
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
