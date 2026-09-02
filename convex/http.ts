import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { auth } from "./auth";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response("ok", { status: 200 });
  }),
});

http.route({
  path: "/gmail/push",
  method: "GET",
  handler: httpAction(async () => {
    return new Response("ok", { status: 200 });
  }),
});

http.route({
  path: "/gmail/push",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const pushSecret = (env as any).GMAIL_PUSH_SECRET ?? process.env.GMAIL_PUSH_SECRET;
    const apiKey = env.AGENTMAIL_API_KEY ?? process.env.AGENTMAIL_API_KEY;
    const isProd = env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
    // In prod, require explicit GMAIL_PUSH_SECRET (don't fallback to AGENTMAIL_API_KEY to avoid cross-service forgery)
    const expected = isProd ? pushSecret : (pushSecret ?? apiKey);
    if (isProd) {
      if (!expected) return new Response("missing push secret", { status: 500 });
      if (querySecret !== expected) {
        if (!querySecret) return new Response("missing secret", { status: 401 });
        return new Response("invalid secret", { status: 401 });
      }
    } else {
      // Dev: soft-continue if secret mismatched, but log
      if (expected && querySecret && querySecret !== expected) {
        console.error("gmail push invalid secret (dev soft-continue)");
      }
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const msg = body?.message;
    if (!msg?.data) {
      // Ack even if malformed — avoid Pub/Sub retry storm
      console.error("gmail push missing data", JSON.stringify(body).slice(0, 500));
      return new Response(null, { status: 204 });
    }

    let decoded: string;
    try {
      // Pub/Sub data is base64 (sometimes base64url) — normalize
      const b64 = String(msg.data).replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
      decoded = Buffer.from(b64 + pad, "base64").toString("utf-8");
    } catch {
      console.error("gmail push base64 decode failed");
      return new Response(null, { status: 204 });
    }

    let payload: any;
    try {
      payload = JSON.parse(decoded);
    } catch {
      console.error("gmail push payload not json", decoded.slice(0, 300));
      return new Response(null, { status: 204 });
    }

    const emailAddress = typeof payload.emailAddress === "string" ? payload.emailAddress.toLowerCase().trim() : "";
    const historyId = typeof payload.historyId === "string" ? payload.historyId : typeof payload.historyId === "number" ? String(payload.historyId) : "";
    if (!emailAddress || !historyId) {
      console.error("gmail push missing emailAddress/historyId", payload);
      return new Response(null, { status: 204 });
    }

    console.log("gmail push received", JSON.stringify({ emailAddress, historyId, msgId: msg.messageId ?? msg.message_id }));

    // Lookup connections by accountEmail (connected gmail accounts)
    let conns: any[] = [];
    try {
      conns = await ctx.runQuery(internal.gmail.getConnectionsByEmailInternal, { email: emailAddress });
    } catch (e) {
      console.error("gmail push query failed", String(e));
    }
    const active = conns.filter((c) => c.status === "connected" && c.gmailScopeGranted && c.gmailRefreshToken);
    if (active.length === 0) {
      console.log("gmail push no active conn for", emailAddress);
      return new Response(null, { status: 204 });
    }

    for (const conn of active) {
      try {
        await ctx.scheduler.runAfter(0, internal.gmailWatch.ingestIncremental, {
          userId: conn.userId,
          connId: conn._id,
        });
      } catch (e) {
        console.error("gmail push schedule failed", conn._id, String(e));
      }
    }

    // Must ack fast — Pub/Sub expects 2xx within deadline, process continues async
    return new Response(null, { status: 204 });
  }),
});

http.route({
  path: "/agentmail/inbound",
  method: "GET",
  handler: httpAction(async () => {
    return new Response("ok", { status: 200 });
  }),
});

http.route({
  path: "/agentmail/inbound",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const rawBuf = await req.arrayBuffer();
    const rawText = new TextDecoder().decode(rawBuf);

    const secret = env.AGENTMAIL_WEBHOOK_SECRET ?? process.env.AGENTMAIL_WEBHOOK_SECRET;
    const apiKey = env.AGENTMAIL_API_KEY ?? process.env.AGENTMAIL_API_KEY;
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const hasSvixHeaders =
      req.headers.get("svix-id") !== null ||
      req.headers.get("svix-signature") !== null;

    // If webhook secret is configured it is authoritative — never honor ?secret=.
    if (secret) {
      if (hasSvixHeaders) {
        // Svix verify expects exactly svix-* headers, lowercased, and raw body
        const svixHeaders = {
          "svix-id": req.headers.get("svix-id") ?? "",
          "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
          "svix-signature": req.headers.get("svix-signature") ?? "",
        };
        let verified = false;
        let lastErr: unknown = null;
        // Try primary secret, then fallback without whsec_ prefix if needed
        const candidates = [secret];
        if (secret.startsWith("whsec_")) candidates.push(secret.slice(6));
        else candidates.push(`whsec_${secret}`);
        for (const cand of candidates) {
          try {
            new Webhook(cand).verify(rawText, svixHeaders as Record<string, string>);
            verified = true;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!verified) {
          const isProd = env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
          if (isProd) {
            console.error("webhook verify failed (BLOCKED in prod)", String(lastErr));
            return new Response("invalid signature", { status: 401 });
          }
          // Dev-only: log and continue for hackathon demo
          console.error("webhook verify failed (soft-continue for demo)", String(lastErr));
        }
      } else {
        console.error("webhook missing svix headers");
        return new Response("missing signature", { status: 401 });
      }
    } else {
      // No webhook secret configured — fail closed in prod, allow dev fixture via ?secret=API_KEY only.
      const isProd = env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
      if (isProd) {
        return new Response("missing webhook secret", { status: 500 });
      }
      if (querySecret) {
        if (!apiKey || querySecret !== apiKey) {
          return new Response("invalid secret", { status: 401 });
        }
      } else {
        // No secret and no querySecret — allow fixtures only outside prod (local dev)
        // isProd already handled above, so allow here.
      }
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch (e) {
      console.error("webhook invalid json", String(e), rawText.slice(0, 400));
      return new Response("invalid json", { status: 400 });
    }

    // Unwrap common AgentMail/Svix wrappers: message, data, payload, event.data
    const bodyRec0 = body as Record<string, unknown>;
    const unwrapCandidate =
      bodyRec0.message !== null && typeof bodyRec0.message === "object"
        ? (bodyRec0.message as Record<string, unknown>)
        : bodyRec0.data !== null && typeof bodyRec0.data === "object"
          ? (bodyRec0.data as Record<string, unknown>)
          : bodyRec0.payload !== null && typeof bodyRec0.payload === "object"
            ? (bodyRec0.payload as Record<string, unknown>)
            : null;
    // Also handle nested data.message (AgentMail sometimes sends { data: { message: {...}}})
    const nestedDataMsg =
      unwrapCandidate &&
      typeof (unwrapCandidate as Record<string, unknown>).message === "object" &&
      (unwrapCandidate as Record<string, unknown>).message !== null
        ? ((unwrapCandidate as Record<string, unknown>).message as Record<string, unknown>)
        : null;
    const effectiveHasMessage = unwrapCandidate !== null || nestedDataMsg !== null;

    if (!effectiveHasMessage) {
      if (
        typeof body !== "object" ||
        body === null ||
        (typeof (body as Record<string, unknown>).message !== "object" ||
          (body as Record<string, unknown>).message === null)
      ) {
        const maybeMsg = body as Record<string, unknown>;
        const hasDataMsg =
          maybeMsg.data !== null &&
          typeof maybeMsg.data === "object" &&
          typeof (maybeMsg.data as Record<string, unknown>).message === "object";
        if (
          typeof maybeMsg.inbox_id === "string" ||
          typeof maybeMsg.inboxId === "string" ||
          typeof maybeMsg.to === "string" ||
          hasDataMsg
        ) {
          // Direct message shape or wrapped data.message — allow
        } else {
          console.error("webhook missing message", rawText.slice(0, 800));
          return new Response("missing message", { status: 400 });
        }
      }
    }

    const bodyRec = body as Record<string, unknown>;
    const msgRaw =
      nestedDataMsg ??
      (bodyRec.message !== null && typeof bodyRec.message === "object"
        ? (bodyRec.message as Record<string, unknown>)
        : bodyRec.data !== null &&
            typeof bodyRec.data === "object" &&
            typeof (bodyRec.data as Record<string, unknown>).message === "object" &&
            (bodyRec.data as Record<string, unknown>).message !== null
          ? ((bodyRec.data as Record<string, unknown>).message as Record<string, unknown>)
          : bodyRec.data !== null && typeof bodyRec.data === "object"
            ? (bodyRec.data as Record<string, unknown>)
            : bodyRec.payload !== null && typeof bodyRec.payload === "object"
              ? (bodyRec.payload as Record<string, unknown>)
              : (body as Record<string, unknown>));

    // Prefer `to` (user's personal alias) over shared `inbox_id` for routing.
    // If webhook is configured per-inbox, `to` and `inbox_id` are the same;
    // if using a shared inbox, `to` carries the personal alias while
    // `inbox_id` is the shared inbox id — `to` must win.
    // Handle `to` as string or array (AgentMail sends to: ["subzero-agent@..."])
    const toRaw = (msgRaw as Record<string, unknown>).to;
    const toStr = typeof toRaw === "string"
      ? toRaw
      : Array.isArray(toRaw) && typeof toRaw[0] === "string"
        ? (toRaw[0] as string)
        : undefined;
    const inboxId =
      (toStr && toStr.includes("@") ? toStr : null) ??
      (typeof msgRaw.inbox_id === "string" ? msgRaw.inbox_id : null) ??
      (typeof msgRaw.inboxId === "string" ? msgRaw.inboxId : null) ??
      (typeof (msgRaw as Record<string, unknown>).inboxId === "string" ? (msgRaw as Record<string, unknown>).inboxId as string : null) ??
      (typeof (msgRaw as Record<string, unknown>).inbox === "string" ? (msgRaw as Record<string, unknown>).inbox as string : null) ??
      "";
    if (!inboxId) {
      console.error("webhook missing inbox_id keys", Object.keys(msgRaw), "rawPreview", rawText.slice(0, 800));
      return new Response("missing inbox_id", { status: 400 });
    }

    const toVal = toStr ?? inboxId;
    // from can be string "Name <email>" or object — extract email for routing
    const fromRaw = (msgRaw as Record<string, unknown>).from;
    let fromVal = typeof fromRaw === "string"
      ? fromRaw
      : fromRaw !== null && typeof fromRaw === "object" && typeof (fromRaw as Record<string, unknown>).email === "string"
        ? (fromRaw as Record<string, unknown>).email as string
        : typeof fromRaw === "string"
          ? fromRaw
          : "";
    // Normalize "Display <email>" → "email" for by_accountEmail lookup (shared inbox)
    const m = fromVal.match(/<([^>]+)>/);
    if (m) fromVal = m[1].trim();
    else {
      const at = fromVal.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
      if (at) fromVal = at[1].trim();
    }
    const subjectVal = typeof msgRaw.subject === "string" ? msgRaw.subject : typeof (msgRaw as Record<string, unknown>).subject === "string" ? (msgRaw as Record<string, unknown>).subject as string : "";
    // AgentMail webhook sends extracted_text / extracted_html, not text / html
    const textVal = typeof msgRaw.text === "string"
      ? msgRaw.text
      : typeof (msgRaw as Record<string, unknown>).extracted_text === "string"
        ? (msgRaw as Record<string, unknown>).extracted_text as string
        : typeof (msgRaw as Record<string, unknown>).body === "string"
          ? (msgRaw as Record<string, unknown>).body as string
          : typeof (msgRaw as Record<string, unknown>).text_content === "string"
            ? (msgRaw as Record<string, unknown>).text_content as string
            : undefined;
    const htmlVal = typeof msgRaw.html === "string"
      ? msgRaw.html
      : typeof (msgRaw as Record<string, unknown>).extracted_html === "string"
        ? (msgRaw as Record<string, unknown>).extracted_html as string
        : typeof (msgRaw as Record<string, unknown>).html_content === "string"
          ? (msgRaw as Record<string, unknown>).html_content as string
          : undefined;
    if (!textVal && !htmlVal) {
      console.error("webhook missing text/html", Object.keys(msgRaw), rawText.slice(0, 800));
    }
    console.log("webhook parsed", JSON.stringify({ inboxId, toVal, fromVal: fromVal.slice(0, 80), subjectLen: subjectVal.length, textLen: textVal?.length ?? 0, htmlLen: htmlVal?.length ?? 0, keys: Object.keys(msgRaw).slice(0, 12) }));
    const messageId =
      typeof msgRaw.messageId === "string"
        ? msgRaw.messageId
        : typeof msgRaw.message_id === "string"
          ? msgRaw.message_id
          : undefined;

    const svixId = req.headers.get("svix-id") ?? undefined;
    const svixTs = req.headers.get("svix-timestamp");
    const svixTimestamp = svixTs ? Number(svixTs) : undefined;

    // Only process message.received — ignore other event_types
    const eventType =
      typeof bodyRec.event_type === "string"
        ? bodyRec.event_type
        : typeof bodyRec.eventType === "string"
          ? bodyRec.eventType
          : null;
    if (eventType && eventType !== "message.received") {
      return new Response(null, { status: 204 });
    }

    // Create processing attempt synchronously so dashboard shows instantly via Convex reactivity.
    // Resolve user before inserting to avoid orphan rows visible to wrong user.
    let attemptId: Id<"ingestionAttempts"> | undefined = undefined;
    try {
      const routing: {
        userId: string;
        sourceEmail?: string;
        sourceConnectionId?: Id<"connections">;
      } | null = await ctx.runQuery(internal.agentmail.resolveRoutingByInbox, {
        inboxId,
        fallbackTo: toVal || undefined,
        fallbackFrom: fromVal || undefined,
      });
      if (routing) {
        const created: { attemptId: Id<"ingestionAttempts">; isNew: boolean } =
          await ctx.runMutation(internal.ingestionAttempts.createProcessingAttempt, {
            userId: routing.userId,
            svixId,
            messageId,
            inboxId,
            from: fromVal || undefined,
            subject: subjectVal || undefined,
            sourceEmail: routing.sourceEmail,
            sourceConnectionId: routing.sourceConnectionId,
          });
        if (!created.isNew) {
          // Svix retry — idempotent, no need to re-schedule
          return new Response(null, { status: 204 });
        }
        attemptId = created.attemptId;
      }
    } catch (e) {
      console.error("ingestionAttempts create failed", String(e));
    }

    await ctx.scheduler.runAfter(
      0,
      internal.ingestion.process.processForwardedEmail,
      {
        inboxId,
        to: toVal,
        from: fromVal,
        subject: subjectVal,
        text: textVal,
        html: htmlVal,
        svixId,
        svixTimestamp,
        messageId,
        ...(attemptId ? { attemptId } : {}),
      },
    );

    return new Response(null, { status: 204 });
  }),
});

// Legacy route — kept for configs that POST to /api/agentmail-webhook.
// Now delegates to the same unified ingestion pipeline (Groq gpt-oss-120b + mock)
// so both /agentmail/inbound and /api/agentmail-webhook share provider, dedup, and evidence logic.
// Requires ?secret=AGENTMAIL_API_KEY or Authorization Bearer in prod.
http.route({
  path: "/api/agentmail-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = env.AGENTMAIL_WEBHOOK_SECRET ?? process.env.AGENTMAIL_WEBHOOK_SECRET;
    const apiKey = env.AGENTMAIL_API_KEY ?? process.env.AGENTMAIL_API_KEY;
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isProd = env.NODE_ENV === "production" || process.env.NODE_ENV === "production";
    // In prod, require secret; in dev, allow without but log
    if (isProd || secret || apiKey) {
      const expected = secret ?? apiKey;
      const provided = querySecret ?? bearer;
      if (!expected || provided !== expected) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    try {
      const body = (await req.json()) as Record<string, unknown>;
      if (!body || typeof body !== "object") {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const recipient =
        typeof body.to === "string"
          ? body.to
          : typeof body.recipient === "string"
            ? body.recipient
            : "";
      const subject = typeof body.subject === "string" ? body.subject : "";
      const text =
        typeof body.text === "string"
          ? body.text
          : typeof body.html === "string"
            ? body.html
            : "";
      const html = typeof body.html === "string" ? body.html : undefined;

      if (!recipient) {
        return new Response(JSON.stringify({ error: "Missing to/recipient" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create processing attempt for instant feedback (same as /agentmail/inbound)
      let legacyAttemptId: Id<"ingestionAttempts"> | undefined = undefined;
      let isLegacyNew = true;
      try {
        const legacyFrom = typeof body.from === "string" ? body.from : "";
        const legacyRouting: {
          userId: string;
          sourceEmail?: string;
          sourceConnectionId?: Id<"connections">;
        } | null = await ctx.runQuery(internal.agentmail.resolveRoutingByInbox, {
          inboxId: recipient,
          fallbackTo: recipient || undefined,
          fallbackFrom: legacyFrom || undefined,
        });
        if (legacyRouting) {
          const created: { attemptId: Id<"ingestionAttempts">; isNew: boolean } =
            await ctx.runMutation(internal.ingestionAttempts.createProcessingAttempt, {
              userId: legacyRouting.userId,
              inboxId: recipient,
              from: legacyFrom || undefined,
              subject: subject || undefined,
              sourceEmail: legacyRouting.sourceEmail,
              sourceConnectionId: legacyRouting.sourceConnectionId,
            });
          if (!created.isNew) isLegacyNew = false;
          else legacyAttemptId = created.attemptId;
        }
      } catch (e) {
        console.error("legacy ingestionAttempts create failed", String(e));
      }
      if (!isLegacyNew) {
        return new Response(JSON.stringify({ status: "queued", dedup: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Reuse the canonical forwarding pipeline (same Groq provider, same persist, same svix dedup).
      // Fire-and-forget via scheduler to keep webhook fast, then return 202.
      await ctx.scheduler.runAfter(0, internal.ingestion.process.processForwardedEmail, {
        inboxId: recipient,
        to: recipient,
        from: typeof body.from === "string" ? body.from : "",
        subject,
        text,
        html,
        svixId: undefined,
        messageId: undefined,
        ...(legacyAttemptId ? { attemptId: legacyAttemptId } : {}),
      });

      return new Response(JSON.stringify({ status: "queued" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
