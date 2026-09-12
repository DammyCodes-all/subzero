import agentmail from "@agentmail/convex/convex.config";
import firecrawl from "@firecrawl/firecrawl-convex/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    AGENTMAIL_API_KEY: v.optional(v.string()),
    AGENTMAIL_INBOX: v.optional(v.string()),
    AGENTMAIL_WEBHOOK_SECRET: v.optional(v.string()),
    OPENAI_API_KEY: v.optional(v.string()),
    GROQ_API_KEY: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.string(),
    NODE_ENV: v.optional(v.string()),
    GOOGLE_CLIENT_ID: v.optional(v.string()),
    GOOGLE_CLIENT_SECRET: v.optional(v.string()),
    FIXTURE_GMAIL: v.optional(v.string()),
    SITE_URL: v.optional(v.string()),
  },
});

// Official sponsor components. AgentMail handles durable outbound sends
// (enqueue + bounded retries + reactive delivery status); Firecrawl handles
// search/scrape for cancellation research. Secrets stay in deployment env.
// NOTE: @convex-dev/static-hosting is installed but NOT registered yet —
// Gmail OAuth lives in Next.js API routes, which a static export cannot
// serve. Registration waits on migrating OAuth to Convex HTTP actions.
app.use(agentmail, {
  // Forwards the app key into the component's isolated env. Without this,
  // every send fails with "AGENTMAIL_API_KEY is not set" even though the
  // key is set on the deployment (component reads it via process.env, see
  // patches/@agentmail+convex@0.1.0.patch which declares the vars).
  env: {
    AGENTMAIL_API_KEY: app.env.AGENTMAIL_API_KEY,
  },
});
app.use(firecrawl, {
  httpPrefix: "/firecrawl/",
  env: {
    FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY,
  },
});

export default app;
