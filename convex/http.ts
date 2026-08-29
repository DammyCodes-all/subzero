import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { auth } from "./auth";

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
        try {
          const headers: Record<string, string> = {};
          req.headers.forEach((v, k) => {
            headers[k] = v;
          });
          new Webhook(secret).verify(rawText, headers);
        } catch {
          return new Response("invalid signature", { status: 400 });
        }
      } else {
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
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      (typeof (body as Record<string, unknown>).message !== "object" ||
        (body as Record<string, unknown>).message === null)
    ) {
      // Some AgentMail payloads are { event_type, message: { inbox_id, ... } } — body must have message
      // For generic fixture without wrapper, treat body itself as message
      const maybeMsg = body as Record<string, unknown>;
      if (
        typeof maybeMsg.inbox_id === "string" ||
        typeof maybeMsg.inboxId === "string" ||
        typeof maybeMsg.to === "string"
      ) {
        // Direct message shape
      } else {
        return new Response("missing message", { status: 400 });
      }
    }

    const bodyRec = body as Record<string, unknown>;
    const msgRaw =
      bodyRec.message !== null &&
      typeof bodyRec.message === "object"
        ? (bodyRec.message as Record<string, unknown>)
        : (body as Record<string, unknown>);

    // Prefer `to` (user's personal alias) over shared `inbox_id` for routing.
    // If webhook is configured per-inbox, `to` and `inbox_id` are the same;
    // if using a shared inbox, `to` carries the personal alias while
    // `inbox_id` is the shared inbox id — `to` must win.
    const inboxId =
      (typeof msgRaw.to === "string" && msgRaw.to.includes("@")
        ? msgRaw.to
        : null) ??
      (typeof msgRaw.inbox_id === "string" ? msgRaw.inbox_id : null) ??
      (typeof msgRaw.inboxId === "string" ? msgRaw.inboxId : null) ??
      "";
    if (!inboxId) return new Response("missing inbox_id", { status: 400 });

    const toVal = typeof msgRaw.to === "string" ? msgRaw.to : inboxId;
    const fromVal = typeof msgRaw.from === "string" ? msgRaw.from : "";
    const subjectVal = typeof msgRaw.subject === "string" ? msgRaw.subject : "";
    const textVal = typeof msgRaw.text === "string" ? msgRaw.text : undefined;
    const htmlVal = typeof msgRaw.html === "string" ? msgRaw.html : undefined;
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
      },
    );

    return new Response(null, { status: 204 });
  }),
});

// Legacy / compatibility route from feat/ai-extraction — kept for existing AgentMail
// configs that POST to /api/agentmail-webhook with { to|recipient, subject, text|html }.
// Delegates to the same ingestion path via ai.extractFromTextInternal.
http.route({
  path: "/api/agentmail-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
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

      const fullEmailContent = `Subject: ${subject}\n\n${text}`;

      const userId: string | null = await ctx.runQuery(
        internal.connections.getUserIdForEmail,
        { email: recipient },
      );

      if (!userId) {
        return new Response(
          JSON.stringify({
            error: "No target user connection found for email",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }

      const result: {
        success: boolean;
        subscriptionId?: string;
        merchant?: string;
        reason?: string;
      } = await ctx.runAction(internal.ai.extractFromTextInternal, {
        userId,
        rawText: fullEmailContent,
        sourceName: `Forwarded email: ${subject.slice(0, 40)}`,
      });

      return new Response(JSON.stringify({ status: "processed", result }), {
        status: 200,
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
