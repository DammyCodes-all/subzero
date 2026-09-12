"use client";

import { useAction } from "convex/react";
import { useCallback } from "react";
import { sileo } from "sileo";
import { api } from "../../convex/_generated/api";

export function useConnectGmail() {
  const getAuthUrl = useAction(api.gmailOAuth.getAuthUrl);

  return useCallback(async () => {
    try {
      const { url } = await getAuthUrl({});
      window.location.href = url;
    } catch {
      sileo.error({
        title: "Couldn't start Gmail connect",
        description: "Sign in first, then try Connect Gmail again.",
      });
    }
  }, [getAuthUrl]);
}
