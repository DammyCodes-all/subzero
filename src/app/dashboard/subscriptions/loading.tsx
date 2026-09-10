// Shell for /dashboard/subscriptions — mirrors SubscriptionsView
// (header + view toggle, filter tabs + search, receipt card grid).
import { SubscriptionsSkeleton } from "@/components/Skeleton";

export default function SubscriptionsLoading() {
  return (
    <div aria-hidden>
      <SubscriptionsSkeleton />
    </div>
  );
}
