import type { MutationCtx } from "../_generated/server";
import { dedupKey } from "./dedup";
import { getDifficulty } from "./difficulty";
import { cleanProductName } from "./product";

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

// Rows stored under the old rule (any provider-billed route auto-"high")
// get rescored from their researched instructions. Only touches the exact
// population the old rule inflated: researched rows with a known method
// sitting at "high". Anything genuinely hard recomputes to the same value
// and is left alone.
export async function refreshLegacyDifficulty(
  ctx: MutationCtx,
  userId: string,
): Promise<number> {
  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200);
  let fixed = 0;
  for (const s of rows) {
    if (
      !s.billingProvider ||
      s.cancellationDifficulty !== "high" ||
      s.researchStatus !== "done"
    )
      continue;
    const method = s.cancellationMethod ?? "unknown";
    if (method === "unknown" || method === "contact_support") continue;
    const action = await ctx.db
      .query("cancellationActions")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", s._id))
      .first();
    const fresh = getDifficulty(method, action?.instructions?.length ?? 0);
    if (fresh === s.cancellationDifficulty) continue;
    await ctx.db.patch(s._id, { cancellationDifficulty: fresh });
    fixed += 1;
  }
  return fixed;
}
