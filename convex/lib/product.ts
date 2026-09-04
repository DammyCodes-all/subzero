// Canonical product-name cleaning — THE source of truth for what gets
// stored. AI extraction sometimes copies raw app-store titles
// ("Snapchat+ (Snapchat: Chat with Friends)") into the product field.
// Store titles follow "Name: Tagline" inside parens, so a trailing
// parenthetical containing a colon is stripped. Informative parens without
// a colon ("Google AI Plus (400 GB)") are kept.
export function cleanProductName(product?: string | null): string | undefined {
  if (!product) return undefined;
  const cleaned = product
    .replace(/\s*\([^()]*:[^()]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}
