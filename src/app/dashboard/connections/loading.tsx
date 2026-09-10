// Shell for /dashboard/connections — mirrors ConnectionsView
// (header, Gmail inbox rows, forwarding card).
import { ConnectionsSkeleton } from "@/components/Skeleton";

export default function ConnectionsLoading() {
  return (
    <div aria-hidden>
      <ConnectionsSkeleton />
    </div>
  );
}
