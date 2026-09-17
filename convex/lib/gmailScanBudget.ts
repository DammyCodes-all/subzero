export const INITIAL_SCAN_TOTAL_CAP = 100;
export const INITIAL_SCAN_INLINE_CAP = 30;
export const INITIAL_SCAN_NARROW_CAP = 50;

export function remainingScanBudget(processed: number, cap: number): number {
  return Math.max(0, cap - Math.max(0, processed));
}

export function takeWithinScanBudget<T>(
  items: T[],
  processed: number,
  cap: number,
): T[] {
  return items.slice(0, remainingScanBudget(processed, cap));
}
