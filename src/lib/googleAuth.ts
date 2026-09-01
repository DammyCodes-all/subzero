export const GOOGLE_OAUTH_REDIRECT = "/auth?oauth=google";
export const GOOGLE_OAUTH_ATTEMPT_KEY = "subzero:google-oauth-attempt";

export function markGoogleOAuthAttempt() {
  window.sessionStorage.setItem(GOOGLE_OAUTH_ATTEMPT_KEY, "1");
}

export function clearGoogleOAuthAttempt() {
  window.sessionStorage.removeItem(GOOGLE_OAUTH_ATTEMPT_KEY);
}

export function hasGoogleOAuthAttempt() {
  return window.sessionStorage.getItem(GOOGLE_OAUTH_ATTEMPT_KEY) === "1";
}
