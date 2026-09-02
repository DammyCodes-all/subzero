"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LayoutGridIcon,
  LayoutListIcon,
  Search01Icon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { SubscriptionRow } from "@/components/SubscriptionRow";
import { ActionCard } from "@/components/ActionCard";
import { DashboardSkeleton } from "@/components/Skeleton";
import {
  LinkPendingDot,
  LinkPendingOverlay,
  PendingWrap,
} from "@/components/ui/LinkPending";
import { formatPrice, formatRenewalDate, frictionLabel } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

type FilterTab = "all" | "active" | "trials" | "urgent" | "cancelled";

export function SubscriptionsView() {
  const all = useQuery(api.subscriptions.list);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    if (typeof window === "undefined") return "table";
    const stored = localStorage.getItem("subscriptions-view-mode");
    if (stored === "grid" || stored === "table") return stored;
    return window.innerWidth >= 640 ? "table" : "grid";
  });
  const [searchQuery, setSearchQuery] = useState("");

  const handleViewModeChange = (mode: "grid" | "table") => {
    setViewMode(mode);
    localStorage.setItem("subscriptions-view-mode", mode);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  if (all === undefined) {
    return <DashboardSkeleton />;
  }

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  // Filter subscriptions based on selected tab and search query
  const filteredSubs = all.filter((sub) => {
    // Search query match
    const matchesSearch =
      sub.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.product && sub.product.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Filter tabs match
    if (filter === "active") return sub.status !== "cancelled";
    if (filter === "trials") return sub.trialEndsAt && sub.trialEndsAt > now;
    if (filter === "urgent")
      return (
        sub.status !== "cancelled" &&
        sub.nextRenewalAt &&
        sub.nextRenewalAt <= now + sevenDays
      );
    if (filter === "cancelled") return sub.status === "cancelled";
    return true;
  });

  // Calculate pagination slice
  const totalPages = Math.ceil(filteredSubs.length / itemsPerPage);
  const paginatedSubs = filteredSubs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleFilterChange = (tab: FilterTab) => {
    setFilter(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Subscriptions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View, search, and manage all your tracked recurring subscriptions.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-card p-1 sm:self-auto">
          <button
            type="button"
            onClick={() => handleViewModeChange("grid")}
            aria-label="Grid view"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              viewMode === "grid"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <HugeiconsIcon
              icon={LayoutGridIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={16}
              color="currentColor"
            />
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange("table")}
            aria-label="Table view"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
              viewMode === "table"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <HugeiconsIcon
              icon={LayoutListIcon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
              size={16}
              color="currentColor"
            />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 pb-2 sm:border-b-0 sm:pb-0">
          {(["all", "active", "trials", "urgent", "cancelled"] as FilterTab[]).map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleFilterChange(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === tab
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {tab === "urgent" ? "Renewing Soon" : tab}
              </button>
            ),
          )}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <HugeiconsIcon
            icon={Search01Icon as unknown as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={14}
            color="currentColor"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search subscriptions..."
            className="h-8 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Subscriptions Content Grid / Table */}
      {filteredSubs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">No subscriptions found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery
              ? `No results match "${searchQuery}" under the "${filter}" filter.`
              : `No subscriptions match the selected filter.`}
          </p>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {paginatedSubs.map((sub) => (
                <Link
                  key={sub._id}
                  href={`/subscriptions/${sub._id}`}
                  className="group relative block"
                >
                  <span className="relative block rounded-lg">
                    <PendingWrap>
                      <ActionCard sub={sub} />
                    </PendingWrap>
                    <LinkPendingOverlay variant="card" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-secondary/40 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Merchant</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Renewal Date</th>
                      <th className="px-4 py-3">Friction</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {paginatedSubs.map((sub) => (
                      <tr
                        key={sub._id}
                        className="group transition-colors hover:bg-secondary/20"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          <Link
                            href={`/subscriptions/${sub._id}`}
                            className="inline-flex items-center gap-1.5 hover:underline"
                          >
                            <PendingWrap className="inline-flex items-center gap-1">
                              {sub.merchant}
                            </PendingWrap>
                            <LinkPendingDot />
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          {formatPrice(sub.price, sub.currency, sub.billingInterval)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatRenewalDate(sub.nextRenewalAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {sub.cancellationDifficulty
                            ? frictionLabel(sub.cancellationDifficulty)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                              sub.status === "cancelled"
                                ? "bg-slate-500/10 text-slate-400"
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/subscriptions/${sub._id}`}
                            className="inline-flex items-center"
                          >
                            <Button variant="ghost" size="xs" className="h-7 gap-1 text-xs">
                              <PendingWrap className="inline-flex items-center gap-1">
                                Inspect
                              </PendingWrap>
                              <LinkPendingDot />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 pt-4">
              <p className="font-mono text-xs text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1}–
                {Math.min(currentPage * itemsPerPage, filteredSubs.length)} of{" "}
                {filteredSubs.length} subscriptions
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="h-8 text-xs font-medium"
                >
                  Previous
                </Button>
                <span className="font-mono text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="h-8 text-xs font-medium"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
