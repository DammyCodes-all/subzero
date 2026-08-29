export type NormalizedEmail = {
  text: string;
  subject: string;
  detectedInner: boolean;
  htmlStripped: string;
};

const FORWARD_DELIMITERS = [
  /-{2,}\s*Forwarded message\s*-{2,}/i,
  /Begin forwarded message:/i,
  /Forwarded message/i,
];

const MAX_CHARS = 20000;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGmailQuoteInner(html: string): string | null {
  // Gmail wraps forwarded original in <blockquote class="gmail_quote"> — only this is authoritative.
  const m = html.match(
    /<blockquote[^>]*class="[^"]*gmail_quote[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i,
  );
  if (m?.[1]) return m[1];
  return null;
}

function tryExtractInnerText(text: string): {
  inner: string | null;
  detected: boolean;
} {
  for (const re of FORWARD_DELIMITERS) {
    const match = text.match(re);
    if (match?.index !== undefined) {
      const after = text.slice(match.index + match[0].length);
      // Look for embedded headers
      const hasHeaders = /From:\s/i.test(after) && /Subject:\s/i.test(after);
      if (hasHeaders || after.length > 100) {
        return { inner: after.trim(), detected: true };
      }
    }
  }
  return { inner: null, detected: false };
}

export function normalizeEmail(input: {
  text?: string;
  html?: string;
  subject?: string;
}): NormalizedEmail {
  const subject = (input.subject ?? "").trim().slice(0, 500);
  const rawText = (input.text ?? "").trim();
  const rawHtml = (input.html ?? "").trim();

  let detectedInner = false;
  let chosenText = rawText;
  let htmlStripped = rawHtml ? stripHtml(rawHtml) : "";

  // Prefer Gmail quote inner HTML if present
  if (rawHtml) {
    const innerHtml = extractGmailQuoteInner(rawHtml);
    if (innerHtml) {
      const stripped = stripHtml(innerHtml);
      if (stripped.length > 100) {
        htmlStripped = stripped;
        detectedInner = true;
        // Prefer inner text over outer if we found it
        if (!chosenText || stripped.length > chosenText.length * 0.6) {
          chosenText = stripped;
        }
      }
    }
  }

  // Try forward delimiter split on text
  if (rawText) {
    const { inner, detected } = tryExtractInnerText(rawText);
    if (inner && detected) {
      detectedInner = true;
      // If html inner was found, keep longer of the two; otherwise use text inner
      if (inner.length > 50) chosenText = inner;
    }
  }

  // Fallback: if no text but we have htmlStripped, use it
  if (!chosenText && htmlStripped) {
    chosenText = htmlStripped;
  }

  // If both exist, pick longer as primary text but keep htmlStripped separately
  if (rawText && htmlStripped && !detectedInner) {
    // Keep rawText as chosenText, htmlStripped as secondary — but merge if one is much shorter
    if (htmlStripped.length > chosenText.length * 1.5) {
      chosenText = htmlStripped;
    }
  }

  // Cap
  if (chosenText.length > MAX_CHARS) {
    chosenText = chosenText.slice(0, MAX_CHARS);
  }
  if (htmlStripped.length > MAX_CHARS) {
    htmlStripped = htmlStripped.slice(0, MAX_CHARS);
  }

  // Final fallback: include subject if body empty
  if (!chosenText && subject) {
    chosenText = subject;
  }

  return {
    text: chosenText,
    subject,
    detectedInner,
    htmlStripped,
  };
}
