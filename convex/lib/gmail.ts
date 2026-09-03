"use node";

// Gmail helpers — token refresh, list, get, decode
// Keep lean, no googleapis SDK (fetch only)

function b64UrlDecode(s: string): string {
  // Gmail payload body.data is base64url
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  try {
    return Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

export function buildGmailQuery(days = 90): string {
  // Narrow: subscription receipts in inbox only — exclude sent forwards to avoid duplicate evidence
  return `subject:(receipt OR invoice OR trial OR renewal OR subscription) in:inbox newer_than:${days}d -unsubscribe`;
}

export function buildBroadInboxQuery(days = 7): string {
  // Broad fallback after history gap: all inbox mail, let processOneEmail KEYWORDS filter in code
  return `in:inbox newer_than:${days}d -unsubscribe`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function gmailFetchWithRetry(
  url: string,
  accessToken: string,
  init?: RequestInit,
  retries = 3,
): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` },
      });
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw e;
    }
    if (res.ok) return res;
    // Retry only on rate limit / transient; 404 handled by caller (history gap)
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await res.text().catch(() => "");
      await sleep(1000 * 2 ** attempt);
      lastErr = new Error(`gmail ${res.status} retry ${attempt + 1}`);
      continue;
    }
    return res;
  }
  throw (lastErr as Error) ?? new Error("gmail fetch failed");
}

export async function getAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing GOOGLE_CLIENT_ID/SECRET");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gmail token refresh ${res.status}: ${t.slice(0,300)}`);
  }
  const j = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
}

export async function listMessages(
  accessToken: string,
  query: string,
  maxResults = 15,
  pageToken?: string,
): Promise<{ messages: { id: string; threadId: string }[]; nextPageToken?: string }> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  const res = await gmailFetchWithRetry(url.toString(), accessToken);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gmail list ${res.status}: ${t.slice(0,500)}`);
  }
  const j = (await res.json()) as { messages?: { id: string; threadId: string }[]; nextPageToken?: string };
  return { messages: j.messages ?? [], nextPageToken: j.nextPageToken };
}

// Gmail message payload helpers
type GmailPayload = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPayload[];
  headers?: { name: string; value: string }[];
};

function findHeader(headers: { name: string; value: string }[] | undefined, name: string): string {
  if (!headers) return "";
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function collectBodies(payload: GmailPayload | undefined, out: { text: string[]; html: string[] }) {
  if (!payload) return;
  const mime = payload.mimeType ?? "";
  if (payload.body?.data) {
    const decoded = b64UrlDecode(payload.body.data);
    if (mime.includes("text/plain")) out.text.push(decoded);
    else if (mime.includes("text/html")) out.html.push(decoded);
    else if (!mime) out.text.push(decoded);
    // otherwise ignore (e.g. application/octet-stream)
  }
  if (payload.parts) {
    for (const p of payload.parts) collectBodies(p, out);
  }
}

export async function watchGmail(
  accessToken: string,
  topicName: string,
): Promise<{ historyId: string; expiration: number }> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "INCLUDE",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gmail watch ${res.status}: ${t.slice(0, 500)}`);
  }
  const j = (await res.json()) as { historyId: string; expiration: string };
  return { historyId: j.historyId, expiration: Number(j.expiration) || Date.now() + 7 * 24 * 60 * 60 * 1000 };
}

export async function stopWatch(accessToken: string): Promise<void> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/stop", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gmail stop ${res.status}: ${t.slice(0, 300)}`);
  }
}

export async function getProfileHistoryId(accessToken: string): Promise<string> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gmail profile ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as { historyId?: string };
  if (!j.historyId) throw new Error("gmail profile missing historyId");
  return j.historyId;
}

export async function getHistory(
  accessToken: string,
  startHistoryId: string,
): Promise<{ historyId: string; messagesAdded: { id: string; threadId: string }[] }> {
  const messagesAdded: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;
  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/history");
    url.searchParams.set("startHistoryId", startHistoryId);
    // messageAdded covers new mail; labelsAdded covers mail moved into INBOX later (filter/auto-archive)
    url.searchParams.append("historyTypes", "messageAdded");
    url.searchParams.append("historyTypes", "labelsAdded");
    url.searchParams.set("labelId", "INBOX");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await gmailFetchWithRetry(url.toString(), accessToken);
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 404) {
        const err: any = new Error(`gmail history 404: ${t.slice(0, 300)}`);
        err.code = "INVALID_HISTORY";
        throw err;
      }
      throw new Error(`gmail history ${res.status}: ${t.slice(0, 500)}`);
    }
    const j = (await res.json()) as {
      history?: Array<{
        messagesAdded?: Array<{ message: { id: string; threadId: string } }>;
        labelsAdded?: Array<{ message: { id: string; threadId: string }; labelIds?: string[] }>;
      }>;
      nextPageToken?: string;
      historyId?: string;
    };
    if (j.history) {
      for (const h of j.history) {
        if (h.messagesAdded) {
          for (const ma of h.messagesAdded) {
            if (ma.message?.id) messagesAdded.push(ma.message);
          }
        }
        if (h.labelsAdded) {
          for (const la of h.labelsAdded) {
            if (la.message?.id && (!la.labelIds || la.labelIds.includes("INBOX"))) {
              messagesAdded.push(la.message);
            }
          }
        }
      }
    }
    if (j.historyId) latestHistoryId = j.historyId;
    pageToken = j.nextPageToken;
  } while (pageToken);
  return { historyId: latestHistoryId, messagesAdded };
}

export async function getMessage(
  accessToken: string,
  id: string,
): Promise<{ id: string; subject: string; from: string; text: string; html: string; internalDate: number }> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`;
  const res = await gmailFetchWithRetry(url, accessToken);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gmail get ${id} ${res.status}: ${t.slice(0,500)}`);
  }
  const j = (await res.json()) as {
    id: string;
    internalDate: string;
    payload?: GmailPayload & { headers?: { name: string; value: string }[] };
  };
  const headers = j.payload?.headers;
  const subject = findHeader(headers, "Subject");
  const from = findHeader(headers, "From");
  const out = { text: [] as string[], html: [] as string[] };
  collectBodies(j.payload, out);
  const text = out.text.join("\n\n").slice(0, 50000);
  const html = out.html.join("\n").slice(0, 50000);
  return {
    id: j.id,
    subject: subject || "(no subject)",
    from: from || "",
    text: text || html.replace(/<[^>]+>/g, " ").slice(0, 20000),
    html,
    internalDate: Number(j.internalDate) || Date.now(),
  };
}
