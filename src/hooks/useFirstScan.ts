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
}: {
  gmailStatus: FirstScanStatus | undefined;
  subCount: number;
}) {
  const scan = useAction(api.gmailActions.scanGmail);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  // Snapshot of the last completed scan in this episode. Powers the
  // one-time results summary ("We found N…"). Null on fresh episodes.
  const [scanResult, setScanResult] = useState<{
    scanned: number;
    created: number;
  } | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  // Latched at the moment a never-scanned episode begins. Prevents
  // full-to-banner flips as receipts stream in mid-scan.
  const [startedZero, setStartedZero] = useState<boolean | null>(null);
  const triedRef = useRef(false);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const connected = !!gmailStatus?.connected;
  const lastScanAt = gmailStatus?.lastGmailScanAt;
  const isNeverScanned = connected && !lastScanAt;

  useEffect(() => {
    if (!isNeverScanned) {
      // While our own full scan is still in flight, keep the latch. The
      // scan timestamp can land early (the incremental poll stamps it as
      // soon as it seeds the history id), and resetting here would unmount
      // the takeover mid-scan and flicker to the zero-state.
      if (!inFlightRef.current) setStartedZero(null);
      return;
    }
    setStartedZero((prev) => (prev === null ? subCount === 0 : prev));
  }, [isNeverScanned, subCount]);

  const isNewUserEpisode = startedZero ?? subCount === 0;
  // Stay on the takeover until our scan action resolves, even if the
  // timestamp lands early via the incremental poll. Single handoff at
  // the end, no mid-scan flicker.
  const showFullFirstScan = (isNeverScanned || scanning) && isNewUserEpisode;
  const showScanBanner = isNeverScanned && !isNewUserEpisode;

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
      return;
    }
    if (lastScanAt) {
      setScanError(null);
      return;
    }
    if (triedRef.current || inFlightRef.current) return;
    void triggerScan();
  }, [gmailStatus, connected, lastScanAt, triggerScan]);

  const retry = useCallback(() => {
    triedRef.current = false;
    inFlightRef.current = false;
    void triggerScan();
  }, [triggerScan]);

  return {
    showFullFirstScan,
    showScanBanner,
    /** One-time summary once the first scan lands with new subs. */
    showFirstSummary:
      isNewUserEpisode &&
      !scanning &&
      !summaryDismissed &&
      (scanResult?.created ?? 0) > 0,
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
