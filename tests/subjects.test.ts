import { describe, expect, it } from "vitest";
import {
  cancelledSubject,
  renewalSubject,
} from "../src/emails/subjects";

describe("email subjects", () => {
  it("builds renewal subjects per stage", () => {
    expect(
      renewalSubject("7d", { merchant: "Adobe", priceStr: "$54.99" }),
    ).toContain("renews in a week");
    expect(
      renewalSubject("3d", { merchant: "Adobe", priceStr: "$54.99" }),
    ).toContain("in 3 days");
    expect(
      renewalSubject("24h", { merchant: "Adobe", priceStr: "$54.99" }),
    ).toContain("tomorrow");
  });

  it("builds the cancelled subject", () => {
    expect(cancelledSubject({ merchant: "Adobe" })).toContain("cancelled");
  });
});
