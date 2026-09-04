import type { MutationCtx } from "../_generated/server";
import { dedupKey } from "./dedup";

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

// Healing for rows stored before write-path cleaning existed. Runs inside
// the ingest mutations (bounded, indexed) so old dirty rows fix themselves
// on the next ingest — no manual migration step.
export async function healDirtyProductNames(
  ctx: MutationCtx,
  userId: string,
): Promise<number> {
  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200);
  let healed = 0;
  for (const s of rows) {
    const cleaned = cleanProductName(s.product);
    if (!cleaned || cleaned === s.product) continue;
    const newKey = dedupKey({
      merchant: s.merchant,
      product: cleaned,
      billingProvider: s.billingProvider,
      price: s.price,
      currency: s.currency,
    });
    if (newKey !== s.dedupKey) {
      const clash = await ctx.db
        .query("subscriptions")
        .withIndex("by_user_and_dedup", (q) =>
          q.eq("userId", userId).eq("dedupKey", newKey),
        )
        .unique();
      // Never merge two rows silently — clean the name, keep the old key.
      if (clash && clash._id !== s._id) {
        await ctx.db.patch(s._id, { product: cleaned });
        healed += 1;
        continue;
      }
    }
    await ctx.db.patch(s._id, { product: cleaned, dedupKey: newKey });
    healed += 1;
  }
  return healed;
}
