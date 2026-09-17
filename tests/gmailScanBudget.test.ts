import { describe, expect, it } from "vitest";
import {
  INITIAL_SCAN_INLINE_CAP,
  INITIAL_SCAN_TOTAL_CAP,
  remainingScanBudget,
  takeWithinScanBudget,
} from "../convex/lib/gmailScanBudget";

describe("Gmail initial scan budget", () => {
  it("never processes beyond the inline budget when Gmail returns a full page", () => {
    const gmailPage = Array.from({ length: 15 }, (_, index) => index);
    const processed = 45;

    expect(takeWithinScanBudget(gmailPage, processed, INITIAL_SCAN_TOTAL_CAP)).toHaveLength(5);
  });

  it("uses one Gmail page for the fast inline pass", () => {
    const gmailPage = Array.from({ length: 15 }, (_, index) => index);

    expect(takeWithinScanBudget(gmailPage, 0, INITIAL_SCAN_INLINE_CAP)).toHaveLength(15);
  });

  it("reports no remaining work at or above the cap", () => {
    expect(remainingScanBudget(50, INITIAL_SCAN_TOTAL_CAP)).toBe(0);
    expect(remainingScanBudget(60, INITIAL_SCAN_TOTAL_CAP)).toBe(0);
  });
});
