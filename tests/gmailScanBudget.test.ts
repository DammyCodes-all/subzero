import { describe, expect, it } from "vitest";
import {
  INITIAL_SCAN_INLINE_CAP,
  INITIAL_SCAN_TOTAL_CAP,
  remainingScanBudget,
  takeWithinScanBudget,
} from "../convex/lib/gmailScanBudget";

describe("Gmail initial scan budget", () => {
  it("never processes beyond the inline budget when Gmail returns a full page", () => {
    const gmailPage = Array.from(
      { length: INITIAL_SCAN_TOTAL_CAP + 10 },
      (_, index) => index,
    );
    const processed = INITIAL_SCAN_TOTAL_CAP - 5;

    expect(
      takeWithinScanBudget(gmailPage, processed, INITIAL_SCAN_TOTAL_CAP),
    ).toHaveLength(5);
  });

  it("uses one Gmail page for the fast inline pass", () => {
    const gmailPage = Array.from(
      { length: INITIAL_SCAN_INLINE_CAP },
      (_, index) => index,
    );

    expect(
      takeWithinScanBudget(gmailPage, 0, INITIAL_SCAN_INLINE_CAP),
    ).toHaveLength(INITIAL_SCAN_INLINE_CAP);
  });

  it("reports no remaining work at or above the cap", () => {
    expect(
      remainingScanBudget(INITIAL_SCAN_TOTAL_CAP, INITIAL_SCAN_TOTAL_CAP),
    ).toBe(0);
    expect(
      remainingScanBudget(
        INITIAL_SCAN_TOTAL_CAP + 10,
        INITIAL_SCAN_TOTAL_CAP,
      ),
    ).toBe(0);
  });
});
