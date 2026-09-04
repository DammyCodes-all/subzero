export type Difficulty = "low" | "medium" | "high" | "very_high";
export type ActionType =
  | "open_web"
  | "open_provider"
  | "send_email"
  | "contact_support"
  | "manual"
  | "unknown";

export function getDifficulty(type: ActionType, steps: number): Difficulty {
  if (type === "unknown") return "very_high";
  if (type === "contact_support") return "very_high";
  if (steps >= 7) return "high";
  if (steps >= 4) return "medium";
  return "low";
}
