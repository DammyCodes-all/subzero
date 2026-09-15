import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily sweep for renewal + trial lead-time nudges
crons.interval(
  "daily renewal nudge sweep",
  { hours: 24 },
  internal.notifications.sweepUpcomingNudges,
);

// Daily sweep for stuck cancel reminders (once-only per sub)
crons.interval(
  "daily stuck cancel reminder sweep",
  { hours: 24 },
  internal.notifications.sweepStaleReminders,
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
  "cleanup expired gmail oauth states",
  { hours: 24 },
  internal.gmailOAuth.cleanupExpiredStates,
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
