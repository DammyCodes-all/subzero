import { describe, expect, it } from "vitest";
import { normalizeEmail } from "../convex/ingestion/normalize";
import { buildGmailQuery } from "../convex/lib/gmail";
import { isPromoOffer } from "../convex/lib/processEmail";

const PROTON_PROMO = `Go Unlimited for US$1. Upgrade to Proton Unlimited for US$1 in your first month. Get deal. 92% off. Billed at US$1 for the first month. Renews at US$12.99. Save now. Offer ends September 11, 2026.`;

const IFITNESS_WELCOME = `Hi Alameen, Welcome to i-Fitness! Your membership is now active. Branch: Lekki Phase 1. Membership: Monthly Subscription. Start date: August 12, 2026. Amount: ₦42,875. First renewal: September 12, 2026.`;

describe("gmail ingest recall guards", () => {
  it("queries full-text with welcome terms, without noisy bare active/order", () => {
    const q = buildGmailQuery(90);
    expect(q).toContain("welcome");
    expect(q).toContain("started");
    expect(q).toContain("receipt");
    expect(q).toContain("in:inbox");
    expect(q).not.toMatch(/subject:/);
    expect(q).not.toMatch(/\bactive\b/);
  });

  it("keeps mid-body terms but cuts footer boilerplate", () => {
    const body = `${"Intro. ".repeat(60)}\nTerms of trial: price ₦25,500/month renews Sept 18.\n${"Details. ".repeat(80)}\nUnsubscribe here: http://x.test/u\nFooter promo text`;
    const n = normalizeEmail({ text: body, subject: "Welcome to Creative Cloud" });
    expect(n.text).toContain("₦25,500");
    expect(n.text).not.toContain("Footer promo");
  });

  it("strips quoted replies", () => {
    const n = normalizeEmail({
      text: "Your receipt: ₦1,900 renewed.\n> quoted old thread\nOn Mon, Bob wrote: hi",
      subject: "Your Spotify Premium receipt",
    });
    expect(n.text).toContain("₦1,900");
    expect(n.text).not.toContain("quoted old thread");
    expect(n.text).not.toContain("Bob wrote");
  });

  it("screens promo offers but keeps real welcomes", () => {
    expect(isPromoOffer(`${PROTON_PROMO} Go Unlimited for US$1`)).toBe(true);
    expect(isPromoOffer(`${IFITNESS_WELCOME} Welcome to i-Fitness!`)).toBe(false);
  });
});
