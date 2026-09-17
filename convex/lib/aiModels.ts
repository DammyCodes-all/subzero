export const GROQ_EXTRACTION_MODEL = "openai/gpt-oss-120b";

// One model per key layer: Groq buckets are per-org-PER-MODEL, so spreading
// layers across models multiplies the effective budget instead of hammering
// a single 8K TPM bucket. Index i uses GROQ_MODEL_BY_KEY[i].
export const GROQ_MODEL_BY_KEY = [
  "openai/gpt-oss-120b", // key 1: smartest, 8K TPM / 200K TPD
  "meta-llama/llama-3.3-70b-versatile", // key 2: 12K TPM
  "meta-llama/llama-3.1-8b-instant", // key 3: 6K TPM but 500K TPD daily buffer
];

// Pinned OpenRouter fallback (verified live 2026-09-17): fastest free route
// with JSON output (0.71s p50, 86 tok/s). Never use the `openrouter/free`
// random router — it serves models that ignore response_format and return
// prose ("User Safety: safe"), which used to crash extraction.
export const OPENROUTER_EXTRACTION_MODEL = "liquid/lfm-2.5-2.6b:free";

// Groq key layers, tried in rotation. Set GROQ_API_KEY + GROQ_API_KEY_2 (+_3)
// in Convex deployment env (dev AND prod) — never in code. Extra keys only
// add capacity when they belong to a DIFFERENT Groq org/account: limits are
// per-org, so same-account keys share one bucket.
export function groqApiKeysFrom(
  env: Record<string, string | undefined>,
): string[] {
  return [env.GROQ_API_KEY, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3].filter(
    (k): k is string => !!k,
  );
}
