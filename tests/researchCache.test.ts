import { describe, expect, it } from "vitest";
import { researchCacheKey } from "../convex/lib/researchCache";

describe("cancellation research cache key", () => {
  it("reuses the same exact route across casing and whitespace differences", () => {
    expect(
      researchCacheKey({
        merchant: " Spotify ",
        product: "Premium  Individual",
        billingProvider: "Google Play",
      }),
    ).toBe("spotify|premium individual|google play");
  });

  it("keeps product and billing-provider routes separate", () => {
    const direct = researchCacheKey({ merchant: "Spotify", product: "Premium" });
    const play = researchCacheKey({
      merchant: "Spotify",
      product: "Premium",
      billingProvider: "Google Play",
    });

    expect(direct).not.toBe(play);
  });
});
