"use node";

// Shared LLM provider loop for extraction + research. One place for:
// - provider chain (Groq layers -> pinned OpenRouter -> OpenAI)
// - random rotation across per-org-per-model buckets (rate limits are
//   per-org-per-model, so every call starting on key 1 was a self-DDoS)
// - 60s circuit breaker (providers that just 429'd are skipped unless all
//   are down — checked via the aiUsage table, no schema change)
// - per-call timeout on EVERY provider (a hung fallback used to block)
// - one JSON-repair retry per provider; unparseable output fails OVER to
//   the next provider instead of crashing the mail into the retry queue.

import { internal } from "../_generated/api";
import { env } from "../_generated/server";
import {
  GROQ_MODEL_BY_KEY,
  groqApiKeysFrom,
  OPENROUTER_EXTRACTION_MODEL,
} from "./aiModels";
import { recordAiUsage, type ProviderUsage } from "./aiUsage";

export type LlmProvider = {
  id: string;
  key: string;
  endpoint: string;
  model: string;
  timeoutMs: number;
  sendJsonFormat: boolean;
  // Free-model endpoints 400 on params they don't advertise (Liquid has no
  // temperature). Only send what the target supports.
  sendTemperature: boolean;
  // gpt-oss is a reasoning model: medium effort can burn 200-500+ thinking
  // tokens before the JSON, blowing max_tokens and returning truncated bodies
  // (Groq 400 json_validate_failed). "low" is plenty for field extraction.
  reasoningEffort?: string;
};

export type LlmResult = {
  parsed: Record<string, unknown>;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: ProviderUsage;
};

const COOLDOWN_MS = 60 * 1000;
const REPAIR_TIMEOUT_MS = 10 * 1000;

export function buildProviders(
  mergedEnv: Record<string, string | undefined>,
  timeoutMs: number,
): LlmProvider[] {
  const providers: LlmProvider[] = [];
  groqApiKeysFrom(mergedEnv).forEach((key, i) => {
    const model = GROQ_MODEL_BY_KEY[i] ?? GROQ_MODEL_BY_KEY[0]!;
    providers.push({
      id: i === 0 ? "groq" : `groq-${i + 1}`,
      key,
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model,
      timeoutMs,
      sendJsonFormat: true,
      sendTemperature: true,
      reasoningEffort: model.startsWith("openai/gpt-oss") ? "low" : undefined,
    });
  });
  const openrouterKey = mergedEnv.OPENROUTER_API_KEY;
  if (openrouterKey) {
    const model =
      mergedEnv.OPENROUTER_MODEL ?? OPENROUTER_EXTRACTION_MODEL;
    providers.push({
      id: "openrouter",
      key: openrouterKey,
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      model,
      timeoutMs,
      // Liquid free models don't advertise response_format (400s if sent);
      // the prompt already demands raw JSON only.
      sendJsonFormat: !/liquid\//i.test(model),
      // Same for temperature: unadvertised params risk a 400 that would
      // silently neutralize the fallback on every call.
      sendTemperature: false,
    });
  }
  const openaiKey = mergedEnv.OPENAI_API_KEY;
  if (openaiKey) {
    providers.push({
      id: "openai",
      key: openaiKey,
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      timeoutMs,
      sendJsonFormat: true,
      sendTemperature: true,
    });
  }
  return providers;
}

function tryParseObject(content: string): Record<string, unknown> | null {
  try {
    let v: unknown = JSON.parse(content);
    // Tolerate double-encoded JSON bodies from smaller models.
    if (typeof v === "string") v = JSON.parse(v);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

async function postChat(
  prov: LlmProvider,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
  siteUrl: string,
): Promise<{ status: number; json: any; latencyMs: number; errText: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${prov.key}`,
    "Content-Type": "application/json",
  };
  if (prov.id === "openrouter") {
    headers["HTTP-Referer"] = siteUrl;
    headers["X-Title"] = "SubZero";
  }
  const body: Record<string, unknown> = {
    model: prov.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
  };
  if (prov.sendTemperature) body.temperature = 0;
  if (prov.reasoningEffort) body.reasoning_effort = prov.reasoningEffort;
  if (prov.sendJsonFormat) body.response_format = { type: "json_object" };
  const startedAt = Date.now();
  try {
    const r = await fetch(prov.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(t);
    const latencyMs = Date.now() - startedAt;
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return { status: r.status, json: null, latencyMs, errText };
    }
    const json = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: ProviderUsage;
    };
    return { status: 200, json, latencyMs, errText: "" };
  } catch (e) {
    clearTimeout(t);
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? `timeout after ${timeoutMs}ms`
        : String(e).slice(0, 150);
    return { status: 0, json: null, latencyMs: Date.now() - startedAt, errText: msg };
  }
}

export async function mergedEnvFrom(): Promise<Record<string, string | undefined>> {
  const deploymentEnv = env as unknown as Record<string, string | undefined>;
  const localEnv = process.env as unknown as Record<string, string | undefined>;
  // Deployment env wins locally (Convex dev loads .env.local into env).
  return { ...localEnv, ...deploymentEnv };
}

export async function chatJson(args: {
  ctx: any;
  operation: "extraction" | "research";
  logTag: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
}): Promise<LlmResult> {
  const { ctx, operation, logTag } = args;
  const merged = await mergedEnvFrom();
  const siteUrl =
    mergedEnvSiteUrl(merged) ?? "http://localhost:3000";
  const providers = buildProviders(merged, args.timeoutMs);
  if (providers.length === 0) {
    throw new Error(`${logTag} LLM unavailable: no API key`);
  }

  // Random rotation: N parallel scan calls spread across N buckets instead
  // of all hammering key 1, 429ing, then all hammering key 2.
  const start = Math.floor(Math.random() * providers.length);
  const ordered = providers.map((_, i) => providers[(start + i) % providers.length]!);

  // Circuit breaker: skip providers that failed inside the cooldown window.
  // Fail open when everything is cooling down — a slow try beats no try.
  // Best-effort: parallel calls racing the same window may still collide;
  // rotation above is what spreads those, the breaker stops sustained bleed.
  let candidates = ordered;
  try {
    const cooled: string[] = await ctx.runQuery(
      internal.aiUsage.recentFailedProviders,
      { operation, windowMs: COOLDOWN_MS },
    );
    if (cooled.length > 0) {
      const fresh = ordered.filter((p) => !cooled.includes(p.id));
      if (fresh.length > 0) {
        console.log(`${logTag} breaker skipping: ${cooled.join(",")}`);
        candidates = fresh;
      }
    }
  } catch {
    // Fail open — breaker never blocks inference by itself.
  }

  let lastErr = "no providers attempted";
  for (const prov of candidates) {
    console.log(`${logTag} Trying provider ${prov.id} model ${prov.model}`);
    let res = await postChat(
      prov,
      args.system,
      args.user,
      args.maxTokens,
      prov.timeoutMs,
      siteUrl,
    );
    // One retry on transient faults (5xx / network / timeout) — NOT on 429,
    // which fails over immediately and lets the breaker cool the bucket.
    if (res.status >= 500 || res.status === 0) {
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
      res = await postChat(
        prov,
        args.system,
        args.user,
        args.maxTokens,
        prov.timeoutMs,
        siteUrl,
      );
    }
    if (res.status !== 200) {
      await recordAiUsage(ctx, {
        operation,
        provider: prov.id,
        model: prov.model,
        latencyMs: res.latencyMs,
        success: false,
      });
      lastErr = `${prov.id} ${res.status}: ${res.errText.slice(0, 120)}`;
      console.error(`${logTag} LLM API error ${lastErr}`);
      continue;
    }
    const content = res.json.choices?.[0]?.message?.content ?? "";
    const parsed = tryParseObject(content);
    if (parsed) {
      await recordAiUsage(ctx, {
        operation,
        provider: prov.id,
        model: prov.model,
        usage: res.json.usage,
        latencyMs: res.latencyMs,
        success: true,
      });
      console.log(
        `${logTag} ${prov.id} ok in ${res.latencyMs}ms: ${content.slice(0, 160)}`,
      );
      return {
        parsed,
        provider: prov.id,
        model: prov.model,
        latencyMs: res.latencyMs,
        usage: res.json.usage,
      };
    }
    // HTTP ok but body unusable (prose, safety notice, "{}" without keys
    // is the CALLER's verdict — here only syntax). One minimal repair shot
    // on the same provider before failing over.
    if (!content.trim()) {
      await recordAiUsage(ctx, {
        operation,
        provider: prov.id,
        model: prov.model,
        latencyMs: res.latencyMs,
        success: false,
      });
      lastErr = `${prov.id}: empty content`;
      continue;
    }
    console.log(`${logTag} ${prov.id} unparseable, repair attempt`);
    const repair = await postChat(
      prov,
      "You output valid JSON only. No markdown, no code fences, no explanation.",
      // Failed model outputs are short; cap the echo so the repair call
      // stays small on metered TPM budgets.
      `Fix this into ONE valid JSON object with the same keys and values. No other text.\n\n${content.slice(0, 1200)}`,
      args.maxTokens,
      REPAIR_TIMEOUT_MS,
      siteUrl,
    );
    const repaired =
      repair.status === 200
        ? tryParseObject(repair.json.choices?.[0]?.message?.content ?? "")
        : null;
    if (repaired) {
      await recordAiUsage(ctx, {
        operation,
        provider: prov.id,
        model: prov.model,
        usage: repair.json.usage ?? res.json.usage,
        latencyMs: res.latencyMs + repair.latencyMs,
        success: true,
      });
      return {
        parsed: repaired,
        provider: prov.id,
        model: prov.model,
        latencyMs: res.latencyMs + repair.latencyMs,
        usage: repair.json.usage ?? res.json.usage,
      };
    }
    await recordAiUsage(ctx, {
      operation,
      provider: prov.id,
      model: prov.model,
      latencyMs: res.latencyMs + repair.latencyMs,
      success: false,
    });
    lastErr = `${prov.id}: unparseable output`;
  }
  throw new Error(`${logTag} LLM failed on all providers: ${lastErr.slice(0, 180)}`);
}

function mergedEnvSiteUrl(
  merged: Record<string, string | undefined>,
): string | undefined {
  return merged.SITE_URL;
}
