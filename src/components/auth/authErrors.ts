/** Shared mapping for Convex Auth failures. Never surface raw library codes. */

export function cleanAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^(Uncaught Error:\s*)+/i, "").slice(0, 500);
}

/** Our backend throws human copy; anything else is an internal code. */
const HUMAN_BACKEND_PATTERNS = [
  /already connected to another SubZero account/i,
  /already registered/i,
  /already exists/i,
  /Invalid email/i,
  /Name (required|must be|may only)/i,
  /Password must be at least 8/i,
];

export function mapCredentialError(clean: string): string | null {
  // Unknown email and wrong password map identically on purpose:
  // distinguishing them would let attackers probe which emails registered.
  if (/InvalidAccountId|InvalidSecret|Invalid credentials/i.test(clean))
    return "Wrong email or password.";
  if (/Too many/i.test(clean) || /Rate limit/i.test(clean))
    return "Too many attempts. Try again in a few minutes.";
  return null;
}

export function fallbackAuthError(clean: string): string {
  if (!clean) return "Something went wrong. Try again.";
  if (HUMAN_BACKEND_PATTERNS.some((re) => re.test(clean))) return clean;
  return "Something went wrong. Try again.";
}
