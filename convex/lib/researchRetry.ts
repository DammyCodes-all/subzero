export const MAX_AUTOMATIC_RESEARCH_ATTEMPTS = 3;

export function canRetryResearch(attempts: number | undefined): boolean {
  return (attempts ?? 0) < MAX_AUTOMATIC_RESEARCH_ATTEMPTS;
}
