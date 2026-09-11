"use client";

import type { Doc } from "../../../../../convex/_generated/dataModel";

/**
 * Fixture subscriptions for the intake showcase. Shapes mirror real
 * extractor output (Adobe with a manual-steps route, Spotify on the open
 * web) so the reused dashboard components render exactly as they do
 * in-app. Renewal dates stay relative so urgency badges stay truthful.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const ADOBE_SUB = {
  _id: "mock-adobe",
  merchant: "Adobe Creative Cloud",
  price: 54.99,
  currency: "USD",
  billingInterval: "monthly",
  nextRenewalAt: Date.now() + 2 * DAY_MS,
  cancellationDifficulty: "high",
  cancellationMethod: "manual",
} as unknown as Doc<"subscriptions">;

export const SPOTIFY_SUB = {
  _id: "mock-spotify",
  merchant: "Spotify",
  price: 11.99,
  currency: "USD",
  billingInterval: "monthly",
  nextRenewalAt: Date.now() + 5 * DAY_MS,
  cancellationDifficulty: "medium",
  cancellationMethod: "open_web",
  cancellationUrl: "https://support.spotify.com/us/article/how-to-cancel/",
} as unknown as Doc<"subscriptions">;
