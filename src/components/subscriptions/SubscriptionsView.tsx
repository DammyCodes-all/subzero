"use client";

import {
  FilterIcon,
  LayoutGridIcon,
  LayoutListIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { sileo } from "sileo";
import { ActionCard } from "@/components/ActionCard";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@/components/animate-ui/components/base/tabs";
import { MerchantAvatar } from "@/components/MerchantAvatar";
import { SubscriptionsSkeleton } from "@/components/Skeleton";
import { SubscriptionRow } from "@/components/SubscriptionRow";
import { Button } from "@/components/ui/button";
import { LinkPendingDot, PendingWrap } from "@/components/ui/LinkPending";
import { formatPrice, formatRenewalDate, frictionLabel } from "@/lib/format";
import { merchantFaviconUrl } from "@/lib/merchantFavicon";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

type FilterTab = "all" | "active" | "trials" | "urgent" | "cancelled";

export function SubscriptionsView() {
  const all = useQuery(api.subscriptions.list);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    if (typeof window === "undefined") return "grid";
    const stored = localStorage.getItem("subscriptions-view-mode");
    if (stored === "grid" || stored === "table") return stored;
    return "grid";
  });
  const [searchQuery, setSearchQuery] = useState("");

  const handleViewModeChange = (mode: "grid" | "table") => {
    setViewMode(mode);
    localStorage.setItem("subscriptions-view-mode", mode);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const markActive = useMutation(api.actions.markActive);
  const unhideSubscription = useMutation(api.actions.unhideSubscription);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (sub: {
    _id: Id<"subscriptions">;
    merchant: string;
    hidden?: boolean;
  }) => {
    setRestoringId(sub._id);
    try {
      if (sub.hidden === true) {
        await unhideSubscription({ id: sub._id });
      } else {
        await markActive({ id: sub._id });
      }
      sileo.success({
        title: "Restored",
        description: `${sub.merchant} is back in your active list.`,
      });
    } catch {
      sileo.error({
        title: "Restore failed",
        description: "Something went wrong. Try again in a bit.",
      });
    } finally {
      setRestoringId(null);
    }
  };

  if (all === undefined) {
    return <SubscriptionsSkeleton />;
  }

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  // Filter subscriptions based on selected tab and search query
  const filteredSubs = all.filter((sub) => {
    // Search query match
    const matchesSearch =
      sub.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.product &&
        sub.product.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Hidden items live only in the Cancelled tab, where they can be restored.
    if (sub.hidden === true && filter !== "cancelled") return false;

    // Filter tabs match
    if (filter === "active") return sub.status !== "cancelled";
    if (filter === "trials") return sub.trialEndsAt && sub.trialEndsAt > now;
    if (filter === "urgent")
      return (
        sub.status !== "cancelled" &&
        sub.nextRenewalAt &&
        sub.nextRenewalAt <= now + sevenDays
      );
    if (filter === "cancelled")
      return sub.status === "cancelled" || sub.hidden === true;
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

  // Card list shared by grid mode and the mobile fallback for table mode
  // (the table needs far more width than a phone has).
  const gridCards = paginatedSubs.map((sub) =>
    sub.status === "cancelled" || sub.hidden === true ? (
      <div key={sub._id} className="space-y-2">
        <Link href={`/subscriptions/${sub._id}`} className="group block">
          <ActionCard sub={sub} />
        </Link>
        <Button
          variant="secondary"
          size="xs"
          disabled={restoringId === sub._id}
          onClick={() => handleRestore(sub)}
          className="h-7 w-full text-xs font-medium sm:w-auto"
        >
          {restoringId === sub._id ? "Restoring..." : "Restore"}
        </Button>
      </div>
    ) : (
      <Link
        key={sub._id}
        href={`/subscriptions/${sub._id}`}
        className="group block"
      >
        <ActionCard sub={sub} />
      </Link>
    ),
  );

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

        {/* View Mode Toggle — desktop only; mobile always shows cards */}
        <div className="hidden items-center gap-1 self-start rounded-lg border border-border bg-card p-1 sm:flex sm:self-auto">
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
              icon={
                LayoutGridIcon as unknown as Parameters<
                  typeof HugeiconsIcon
                >[0]["icon"]
              }
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
              icon={
                LayoutListIcon as unknown as Parameters<
                  typeof HugeiconsIcon
                >[0]["icon"]
              }
              size={16}
              color="currentColor"
            />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(v) => handleFilterChange(v as FilterTab)}
          className="min-w-0 w-full sm:w-auto"
        >
          <TabsList className="h-8 w-full justify-start overflow-x-auto bg-card p-[3px] [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden">
            {(
              ["all", "active", "trials", "urgent", "cancelled"] as FilterTab[]
            ).map((tab) => (
              <TabsTab
                key={tab}
                value={tab}
                className="px-3 py-1 text-xs font-medium capitalize data-[selected]:text-primary"
              >
                {tab === "urgent" ? "Renewing Soon" : tab}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>

        {/* Search input */}
        <div className="relative w-full shrink-0 sm:w-64">
          <HugeiconsIcon
            icon={
              Search01Icon as unknown as Parameters<
                typeof HugeiconsIcon
              >[0]["icon"]
            }
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
          <p className="text-sm font-medium text-foreground">
            No subscriptions found
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {searchQuery
              ? `No results match "${searchQuery}" under the "${filter}" filter.`
              : `No subscriptions match the selected filter.`}
          </p>
        </div>
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
              {gridCards}
            </div>
          ) : (
            <>
              {/* Mobile fallback: cards — the table needs more width than a phone has */}
              <div className="grid grid-cols-1 gap-3 sm:hidden">
                {gridCards}
              </div>
              {/* Table View — sm and up */}
              <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
                <div className="-mx-px overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="border-b border-border bg-secondary/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Merchant</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Renewal Date</th>
                      <th className="hidden px-4 py-3 md:table-cell">
                        Friction
                      </th>
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
                            className="inline-flex items-center gap-2.5 hover:underline"
                          >
                            <MerchantAvatar
                              merchant={sub.merchant}
                              faviconUrl={merchantFaviconUrl(sub)}
                              size={24}
                            />
                            <PendingWrap className="inline-flex items-center gap-1">
                              {sub.merchant}
                            </PendingWrap>
                            <LinkPendingDot />
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-numeric text-foreground">
                          {formatPrice(
                            sub.price,
                            sub.currency,
                            sub.billingInterval,
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatRenewalDate(sub.nextRenewalAt)}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground md:table-cell">
                          {sub.cancellationDifficulty
                            ? frictionLabel(sub.cancellationDifficulty)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                              sub.status === "cancelled" || sub.hidden === true
                                ? "bg-slate-500/10 text-slate-400"
                                : "bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {sub.hidden === true ? "Hidden" : sub.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {sub.status === "cancelled" || sub.hidden === true ? (
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={restoringId === sub._id}
                              onClick={() => handleRestore(sub)}
                              className="h-7 text-xs"
                            >
                              {restoringId === sub._id
                                ? "Restoring..."
                                : "Restore"}
                            </Button>
                          ) : (
                            <Link
                              href={`/subscriptions/${sub._id}`}
                              className="inline-flex items-center"
                            >
                              <Button
                                variant="ghost"
                                size="xs"
                                className="h-7 gap-1 text-xs"
                              >
                                <PendingWrap className="inline-flex items-center gap-1">
                                  Inspect
                                </PendingWrap>
                                <LinkPendingDot />
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center font-mono text-xs text-muted-foreground sm:text-left">
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
                  className="h-8 flex-1 text-xs font-medium sm:flex-none"
                >
                  Previous
                </Button>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="h-8 flex-1 text-xs font-medium sm:flex-none"
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
