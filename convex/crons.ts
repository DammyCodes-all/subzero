import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily sweep for renewal lead-time nudges
crons.interval(
  "daily renewal nudge sweep",
  { hours: 24 },
  internal.notifications.sweepUpcomingNudges,
);

crons.interval(
  "retry failed research",
  { hours: 6 },
  internal.research.retryFailedResearch,
);

crons.interval(
  "cleanup old ingestion attempts",
  { hours: 24 },
  internal.ingestionAttempts.cleanupOldAttempts,
);

crons.interval(
  "gmail incremental poll",
  { minutes: 15 },
  internal.gmailWatch.pollAllUsersIncremental,
);

crons.daily(
  "gmail watch renewal",
  { hourUTC: 2 },
  internal.gmailWatch.renewWatchesForAll,
);

export default crons;
