// Give first-scan extraction priority over cancellation research, which uses
// the same provider key pool and otherwise starts immediately for every find.
export const INGESTION_RESEARCH_DELAY_MS = 2 * 60 * 1000;
