import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    CONVEX_DEPLOYMENT: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    FIRECRAWL_API_KEY: z.string().optional(),
    AGENTMAIL_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_CONVEX_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    AGENTMAIL_API_KEY: process.env.AGENTMAIL_API_KEY,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
  skipValidation: true,
});
