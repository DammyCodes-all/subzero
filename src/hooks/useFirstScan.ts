"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { scanReasonCopy, scanResultCopy } from "@/lib/scanCopy";
import { api } from "../../convex/_generated/api";

interface FirstScanStatus {
  connected?: boolean;
  lastGmailScanAt?: number;
  accountEmail?: string;
}

/**
 * Single owner of the first-scan lifecycle.
 * DashboardView passes its own queries in so we don't double-subscribe.
 * - Full takeover only for new users (zero subs at scan start, latched so
 *   streaming receipts don't flip it mid-scan); existing users adding a
 *   2nd inbox get a compact banner instead (showScanBanner).
 * - Non-auth failures surface scanError + retry instead of trapping the
 *   user on an infinite spinner.
 */
export function useFirstScan({
  gmailStatus,
  subCount,
  backfillActive = false,
  backfillReady = true,
}: {
  gmailStatus: FirstScanStatus | undefined;
  subCount: number;
  backfillActive?: boolean;
  /** False while scan-health is still loading — don't decide yet. */
  backfillReady?: boolean;
}) {
  const scan = useAction(api.gmailManualScan.scanGmail);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // Snapshot of the last completed scan in this episode. Powers the
  // one-time results summary ("We found N…"). Null on fresh episodes.
  const [scanResult, setScanResult] = useState<{
    scanned: number;
    created: number;
    remaining?: boolean;
  } | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  // Latched at the moment a never-scanned episode begins. Prevents
  // full-to-banner flips as receipts stream in mid-scan.
  const [startedZero, setStartedZero] = useState<boolean | null>(null);
  const triedRef = useRef(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const prevNeverRef = useRef(false);
  // True once we observe backend-owned historical work for this episode.
  // Powers the summary when no browser-owned scan ever ran.
  const [sawBackendWork, setSawBackendWork] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const connected = !!gmailStatus?.connected;
  const lastScanAt = gmailStatus?.lastGmailScanAt;
  const isNeverScanned = connected && !lastScanAt;

  // Remember backend work for the summary gate.
  useEffect(() => {
    if (backfillActive) setSawBackendWork(true);
  }, [backfillActive]);

  // New episode (never-scanned flips false→true): latch zero-start, reset
  // per-episode UI so a later reconnect can show its own summary.
  useEffect(() => {
    if (isNeverScanned && !prevNeverRef.current) {
      setStartedZero(subCount === 0);
      setSummaryDismissed(false);
      setScanResult(null);
      setSawBackendWork(backfillActive);
    }
    prevNeverRef.current = isNeverScanned;
  }, [isNeverScanned, subCount, backfillActive]);

  // Mid-scan latch: preserve startedZero while the episode is active so
  // streaming receipts don't flip full-takeover to banner. Do NOT clear on
  // completion — the summary needs the latch after lastScanAt lands. The
  // next episode's transition above re-latches.
  useEffect(() => {
    if (!isNeverScanned) return;
    setStartedZero((prev) => (prev === null ? subCount === 0 : prev));
  }, [isNeverScanned, subCount]);

  const isNewUserEpisode = startedZero ?? subCount === 0;
  // Stay on the takeover until our scan action resolves AND the deep-scan
  // drain clears — otherwise the "We found N" summary fires on partial
  // counts while more subs stream in behind it.
  const deepScanRunning = backfillActive || (scanResult?.remaining ?? false);
  const showFullFirstScan =
    (isNeverScanned || scanning || deepScanRunning) && isNewUserEpisode;
  const showScanBanner =
    (isNeverScanned || deepScanRunning) && !isNewUserEpisode;

  const triggerScan = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    triedRef.current = true;
    if (mountedRef.current) {
      setScanError(null);
      setScanning(true);
      setScanResult(null);
      setSummaryDismissed(false);
    }
    try {
      const r = await scan({});
      const res = r as {
        scanned: number;
        created: number;
        reason?: string;
        remaining?: boolean;
      };
      const copy = scanResultCopy(res);
      if (copy.kind === "error") {
        if (mountedRef.current) {
          // Auth failures flip connected to false, which unmounts this UI
          // on its own. Don't leave a stale retry behind.
          if (res.reason === "no_consent" || res.reason === "token_failed") {
            setScanError(null);
          } else {
            setScanError(copy.description);
          }
        }
        sileo.error({ title: copy.title, description: copy.description });
      } else if (copy.kind === "progress") {
        // First pass only — takeover stays up until backfill drains; the
        // final summary fires there, not here.
        if (mountedRef.current) {
          setScanError(null);
          setScanResult({
            scanned: res.scanned ?? 0,
            created: res.created ?? 0,
            remaining: true,
          });
        }
        sileo.info({ title: copy.title, description: copy.description });
      } else {
        if (mountedRef.current) {
          setScanError(null);
          setScanResult({
            scanned: res.scanned ?? 0,
            created: res.created ?? 0,
          });
        }
        sileo.success({ title: copy.title, description: copy.description });
      }
    } catch {
      if (mountedRef.current) {
        setScanError(scanReasonCopy("scan_failed"));
      }
      sileo.error({
        title: "Scan failed",
        description: "Something hiccuped on our side. Try again in a bit.",
      });
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setScanning(false);
    }
  }, [scan]);

  useEffect(() => {
    if (gmailStatus === undefined) return;
    if (!connected) {
      triedRef.current = false;
      inFlightRef.current = false;
      setScanError(null);
      setScanning(false);
      setSawBackendWork(false);
      setStartedZero(null);
      return;
    }
    if (lastScanAt) {
      setScanError(null);
      return;
    }
    // Wait for scan-health before deciding: immediately after OAuth the
    // health query is still loading (backfillActive=false) while the
    // backend has already seeded its drain. Triggering now would double-scan.
    if (!backfillReady) return;
    // A new connection seeds its historical backfill in the token-storage
    // mutation. Let that backend-owned worker run instead of racing it with a
    // second browser-owned scan.
    if (backfillActive) return;
    if (triedRef.current || inFlightRef.current) return;
    void triggerScan();
  }, [
    gmailStatus,
    connected,
    lastScanAt,
    backfillActive,
    backfillReady,
    triggerScan,
  ]);

  // Latch the first pass: once the drain clears, remaining flips false and
  // the summary below may fire once with final live counts.
  useEffect(() => {
    if (!backfillActive && scanResult?.remaining) {
      setScanResult((p) => (p ? { ...p, remaining: false } : p));
    }
  }, [backfillActive, scanResult?.remaining]);

  const retry = useCallback(() => {
    triedRef.current = false;
    inFlightRef.current = false;
    void triggerScan();
  }, [triggerScan]);

  return {
    showFullFirstScan,
    showScanBanner,
    /** One-time summary once the full scan (incl. deep drain) lands. */
    showFirstSummary:
      isNewUserEpisode &&
      !scanning &&
      !deepScanRunning &&
      !summaryDismissed &&
      ((scanResult?.created ?? 0) > 0 || (sawBackendWork && subCount > 0)),
    dismissSummary: () => setSummaryDismissed(true),
    /** Legacy alias. Prefer showFullFirstScan. */
    showFirstScan: showFullFirstScan,
    scanning,
    scanError,
    retry,
    email: gmailStatus?.accountEmail,
    foundCount: subCount,
  };
}
