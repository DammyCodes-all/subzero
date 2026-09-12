import { describe, expect, it } from "vitest";
import { getDifficulty } from "../convex/lib/difficulty";

describe("getDifficulty", () => {
  it("marks unknown and support routes as very high", () => {
    expect(getDifficulty("unknown", 0)).toBe("very_high");
    expect(getDifficulty("contact_support", 2)).toBe("very_high");
  });

  it("grades by observable step count", () => {
    expect(getDifficulty("open_web", 1)).toBe("low");
    expect(getDifficulty("open_web", 4)).toBe("medium");
    expect(getDifficulty("open_web", 7)).toBe("high");
  });
});
