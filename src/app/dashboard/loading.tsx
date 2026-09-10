// Instant shell for /dashboard — mirrors DashboardView (greeting,
// summary strip, hero receipt card, upcoming rows). Static, no client JS.
import { DashboardSkeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div aria-hidden>
      <DashboardSkeleton />
    </div>
  );
}
