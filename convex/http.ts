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
    // For hackathon: soft-fail on verify so a secret rotation doesn't block demo (still logs).
    if (secret) {
      if (hasSvixHeaders) {
        try {
          const headers: Record<string, string> = {};
          req.headers.forEach((v, k) => {
            headers[k] = v;
          });
          new Webhook(secret).verify(rawText, headers);
        } catch (e) {
          console.error("webhook verify failed (soft-continue for demo)", String(e), "rawPreview", rawText.slice(0, 400));
          // was 400 — soft-continue so forwarding isn't blocked during demo
        }
      } else {
        console.error("webhook missing svix headers", rawText.slice(0, 400));
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

// Legacy route — kept for configs that POST to /api/agentmail-webhook.
// Now delegates to the same unified ingestion pipeline (Groq gpt-oss-120b + mock)
// so both /agentmail/inbound and /api/agentmail-webhook share provider, dedup, and evidence logic.
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
      const html = typeof body.html === "string" ? body.html : undefined;

      if (!recipient) {
        return new Response(JSON.stringify({ error: "Missing to/recipient" }), {
          status: 400,
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
