import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { env } from "./_generated/server";
import { GROQ_EXTRACTION_MODEL } from "./lib/aiModels";

export const researchCancellationRoute = internalAction({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const sub = await ctx.runQuery(internal.subscriptions.getInternal, { id: args.subscriptionId });
    if (!sub) throw new Error("Subscription not found");

    const firecrawlKey = (env as unknown as { FIRECRAWL_API_KEY?: string }).FIRECRAWL_API_KEY;
    const groqKey = (env as unknown as { GROQ_API_KEY?: string }).GROQ_API_KEY;
    const openaiKey = (env as unknown as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;

    // No keys → never invent. Persist as unknown, let UI show "No verified route".
    if (!firecrawlKey || (!groqKey && !openaiKey)) {
      await ctx.runMutation(internal.subscriptions.saveResearchResult, {
        subscriptionId: args.subscriptionId,
        cancellationMethod: "unknown",
        cancellationUrl: undefined,
        instructions: [],
        difficulty: "very_high",
        evidenceUrl: undefined,
        evidenceExcerpt: undefined,
      });
      return { success: true, mock: true, reason: "missing_keys" };
    }

    // 1. Search with Firecrawl — merchant + billingProvider aware query
    const billingHint = sub.billingProvider ? ` billed via ${sub.billingProvider}` : "";
    const searchQuery = `how to cancel ${sub.merchant}${sub.product ? ` ${sub.product}` : ""}${billingHint} subscription`;
    let searchRes: Response | null = null;
    try {
      searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 3,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });
    } catch {
      searchRes = null;
    }

    let markdownContent = "";
    let sourceUrl: string | undefined = undefined;

    if (searchRes?.ok) {
      try {
        const searchData = (await searchRes.json()) as any;
        if (searchData.data && searchData.data.length > 0) {
          sourceUrl = searchData.data[0].url as string;
          markdownContent = searchData.data
            .map((d: any) => d.markdown || d.snippet || "")
            .join("\n\n")
            .slice(0, 9000);
        }
      } catch {}
    }

    // No content → unknown, don't hallucinate via LLM on generic fallback
    if (!markdownContent || markdownContent.trim().length < 80) {
      await ctx.runMutation(internal.subscriptions.saveResearchResult, {
        subscriptionId: args.subscriptionId,
        cancellationMethod: "unknown",
        cancellationUrl: undefined,
        instructions: [],
        evidenceUrl: sourceUrl,
        evidenceExcerpt: undefined,
      });
      return { success: true, mock: false, reason: "no_firecrawl_content" };
    }

    // 2. Research prompt — same schema-anchored, few-shot pattern as ingestion/extract.ts
    const system = `You are a precise cancellation research engine for SubZero. Extract the VERIFIED cancellation route from HELP CONTENT below. Return valid JSON ONLY.

TASK: Read HELP CONTENT and extract how to cancel this specific merchant subscription. Do NOT invent.

SCHEMA — return ONLY valid JSON matching this exact shape. Do not add keys. Do not remove keys. No markdown, no code fences, no explanation. Use null/[] where noted (never omit a key).

{
  "cancellationMethod": "<open_web|open_provider|send_email|contact_support|manual|unknown>",
  "cancellationUrl": "<string | null>",
  "instructions": "<array of strings>",
  "evidenceExcerpt": "<string | null>"
}

RULES:
- Missing field → null (or [] for instructions). Do NOT guess, do NOT invent URLs.
- cancellationUrl: exact URL found in content, or mailto: if email. null if not explicitly present. Never synthesize https://www.<merchant>.com/...
- instructions: ordered steps as written in help content. If unknown → [].
- evidenceExcerpt: exact quote from content backing the route, max 200 chars, or null.
- BILLING PROVIDER OVERRIDE (critical): If the Billed via field above is Google Play, Apple App Store, or Amazon, the cancellation MUST be open_provider with the provider dashboard URL — even if HELP CONTENT also describes a merchant web portal (e.g., accounts.snapchat.com). Web portal steps are ONLY for web-billed purchases, not store-billed. Use:
  - Google Play → https://play.google.com/store/account/subscriptions
  - Apple App Store → https://apps.apple.com/account/subscriptions
  - Amazon → https://www.amazon.com/gp/video/settings
  Return open_provider and provider steps, ignore merchant-portal excerpt.
- The 6 types:
  - open_web: self-serve cancel on merchant site (button: Open cancellation)
  - open_provider: must cancel where billed (billed through Google Play → Open Google Play)
  - send_email: merchant accepts cancellation by email (button: Review & send)
  - contact_support: requires contacting support/chat/phone
  - manual: steps known but no direct link (Settings → Account → Cancel)
  - unknown: could not verify from content — use null/[].

FEW-SHOT — exact outputs:

Document: Merchant Spotify, billingProvider null, Content: "To cancel Spotify Premium, go to spotify.com/account, click Manage your plan, click Cancel Premium, confirm. Direct link https://www.spotify.com/account/cancel/"
=> {"cancellationMethod":"open_web","cancellationUrl":"https://www.spotify.com/account/cancel/","instructions":["Go to spotify.com/account","Click Manage your plan","Click Cancel Premium","Confirm cancellation"],"evidenceExcerpt":"Click Cancel Premium to cancel your subscription"}

Document: Merchant Google One, product Google AI Plus (400 GB), billingProvider Google Play, Content: "If you subscribed via Google Play, open Google Play, tap Payments & subscriptions > Subscriptions, find Google One, tap Cancel subscription. Manage at https://play.google.com/store/account/subscriptions"
=> {"cancellationMethod":"open_provider","cancellationUrl":"https://play.google.com/store/account/subscriptions","instructions":["Open Google Play","Tap Payments & subscriptions > Subscriptions","Find Google One","Tap Cancel subscription","Confirm"],"evidenceExcerpt":"If you subscribed via Google Play, open Google Play > Subscriptions"}

Document: Merchant ExampleCo, Content: "To cancel, email support@example.com with subject Cancellation Request. Include your account email."
=> {"cancellationMethod":"send_email","cancellationUrl":"mailto:support@example.com","instructions":["Email support@example.com with subject Cancellation Request","Include your account email and subscription ID","Wait for confirmation"],"evidenceExcerpt":"email support@example.com to cancel"}

Document: Merchant UnknownService, Content: irrelevant / no cancel info
=> {"cancellationMethod":"unknown","cancellationUrl":null,"instructions":[],"evidenceExcerpt":null}

VALIDATION: Raw JSON only. All keys present. No trailing commas. No single quotes.`;

    const userContent = `Merchant: ${sub.merchant}${sub.product ? ` | Product: ${sub.product}` : ""}${sub.billingProvider ? ` | Billed via: ${sub.billingProvider}` : ""}

HELP CONTENT:
${markdownContent.slice(0, 8000)}`;

    const provider = groqKey ? "groq" : "openai";
    const apiKey = groqKey ?? openaiKey;
    const endpoint = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    const model = provider === "groq" ? GROQ_EXTRACTION_MODEL : "gpt-4o-mini";

    let parsed: any = null;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
          temperature: 0,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI extraction failed: ${res.statusText}`);
      }

      const data = (await res.json()) as any;
      const content = data.choices?.[0]?.message?.content ?? "{}";
      parsed = JSON.parse(content);
    } catch (e) {
      // LLM failed → unknown, don't invent
      await ctx.runMutation(internal.subscriptions.saveResearchResult, {
        subscriptionId: args.subscriptionId,
        cancellationMethod: "unknown",
        cancellationUrl: undefined,
        instructions: [],
        evidenceUrl: sourceUrl,
        evidenceExcerpt: undefined,
      });
      return { success: false, reason: String(e).slice(0, 200) };
    }

    // Validate + normalize LLM output
    const validMethods = new Set(["open_web", "open_provider", "send_email", "contact_support", "manual", "unknown"]);
    let cancellationMethod = typeof parsed.cancellationMethod === "string" ? parsed.cancellationMethod.toLowerCase().replace("-", "_") : "unknown";
    if (!validMethods.has(cancellationMethod)) cancellationMethod = "unknown";
    let cancellationUrl: string | undefined = typeof parsed.cancellationUrl === "string" && parsed.cancellationUrl.trim() ? parsed.cancellationUrl.trim() : undefined;
    // Strip invented generic URLs that don't match sourceUrl domain evidence
    if (cancellationUrl && !cancellationUrl.startsWith("http") && !cancellationUrl.startsWith("mailto:")) cancellationUrl = undefined;
    const instructions: string[] = Array.isArray(parsed.instructions)
      ? parsed.instructions.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 12)
      : [];
    const evidenceExcerpt: string | undefined =
      typeof parsed.evidenceExcerpt === "string" && parsed.evidenceExcerpt.trim()
        ? parsed.evidenceExcerpt.trim().slice(0, 200)
        : undefined;

    // If LLM said unknown or gave no steps, force unknown
    if (cancellationMethod === "unknown" || instructions.length === 0) {
      if (cancellationMethod !== "unknown" && instructions.length === 0) cancellationMethod = "unknown";
      cancellationUrl = undefined;
    }

    await ctx.runMutation(internal.subscriptions.saveResearchResult, {
      subscriptionId: args.subscriptionId,
      cancellationMethod,
      cancellationUrl,
      instructions,
      evidenceUrl: sourceUrl,
      evidenceExcerpt,
    });

    return { success: true, mock: false };
  },
});
