import { describe, expect, it } from "vitest";
import {
  MAX_AUTOMATIC_RESEARCH_ATTEMPTS,
  canRetryResearch,
} from "../convex/lib/researchRetry";

describe("automatic cancellation research retries", () => {
  it("allows the initial attempt and bounded retries", () => {
    expect(canRetryResearch(undefined)).toBe(true);
    expect(canRetryResearch(0)).toBe(true);
    expect(canRetryResearch(MAX_AUTOMATIC_RESEARCH_ATTEMPTS - 1)).toBe(true);
  });

  it("stops once the automatic attempt budget is exhausted", () => {
    expect(canRetryResearch(MAX_AUTOMATIC_RESEARCH_ATTEMPTS)).toBe(false);
    expect(canRetryResearch(MAX_AUTOMATIC_RESEARCH_ATTEMPTS + 1)).toBe(false);
  });
});
