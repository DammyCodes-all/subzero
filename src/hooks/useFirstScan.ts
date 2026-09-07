"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { api } from "../../convex/_generated/api";
import { scanReasonCopy, scanResultCopy } from "@/lib/scanCopy";

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
  // Latched at the moment a never-scanned episode begins — prevents
  // full→banner flips as receipts stream in mid-scan.
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
      setStartedZero(null);
      return;
    }
    setStartedZero((prev) => (prev === null ? subCount === 0 : prev));
  }, [isNeverScanned, subCount]);

  const isNewUserEpisode = startedZero ?? subCount === 0;
  const showFullFirstScan = isNeverScanned && isNewUserEpisode;
  const showScanBanner = isNeverScanned && !isNewUserEpisode;

  const triggerScan = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    triedRef.current = true;
    if (mountedRef.current) {
      setScanError(null);
      setScanning(true);
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
          // Auth failures flip connected→false, which unmounts this UI on
          // its own — don't leave a stale retry behind.
          if (res.reason === "no_consent" || res.reason === "token_failed") {
            setScanError(null);
          } else {
            setScanError(copy.description);
          }
        }
        sileo.error({ title: copy.title, description: copy.description });
      } else {
        if (mountedRef.current) setScanError(null);
        sileo.success({ title: copy.title, description: copy.description });
      }
    } catch {
      if (mountedRef.current) {
        setScanError(scanReasonCopy("scan_failed"));
      }
      sileo.error({
        title: "Gmail scan failed",
        description: "Gmail scan hit a temporary error. Try again in a moment.",
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
    /** Legacy alias — prefer showFullFirstScan. */
    showFirstScan: showFullFirstScan,
    scanning,
    scanError,
    retry,
    email: gmailStatus?.accountEmail,
    foundCount: subCount,
  };
}
