import { describe, expect, it } from "vitest";
import { dedupKey } from "../convex/lib/dedup";

describe("dedupKey", () => {
  it("is case-insensitive on merchant and currency", () => {
    const a = dedupKey({
      merchant: "Adobe",
      price: 54.99,
      currency: "USD",
    });
    const b = dedupKey({
      merchant: "adobe ",
      price: 54.99,
      currency: "usd",
    });
    expect(a).toBe(b);
  });

  it("buckets price to cents so float noise does not fork rows", () => {
    const a = dedupKey({ merchant: "Notion", price: 10, currency: "USD" });
    const b = dedupKey({ merchant: "Notion", price: 10.0, currency: "USD" });
    expect(a).toBe(b);
  });

  it("separates provider variants", () => {
    const direct = dedupKey({
      merchant: "ChatGPT",
      price: 20,
      currency: "USD",
    });
    const viaGoogle = dedupKey({
      merchant: "ChatGPT",
      price: 20,
      currency: "USD",
      billingProvider: "Google Play",
    });
    expect(direct).not.toBe(viaGoogle);
  });
});
