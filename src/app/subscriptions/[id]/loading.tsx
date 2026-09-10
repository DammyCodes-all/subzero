// Shell for /subscriptions/[id] — mirrors SubscriptionDetailView
// (identity, primary action, how-to-cancel, evidence, manage card).
// Param-specific data streams after commit.
import { DetailSkeleton } from "@/components/Skeleton";

export default function SubscriptionDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[680px]" aria-hidden>
      <DetailSkeleton />
    </div>
  );
}
