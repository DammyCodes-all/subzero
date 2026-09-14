import { describe, expect, it } from "vitest";
import { isNavActive, NAV_ITEMS, normalizePath } from "../src/components/layout/navigation";
import type { NavItem } from "../src/components/layout/types";

const icon = (() => null) as unknown as NavItem["icon"];
const item = (over: Partial<NavItem> & { href: string }): NavItem => ({
  label: over.href,
  icon,
  exact: false,
  ...over,
});

describe("normalizePath", () => {
  it("strips a single trailing slash", () => {
    expect(normalizePath("/dashboard/")).toBe("/dashboard");
    expect(normalizePath("/dashboard")).toBe("/dashboard");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("isNavActive", () => {
  it("lights up Overview on /dashboard with or without trailing slash", () => {
    const overview = NAV_ITEMS.find((i) => i.label === "Overview")!;
    expect(isNavActive("/dashboard", overview)).toBe(true);
    expect(isNavActive("/dashboard/", overview)).toBe(true);
  });

  it("does not light up Overview on sub-routes or other pages", () => {
    const overview = NAV_ITEMS.find((i) => i.label === "Overview")!;
    for (const p of [
      "/dashboard/subscriptions",
      "/dashboard/subscriptions/",
      "/dashboard/connections",
      "/dashboard/settings",
      "/auth",
      "/",
    ]) {
      expect(isNavActive(p, overview)).toBe(false);
    }
  });

  it("matches prefix items on exact, trailing-slash, and nested paths", () => {
    const subs = NAV_ITEMS.find((i) => i.label === "Subscriptions")!;
    expect(isNavActive("/dashboard/subscriptions", subs)).toBe(true);
    expect(isNavActive("/dashboard/subscriptions/", subs)).toBe(true);
    expect(isNavActive("/dashboard/subscriptions/abc123", subs)).toBe(true);
    expect(isNavActive("/dashboard", subs)).toBe(false);
  });

  it("does not match partial segment names", () => {
    const subs = item({ href: "/dashboard/subscriptions" });
    expect(isNavActive("/dashboard/subscriptionss", subs)).toBe(false);
  });

  it("honours aliases", () => {
    const withAlias = item({ href: "/dashboard/x", aliases: ["/alt"] });
    expect(isNavActive("/alt", withAlias)).toBe(true);
    expect(isNavActive("/alt/", withAlias)).toBe(true);
    expect(isNavActive("/other", withAlias)).toBe(false);
  });
});
