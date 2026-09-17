export const GROQ_EXTRACTION_MODEL = "openai/gpt-oss-120b";

// Groq key layers, tried in order. Set GROQ_API_KEY + GROQ_API_KEY_2 (+_3)
// in Convex deployment env (dev AND prod) — never in code. Each layer fails
// fast on 429 before the next is tried, OpenRouter last.
export function groqApiKeysFrom(
  env: Record<string, string | undefined>,
): string[] {
  return [env.GROQ_API_KEY, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3].filter(
    (k): k is string => !!k,
  );
}
