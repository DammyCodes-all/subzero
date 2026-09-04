"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { useCallback } from "react";

export function useConnectGmail() {
  const authToken = useAuthToken();

  return useCallback(async () => {
    try {
      // POST the JWT so the server route can set an httpOnly cookie.
      if (authToken) {
        await fetch("/api/gmail/oauth", {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch {}
    window.location.href = "/api/gmail/oauth";
  }, [authToken]);
}
