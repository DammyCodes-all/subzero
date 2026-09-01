"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { sileo } from "sileo";
import { api } from "../../../convex/_generated/api";

function copyFor(
  status: string,
  subject?: string,
  reason?: string,
): { title: string; description?: string; type: "loading" | "success" | "info" | "error" } {
  const subj = subject?.slice(0, 32) ?? "receipt";
  switch (status) {
    case "processing":
      return {
        title: `Checking "${subj}"...`,
        description: "Looking for subscription details. One moment",
        type: "loading",
      };
    case "created":
      return {
        title: reason ? `Added ${reason}` : "Subscription added",
        description: reason
          ? `${reason} is now tracked. We'll remind you before the next charge`
          : "We'll remind you before it renews",
        type: "success",
      };
    case "merged":
      return {
        title: reason ? `Updated ${reason}` : "Subscription updated",
        description: "We refreshed the renewal date",
        type: "success",
      };
    case "duplicate":
      return {
        title: reason ? `Already tracking ${reason}` : "Already tracking this one",
        description: "It's already in your list. No need to forward again",
        type: "info",
      };
    case "cancelled":
      return {
        title: reason ? `${reason} marked as cancelled` : "Marked as cancelled",
        description: "We'll keep it in history and stop reminders",
        type: "success",
      };
    case "skipped":
    case "unparsed":
      return {
        title: "No subscription found",
        description: `We checked "${subj}". It didn't look like a receipt, so we skipped it`,
        type: "info",
      };
    case "failed":
    case "no_user":
      return {
        title: "We couldn't add this email",
        description: "Try forwarding from the Gmail address connected to SubZero",
        type: "error",
      };
    default:
      return { title: subj, type: "info" };
  }
}

export function IngestionToasts() {
  const recent = useQuery(api.ingestionAttempts.listRecent, { limit: 5 });
  const prevStatus = useRef<Map<string, string>>(new Map());
  const toastMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!recent) return;
    for (const a of recent) {
      const id = a._id as string;
      const prev = prevStatus.current.get(id);
      const curr = a.status;
      if (prev === curr) continue;

      // If was processing and now terminal, dismiss loading toast first
      if (prev === "processing" && curr !== "processing") {
        const loadingToastId = toastMap.current.get(id);
        if (loadingToastId) {
          try { sileo.dismiss(loadingToastId); } catch {}
          toastMap.current.delete(id);
        }
      }

      // For processing, show persistent loading toast (duration null)
      if (curr === "processing") {
        if (toastMap.current.has(id)) continue; // already showing
        const { title, description } = copyFor(curr, a.subject, a.reason);
        const toastId = sileo.show({
          title,
          description,
          type: "loading",
          duration: null,
        });
        if (toastId) toastMap.current.set(id, toastId);
        prevStatus.current.set(id, curr);
        continue;
      }

      // Terminal statuses (curr is not processing here)
      // Avoid re-firing old terminal on mount — only toast if we saw processing before,
      // or if terminal is very fresh (<30s) and we missed the processing tick.
      if (prev && prev !== "processing") continue;
      if (!prev) {
        const age = Date.now() - (a.updatedAt ?? a.receivedAt);
        if (age > 30_000) {
          prevStatus.current.set(id, curr);
          continue;
        }
      }
      const { title, description, type } = copyFor(curr, a.subject, a.reason);
      const fn = type === "success" ? sileo.success : type === "error" ? sileo.error : sileo.info;
      fn({ title, description });
      prevStatus.current.set(id, curr);
      // cleanup map for terminal that was loading
      toastMap.current.delete(id);
    }

    // Cleanup: remove tracking for attempts no longer in recent (older than window) but keep status map small
    const recentIds = new Set(recent.map((r) => r._id as string));
    for (const k of Array.from(prevStatus.current.keys())) {
      if (!recentIds.has(k)) {
        const tid = toastMap.current.get(k);
        if (tid) try { sileo.dismiss(tid); } catch {}
        prevStatus.current.delete(k);
        toastMap.current.delete(k);
      }
    }
  }, [recent]);

  return null;
}
