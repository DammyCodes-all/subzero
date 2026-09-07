"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { sileo } from "sileo";
import { api } from "../../convex/_generated/api";
import { scanResultCopy } from "@/lib/scanCopy";

/**
 * Single owner of the first-scan lifecycle.
 * DashboardView uses this — EmptyState must NOT auto-trigger, otherwise
 * two concurrent scanGmail actions run and DashboardView flips to
 * populated mid-scan (overriding FirstScanView on first receipt).
 */
export function useFirstScan() {
  const gmailStatus = useQuery(api.gmail.getGmailStatus);
  const all = useQuery(api.subscriptions.list);
  const scan = useAction(api.gmailActions.scanGmail);
  const [scanning, setScanning] = useState(false);
  const triedRef = useRef(false);
  const inFlightRef = useRef(false);

  const connected = !!gmailStatus?.connected;
  const lastScanAt = gmailStatus?.lastGmailScanAt;
  // Show FirstScanView while never-scanned + connected, OR while our own
  // scan is in flight (bridges query lag after touchScan).
  const showFirstScan = connected && (!lastScanAt || scanning);

  useEffect(() => {
    if (!gmailStatus) return;
    if (!connected) {
      triedRef.current = false;
      return;
    }
    if (lastScanAt) return;
    if (triedRef.current || inFlightRef.current) return;
    triedRef.current = true;
    inFlightRef.current = true;
    setScanning(true);
    scan({})
      .then((r) => {
        const res = r as {
          scanned: number;
          created: number;
          reason?: string;
        };
        const copy = scanResultCopy(res);
        if (copy.kind === "error") {
          sileo.error({ title: copy.title, description: copy.description });
        } else {
          sileo.success({ title: copy.title, description: copy.description });
        }
      })
      .catch(() =>
        sileo.error({
          title: "Gmail scan failed",
          description:
            "Gmail scan hit a temporary error. Try again in a moment.",
        }),
      )
      .finally(() => {
        inFlightRef.current = false;
        setScanning(false);
      });
  }, [gmailStatus, connected, lastScanAt, scan]);

  return {
    showFirstScan,
    scanning,
    email: gmailStatus?.accountEmail,
    foundCount: all?.length ?? 0,
    gmailStatus,
  };
}
