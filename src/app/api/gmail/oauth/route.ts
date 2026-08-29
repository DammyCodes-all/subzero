import { NextRequest, NextResponse } from "next/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

function getBearerToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7).trim() || null;
  return null;
}

// POST is used by the React client (ConvexAuthProvider stores JWT in localStorage,
// not in nextjs cookies). Client POSTs its Bearer token to set a httpOnly cookie
// that GET and the callback can then read.
export async function POST(req: NextRequest) {
  const token = getBearerToken(req) ?? (await convexAuthNextjsToken());
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("__gmail_oauth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Prefer nextjs cookie, fallback to the token cookie set via POST (react provider)
  const nextjsToken = await convexAuthNextjsToken();
  const cookieToken = req.cookies.get("__gmail_oauth_token")?.value;
  const token = nextjsToken ?? cookieToken ?? getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Missing GOOGLE_CLIENT_ID" }, { status: 500 });
  }
  const redirectUri = `${url.origin}/api/gmail/callback`;
  // CSRF protection: random state stored in httpOnly cookie
  const state = crypto.randomUUID();
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
  );
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  const res = NextResponse.redirect(authUrl);
  res.cookies.set("__gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min
  });
  return res;
}
