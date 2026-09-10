"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useCallback } from "react";
import { sileo } from "sileo";

export function useConnectGmail() {
  const authToken = useAuthToken();
  const { isLoading } = useConvexAuth();

  return useCallback(async () => {
    // Never navigate blind: without a session token the POST below can't
    // set the auth cookie, and the GET route bounces to a "sign in first"
    // failure that can never succeed. This bit right after fast
    // delete-then-reconnect clicks, when the session is still restoring —
    // failing the absolute first try and passing on retry. Stay put and
    // say so instead of a doomed roundtrip.
    if (isLoading || !authToken) {
      sileo.error({
        title: "Still signing you in",
        description: "Give it a moment, then try Connect Gmail again.",
      });
      return;
    }
    try {
      // POST the JWT so the server route can set an httpOnly cookie.
      await fetch("/api/gmail/oauth", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch {}
    window.location.href = "/api/gmail/oauth";
  }, [authToken, isLoading]);
}
