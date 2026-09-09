/** Filled, borderless auth inputs. Idle state has no visible border; */
/** focus is a quiet cream edge (see .auth-input in AuthView). */
export function authInputClassName(invalid = false) {
  return invalid
    ? "auth-input h-11 border-destructive/60 bg-[var(--card-hover)] focus-visible:ring-destructive/20"
    : "auth-input h-11 border-transparent bg-[var(--card-hover)]";
}
