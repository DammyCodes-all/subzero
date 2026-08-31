import type { Id } from "../../../convex/_generated/dataModel";

export type ActionStatus =
  | "action_ready"
  | "user_started"
  | "cancellation_pending";

export type CancellationMethod =
  | "open_web"
  | "open_provider"
  | "send_email"
  | "contact_support"
  | "manual"
  | "unknown";

export interface ActionItem {
  _id: Id<"subscriptions">;
  merchant: string;
  product?: string;
  price: number;
  currency: string;
  billingInterval: "monthly" | "yearly" | "weekly" | "unknown";
  status: ActionStatus | "active" | "cancelled" | "failed";
  cancellationMethod?: CancellationMethod;
  cancellationUrl?: string;
  cancellationDifficulty?: "low" | "medium" | "high" | "very_high";
  nextRenewalAt?: number;
  trialEndsAt?: number;
}

export const STATUS_LABELS: Record<string, string> = {
  action_ready: "Ready to cancel",
  user_started: "In progress",
  cancellation_pending: "Pending confirmation",
};

export const STATUS_COLORS: Record<string, string> = {
  action_ready: "bg-primary/10 text-primary",
  user_started: "bg-amber-500/10 text-amber-400",
  cancellation_pending: "bg-violet-500/10 text-violet-400",
};

export const METHOD_LABELS: Record<string, string> = {
  open_web: "Cancel via website",
  open_provider: "Cancel via billing provider",
  send_email: "Send cancellation email",
  contact_support: "Contact support",
  manual: "Manual steps",
  unknown: "Method unknown",
};
