export type NotificationLeadTime = "7d" | "3d" | "24h";

export interface NotificationPrefs {
  enabled7d: boolean;
  enabled3d: boolean;
  enabled24h: boolean;
}

export interface NotificationRow {
  _id: string;
  type: string;
  status: string;
  scheduledAt: number;
  attemptedAt?: number;
  subscriptionId: string;
}
