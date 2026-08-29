import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    AGENTMAIL_API_KEY: v.optional(v.string()),
    AGENTMAIL_WEBHOOK_SECRET: v.optional(v.string()),
    OPENAI_API_KEY: v.optional(v.string()),
    GROQ_API_KEY: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.optional(v.string()),
    NODE_ENV: v.optional(v.string()),
  },
});

export default app;
