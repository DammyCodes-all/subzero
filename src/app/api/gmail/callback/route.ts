import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) {
    // User pressed Deny or closed the Google screen. Not an error,
    // so the dashboard shows a gentle note instead of a failure toast.
    if (error === "access_denied") {
      return NextResponse.redirect(`${url.origin}/dashboard?gmail_cancelled=1`);
    }
    console.error("gmail oauth error from google", error);
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Google couldn't finish the connection. Try again in a bit.")}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Google didn't send us back properly. Try connecting again.")}`,
    );
  }
  // Verify OAuth state (CSRF)
  const expectedState = req.cookies.get("__gmail_oauth_state")?.value;
  if (!expectedState || !state || state !== expectedState) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("That attempt expired before finishing. Try connecting again.")}`,
    );
  }
  const nextjsToken = await convexAuthNextjsToken();
  const cookieToken = req.cookies.get("__gmail_oauth_token")?.value;
  const bearer = req.headers.get("authorization")?.startsWith("Bearer ")
    ? req.headers.get("authorization")!.slice(7).trim()
    : null;
  const token = nextjsToken ?? cookieToken ?? bearer;
  if (!token) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Please sign in first, then connect Gmail.")}`,
    );
  }
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  const redirectUri = `${url.origin}/api/gmail/callback`;
  if (!clientId || !clientSecret) {
    console.error("gmail oauth misconfigured: missing google credentials");
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Something is off on our side. Try again in a bit.")}`,
    );
  }

  // Exchange code for tokens — with timeout + retry for transient ETIMEDOUT
  let tokenRes: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      break;
    } catch (e) {
      clearTimeout(timeout);
      // AggregateError with ETIMEDOUT is retryable
      if (attempt < 2)
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      else {
        console.error("gmail token exchange fetch failed after retries", e);
        return NextResponse.redirect(
          `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Google took too long to answer. Check your connection and try again.")}`,
        );
      }
    }
  }
  if (!tokenRes) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Google didn't answer. Check your connection and try again.")}`,
    );
  }
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    console.error(
      "gmail token exchange failed",
      tokenRes.status,
      t.slice(0, 300),
    );
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Google couldn't finish the connection. Try again in a bit.")}`,
    );
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
  };

  // Get userinfo (email + picture) — only trust verified Google userinfo endpoint
  let email = "";
  let picture = "";
  if (tokens.access_token) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      const uiRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
          signal: controller.signal,
        },
      );
      clearTimeout(t);
      if (uiRes.ok) {
        const ui = (await uiRes.json()) as { email?: string; picture?: string };
        email = ui.email || "";
        picture = ui.picture || "";
      }
    } catch {}
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Google didn't include ongoing access. Remove SubZero in your Google Account, then connect again and accept the consent screen.")}`,
    );
  }
  if (!email) {
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("We couldn't read your Gmail address. Try again.")}`,
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("gmail oauth misconfigured: missing convex url");
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent("Something is off on our side. Try again in a bit.")}`,
    );
  }
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  try {
    await client.mutation("gmail:storeByEmail" as any, {
      accountEmail: email.toLowerCase(),
      refreshToken: tokens.refresh_token,
      pictureUrl: picture || undefined,
    });
  } catch (e: any) {
    const raw = String(e);
    // Make email-mismatch friendly: show which Gmail was chosen vs which account is signed in.
    let friendly = raw;
    if (raw.includes("Email mismatch")) {
      friendly = `Gmail (${email}) does not match your SubZero sign-in. Sign out and sign in with ${email}, then connect Gmail again.`;
    } else if (raw.includes("No user found")) {
      friendly = `No SubZero account for ${email}. Sign in with Google first, then connect Gmail.`;
    } else if (
      raw.includes("Not authenticated") ||
      raw.includes("Invalid token") ||
      raw.includes("jwt")
    ) {
      friendly =
        "Your sign-in expired before Google finished. Sign in again, then connect Gmail.";
    } else if (
      raw.includes("Could not find") ||
      raw.includes("fetch failed") ||
      raw.includes("Failed to fetch")
    ) {
      friendly =
        "We couldn't reach our own server to save that. Check your connection and try again.";
    } else {
      console.error("gmail storeByEmail failed", raw.slice(0, 300));
      friendly = "We couldn't save that connection. Try again in a bit.";
    }
    return NextResponse.redirect(
      `${url.origin}/dashboard?gmail_error=${encodeURIComponent(friendly)}`,
    );
  }

  const res = NextResponse.redirect(
    `${url.origin}/dashboard?gmail_connected=1`,
  );
  console.log("gmail oauth success", email.toLowerCase());
  res.cookies.delete("__gmail_oauth_state");
  res.cookies.delete("__gmail_oauth_token");
  return res;
}
