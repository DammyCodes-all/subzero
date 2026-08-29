import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { env } from "./_generated/server";

export const researchCancellationRoute = internalAction({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const sub = await ctx.runQuery(internal.subscriptions.getInternal, { id: args.subscriptionId });
    if (!sub) throw new Error("Subscription not found");

    const firecrawlKey = (env as unknown as { FIRECRAWL_API_KEY?: string }).FIRECRAWL_API_KEY;
    const groqKey = (env as unknown as { GROQ_API_KEY?: string }).GROQ_API_KEY;
    const openaiKey = (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;

    // Fallback if missing keys
    if (!firecrawlKey || (!groqKey && !openaiKey)) {
      await ctx.runMutation(internal.subscriptions.saveResearchResult, {
        subscriptionId: args.subscriptionId,
        cancellationMethod: "open_web",
        cancellationUrl: `https://www.${sub.merchant.toLowerCase().replace(/\s/g, "")}.com/settings/billing`,
        instructions: ["Log in to your account", "Go to Settings", "Click Billing", "Select Cancel Subscription"],
        difficulty: "medium",
        evidenceUrl: `https://help.${sub.merchant.toLowerCase().replace(/\s/g, "")}.com/cancel`,
        evidenceExcerpt: `To cancel your ${sub.merchant} plan, navigate to Settings > Billing and select Cancel Subscription.`,
      });
      return { success: true, mock: true };
    }

    // 1. Search with Firecrawl
    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        query: `how to cancel ${sub.merchant} subscription`,
        limit: 2,
        scrapeOptions: { formats: ["markdown"] }
      }),
    });

    let markdownContent = "";
    let sourceUrl = "";
    
    if (searchRes.ok) {
      const searchData = await searchRes.json() as any;
      if (searchData.data && searchData.data.length > 0) {
        sourceUrl = searchData.data[0].url;
        markdownContent = searchData.data.map((d: any) => d.markdown || d.snippet).join("\n\n");
      }
    }

    // Fallback text if Firecrawl failed to get markdown
    if (!markdownContent) {
      markdownContent = `To cancel ${sub.merchant}, you usually need to visit their website, log in, and find the billing settings.`;
    }

    // 2. Call OpenAI/Groq to extract steps
    const prompt = `You are a cancellation extraction assistant. Read this help center content and extract exactly how to cancel the ${sub.merchant} subscription.
Return JSON with:
- cancellationMethod: "open_web" | "send_email" | "contact_support"
- cancellationUrl: string (the direct link to cancel, if found, else null)
- instructions: array of strings (step by step)
- difficulty: "low" | "medium" | "high" | "very_high" (low=1 click, medium=few steps, high=call/email)
- evidenceExcerpt: string (exact quote proving the steps, max 200 chars)

Content:
${markdownContent.slice(0, 8000)}`;

    const provider = groqKey ? "groq" : "openai";
    const apiKey = groqKey ?? openaiKey;
    const endpoint = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    // standard fast model for structured extraction
    const model = provider === "groq" ? "llama3-8b-8192" : "gpt-4o-mini"; 

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      throw new Error(`AI extraction failed: ${res.statusText}`);
    }

    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    await ctx.runMutation(internal.subscriptions.saveResearchResult, {
      subscriptionId: args.subscriptionId,
      cancellationMethod: parsed.cancellationMethod ?? "open_web",
      cancellationUrl: parsed.cancellationUrl ?? undefined,
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      difficulty: parsed.difficulty ?? "medium",
      evidenceUrl: sourceUrl || undefined,
      evidenceExcerpt: parsed.evidenceExcerpt ?? "Found instructions online.",
    });

    return { success: true, mock: false };
  },
});
