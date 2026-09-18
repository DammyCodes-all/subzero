export const GROQ_EXTRACTION_MODEL = "openai/gpt-oss-120b";

// One model per key layer: Groq buckets are per-org-PER-MODEL, so spreading
// layers across models multiplies the effective budget. NOTE (Sep 2026):
// Groq retired the Llama instruct models (3.1/3.3 404) — the only live
// free chat models are gpt-oss + qwen. Same model on different org keys is
// still a separate bucket (per-ORG-per-model), so key 2/3 share the 20b
// model across different accounts for consistent extraction behavior.
export const GROQ_MODEL_BY_KEY = [
  "openai/gpt-oss-120b", // key 1: smartest, 8K TPM / 200K TPD
  "openai/gpt-oss-20b", // key 2: same family, own org bucket, 8K TPM
  "openai/gpt-oss-20b", // key 3: same family, third org bucket, 8K TPM
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
