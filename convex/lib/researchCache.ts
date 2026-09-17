export const RESEARCH_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function normalizePart(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function researchCacheKey(input: {
  merchant: string;
  product?: string;
  billingProvider?: string;
}): string {
  return [input.merchant, input.product, input.billingProvider]
    .map(normalizePart)
    .join("|");
}
