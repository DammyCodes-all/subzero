import { describe, expect, it } from "vitest";
import {
  cancelledTemplate,
  renewalNudgeTemplate,
} from "../convex/lib/emailTemplates";

const sub = {
  merchant: "Adobe",
  product: "Creative Cloud",
  price: 54.99,
  currency: "USD",
  billingInterval: "monthly",
  nextRenewalAt: Date.parse("2026-09-20"),
  cancellationUrl: "https://account.adobe.com/plans",
  subscriptionId: "test123" as string,
};

describe("renewalNudgeTemplate", () => {
  it("uses the narrative subject per stage", () => {
    expect(renewalNudgeTemplate(sub, "7d").subject).toContain(
      "renews in a week",
    );
    expect(renewalNudgeTemplate(sub, "3d").subject).toContain("in 3 days");
    expect(renewalNudgeTemplate(sub, "24h").subject).toContain("tomorrow");
  });

  it("links to the real subscription, never localhost when SITE_URL is set", () => {
    process.env.SITE_URL = "https://subzero.example.com";
    const { text, html } = renewalNudgeTemplate(sub, "7d");
    expect(text).toContain(
      "https://subzero.example.com/dashboard/subscriptions?sub=test123",
    );
    expect(text).not.toContain("localhost");
    expect(html).toContain(
      "https://subzero.example.com/dashboard/subscriptions?sub=test123",
    );
    delete process.env.SITE_URL;
  });
});

describe("cancelledTemplate", () => {
  it("uses the cancelled subject and keeps the price", () => {
    const { subject, text } = cancelledTemplate(sub, "manual");
    expect(subject).toContain("cancelled");
    expect(text).toContain("54.99");
  });
});
