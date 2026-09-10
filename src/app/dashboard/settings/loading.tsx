// Shell for /dashboard/settings — mirrors SettingsView sections
// (notifications, your data, export, history, danger zone).
import { SettingsSkeleton } from "@/components/Skeleton";

export default function SettingsLoading() {
  return (
    <div aria-hidden>
      <SettingsSkeleton />
    </div>
  );
}
