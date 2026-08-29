import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
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
