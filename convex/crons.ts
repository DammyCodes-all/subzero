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

export default crons;
