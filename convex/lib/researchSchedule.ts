// Give first-scan extraction priority over cancellation research, which uses
// the same provider key pool and otherwise starts immediately for every find.
export const INGESTION_RESEARCH_DELAY_MS = 2 * 60 * 1000;

// Random extra delay so researches from one scan don't all fire in the same
// second across isolates (Firecrawl free tier is ~25-30 req/min; five
// simultaneous researches blow past it). Rolled per schedule call.
export function researchDelayWithJitter(maxJitterMs = 90 * 1000): number {
  return (
    INGESTION_RESEARCH_DELAY_MS + Math.floor(Math.random() * maxJitterMs)
  );
}
