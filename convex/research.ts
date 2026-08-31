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

    // 1. Search with Firecrawl — provider-aware site hint in query (generic, no hardcode result)
    const billingHint = sub.billingProvider ? ` billed via ${sub.billingProvider}` : "";
    const providerLower = (sub.billingProvider ?? "").toLowerCase();
    let providerSiteHint = "";
    if (providerLower.includes("google")) {
      providerSiteHint = " (site:support.google.com OR site:play.google.com)";
    } else if (providerLower.includes("apple")) {
      providerSiteHint = " (site:support.apple.com OR site:apps.apple.com)";
    } else if (providerLower.includes("amazon")) {
      providerSiteHint = " (site:amazon.com)";
    }
    const searchQuery = `how to cancel ${sub.merchant}${sub.product ? ` ${sub.product}` : ""}${billingHint} subscription${providerSiteHint}`;

    let searchHits: any[] = [];
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as any;
        // Firecrawl v1 returns { success, data: [...] } ; v2 search returns { web: [...] }
        const raw = j.data ?? j.web ?? [];
        if (Array.isArray(raw)) searchHits = raw;
        else if (raw && typeof raw === "object") searchHits = Object.values(raw).flat() as any[];
      }
    } catch {
      searchHits = [];
    }

    if (searchHits.length === 0) {
      await ctx.runMutation(internal.subscriptions.saveResearchResult, {
        subscriptionId: args.subscriptionId,
        cancellationMethod: "unknown",
        cancellationUrl: undefined,
        instructions: [],
        evidenceUrl: undefined,
        evidenceExcerpt: undefined,
      });
      return { success: true, mock: false, reason: "no_firecrawl_hits" };
    }

    // 2. Generic ranking — merchant-agnostic
    const merchantSlug = sub.merchant
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20);
    const merchantTokens = sub.merchant
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3)
      .slice(0, 3);

    function scoreHit(h: any): number {
      const urlStr = String(h.url ?? "");
      let host = "";
      let path = "";
      try {
        const u = new URL(urlStr);
        host = u.hostname.toLowerCase();
        path = u.pathname.toLowerCase();
      } catch {
        host = "";
        path = urlStr.toLowerCase();
      }
      const title = String(h.title ?? "").toLowerCase();
      const snippet = String(h.description ?? h.snippet ?? h.markdown ?? "").toLowerCase();
      const combined = `${title} ${snippet}`;
      let s = 0;
      // boost help / support domains generic
      if (
        host.startsWith("support.") ||
        host.startsWith("help.") ||
        host.startsWith("helpx.") ||
        host.includes("zendesk") ||
        host.includes("freshdesk") ||
        host.includes("helpcenter")
      )
        s += 4;
      // provider-specific boost — for store-billed, Play/App Store help should outrank merchant portal
      if (providerLower.includes("google") && (host === "support.google.com" || host === "play.google.com")) s += 5;
      if (providerLower.includes("apple") && (host === "support.apple.com" || host === "apps.apple.com")) s += 5;
      if (providerLower.includes("amazon") && host.includes("amazon.com") && path.includes("help")) s += 5;
      const merchantHostMatch =
        (merchantSlug && host.includes(merchantSlug)) ||
        merchantTokens.some((tok) => host.includes(tok));
      if (
        merchantHostMatch &&
        (path.includes("help") || path.includes("support") || path.includes("faq") || path.includes("cancel"))
      )
        s += 3;
      if (host === "play.google.com" || host === "apps.apple.com") s += 3;
      if (path.includes("cancel") || (path.includes("subscription") && combined.includes("cancel"))) s += 2;
      if (combined.includes("how to cancel") || combined.includes("cancel subscription")) s += 2;
      // For store-billed, demote merchant portal account pages generically (not snap-specific)
      if (providerLower && merchantHostMatch && path.includes("accounts.")) s -= 4;
      // For store-billed, slightly prefer provider help over merchant cancel page when both exist
      if (providerLower && merchantHostMatch && path.includes("cancel") && (host.startsWith("help.") || host.startsWith("support."))) {
        s -= 1;
      }
      // demote marketing
      if (
        host === "one.google.com" ||
        path === "/about" ||
        path.startsWith("/about/") ||
        path.includes("/pricing") ||
        path.includes("/terms") ||
        path.includes("/features") ||
        path.includes("/blog")
      )
        s -= 10;
      if (path === "/" || path === "") s -= 8; // bare homepage
      if (!combined.includes("cancel")) s -= 5;
      return s;
    }

    const ranked = searchHits
      .map((h) => ({ h, score: scoreHit(h) }))
      .sort((a, b) => b.score - a.score);

    console.log(
      `[research] query="${searchQuery}" ranked=${ranked
        .map((r) => `${r.score}:${String(r.h.url).slice(0, 60)}`)
        .join(" | ")}`,
    );

    // 3. Scrape only top 1-2 (two-step pattern) — keep allUrls for verbatim check
    let markdownContent = "";
    let sourceUrl: string | undefined = ranked[0]?.h.url as string | undefined;
    let allUrls: string[] = ranked.map((r) => String(r.h.url ?? ""));
    let allLinks: string[] = [];

    const urlsToScrape: string[] = [];
    if (ranked[0]?.h.url) urlsToScrape.push(String(ranked[0].h.url));
    if (ranked[1]?.h.url && ranked[1].score >= (ranked[0]?.score ?? 0) - 2 && ranked[1].score > 0) {
      urlsToScrape.push(String(ranked[1].h.url));
    }

    let scrapedAny = false;
    if (urlsToScrape.length > 0) {
      try {
        const scraped = await Promise.all(
          urlsToScrape.map(async (u) => {
            try {
              const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${firecrawlKey}`,
                },
                body: JSON.stringify({
                  url: u,
                  formats: ["markdown", "links"],
                  onlyMainContent: true,
                }),
              });
              if (!r.ok) return null;
              const j = (await r.json()) as any;
              const markdown = String(j.markdown ?? j.data?.markdown ?? "");
              const links = (j.links ?? j.data?.links ?? []) as string[];
              return { url: u, markdown, links };
            } catch {
              return null;
            }
          }),
        );
        const valid = scraped.filter((x): x is { url: string; markdown: string; links: string[] } => !!x && !!x.markdown);
        if (valid.length > 0) {
          scrapedAny = true;
          sourceUrl = valid[0].url;
          markdownContent = valid.map((v) => v.markdown).join("\n\n").slice(0, 9000);
          allLinks = valid.flatMap((v) => v.links ?? []);
          // merge allUrls includes scraped links too for validation
          allUrls = [...allUrls, ...allLinks];
        }
      } catch {}
    }
    if (!scrapedAny) {
      // Fallback to snippets/markdown from search hits if scrape failed
      markdownContent = ranked
        .slice(0, 2)
        .map((r) => String(r.h.markdown ?? r.h.description ?? r.h.snippet ?? ""))
        .join("\n\n")
        .slice(0, 9000);
    }

    console.log(`[research] primary=${sourceUrl?.slice(0, 80)} markdownLen=${markdownContent.length} scraped=${scrapedAny}`);

    // Gate — generic, prevents marketing boilerplate for any merchant
    if (!markdownContent || markdownContent.trim().length < 160 || !/cancel/i.test(markdownContent)) {
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

    // 4. Research prompt — generic, no hardcoded provider URLs
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
- cancellationUrl: exact URL found in HELP CONTENT, or mailto: if email. null if not explicitly present. Never synthesize https://www.<merchant>.com/... or any generic settings/billing URL.
- instructions: ordered steps as written in help content. If unknown → [].
- evidenceExcerpt: exact quote from content backing the route, max 200 chars, or null.
- BILLING PROVIDER DISCOVERY: If Billed via is a store (Google Play / Apple App Store / Amazon), prefer provider-dashboard steps/URL (support.google.com / play.google.com / support.apple.com / amazon.com/gp/help) found in HELP CONTENT. Ignore merchant portal URLs (e.g., accounts.snapchat.com, snapchat.com/plus) for store-billed. If no provider dashboard URL is present in content, return unknown/null — do NOT invent.
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

Document: Merchant Google One, billingProvider Google Play, Content: "Google One is 2TB storage. Learn more at https://one.google.com/about/ — features, pricing, benefits. No cancel info."
=> {"cancellationMethod":"unknown","cancellationUrl":null,"instructions":[],"evidenceExcerpt":null}

Document: Merchant Adobe, billingProvider null, Content: "Adobe Creative Cloud pricing, plans, features. See https://www.adobe.com/about/ for company info."
=> {"cancellationMethod":"unknown","cancellationUrl":null,"instructions":[],"evidenceExcerpt":null}

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
      // LLM failed → mark failed (retryable) not verified unknown
      await ctx.runMutation(internal.subscriptions.saveResearchResult, {
        subscriptionId: args.subscriptionId,
        cancellationMethod: "unknown",
        cancellationUrl: undefined,
        instructions: [],
        evidenceUrl: sourceUrl,
        evidenceExcerpt: undefined,
        researchStatus: "failed",
      });
      return { success: false, reason: String(e).slice(0, 200) };
    }

    // Validate + normalize LLM output — generic, no hardcoded host list
    const validMethods = new Set(["open_web", "open_provider", "send_email", "contact_support", "manual", "unknown"]);
    let cancellationMethod = typeof parsed.cancellationMethod === "string" ? parsed.cancellationMethod.toLowerCase().replace("-", "_") : "unknown";
    if (!validMethods.has(cancellationMethod)) cancellationMethod = "unknown";
    let cancellationUrl: string | undefined = typeof parsed.cancellationUrl === "string" && parsed.cancellationUrl.trim() ? parsed.cancellationUrl.trim() : undefined;
    if (cancellationUrl && !cancellationUrl.startsWith("http") && !cancellationUrl.startsWith("mailto:")) cancellationUrl = undefined;

    // Generic verbatim check — URL must appear verbatim in scraped markdown/links/search URLs
    if (cancellationUrl) {
      const inMarkdown = markdownContent.includes(cancellationUrl);
      const inAllUrls = allUrls.some((u) => u === cancellationUrl);
      const inAllLinks = allLinks.some((l) => l === cancellationUrl);
      if (!inMarkdown && !inAllUrls && !inAllLinks) {
        console.log(`[research] verbatim fail: url=${cancellationUrl} not in markdown/links`);
        cancellationUrl = undefined;
        if (cancellationMethod !== "unknown") cancellationMethod = "unknown";
      }
    }

    // Generic blocklist — marketing/about/pricing/terms + bare homepage + one.google.com/about
    if (cancellationUrl) {
      let isBlocked = false;
      try {
        const u = new URL(cancellationUrl);
        const h = u.hostname.toLowerCase();
        const p = u.pathname.toLowerCase();
        if (h === "one.google.com" && p.startsWith("/about")) isBlocked = true;
        if (p === "/about" || p.startsWith("/about/")) isBlocked = true;
        if (p === "/pricing" || p.startsWith("/pricing/")) isBlocked = true;
        if (p === "/terms" || p.startsWith("/terms/")) isBlocked = true;
        if (p === "/" || p === "") isBlocked = true; // bare homepage like https://www.adobe.com/
      } catch {
        isBlocked = false;
      }
      if (isBlocked) {
        console.log(`[research] blocklist hit: url=${cancellationUrl}`);
        cancellationUrl = undefined;
        cancellationMethod = "unknown";
      }
    }

    const instructions: string[] = Array.isArray(parsed.instructions)
      ? parsed.instructions.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 12)
      : [];
    const evidenceExcerpt: string | undefined =
      typeof parsed.evidenceExcerpt === "string" && parsed.evidenceExcerpt.trim()
        ? parsed.evidenceExcerpt.trim().slice(0, 200)
        : undefined;

    // If LLM said unknown or gave no steps, force unknown; for open_* require URL per plan
    if (cancellationMethod === "unknown" || instructions.length === 0) {
      if (cancellationMethod !== "unknown" && instructions.length === 0) cancellationMethod = "unknown";
      if (cancellationMethod === "unknown") cancellationUrl = undefined;
    }
    if ((cancellationMethod === "open_web" || cancellationMethod === "open_provider" || cancellationMethod === "send_email") && !cancellationUrl) {
      // Stricter: open_* and send_email require a verifiable URL/mailto
      cancellationMethod = "unknown";
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

export const retryFailedResearch = internalAction({
  args: {},
  handler: async (ctx) => {
    const failed: any[] = await ctx.runQuery(internal.subscriptions.getFailedForRetry);
    let retried = 0;
    for (const sub of failed.slice(0, 5)) {
      try {
        await ctx.runMutation(internal.subscriptions.markResearchPending, { id: sub._id });
        await ctx.scheduler.runAfter(0, internal.research.researchCancellationRoute, {
          subscriptionId: sub._id,
        });
        retried++;
      } catch {}
    }
    return { retried, totalFailed: failed.length };
  },
});
