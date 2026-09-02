import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // 16.3 Instant Navigation: one App Shell per route, cached on client.
  // Links prefetch the shell on viewport entry; pending via loading.tsx skeleton (no sidebar spinner).
  partialPrefetching: true,
  experimental: {
    // prevents `Cannot read properties of undefined (reading 'validationLevel')` after HMR
    instantInsights: { validationLevel: "warning" as const },
  },
};

export default nextConfig;
