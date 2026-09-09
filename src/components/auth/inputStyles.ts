/** Auth inputs: dark green-black fill with a subtle cream border. */
/** Focus is a quiet cream edge (see .auth-input in globals.css). */
export function authInputClassName(invalid = false) {
  return invalid
    ? "auth-input h-11 border-destructive/60 bg-[#0d1411] focus-visible:ring-destructive/20"
    : "auth-input h-11 border-border bg-[#0d1411]";
}
