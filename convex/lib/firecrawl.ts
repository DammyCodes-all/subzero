import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { components } from "../_generated/api";

export interface ResearchHit {
  url?: string;
  title?: string;
  description?: string;
  snippet?: string;
  markdown?: string;
}

/**
 * Search the web via the official Firecrawl component.
 * Returns a tolerant, version-agnostic hit list (v2 `web`, legacy `data`).
 */
export async function firecrawlSearch(
  ctx: any,
  query: string,
  limit = 10,
): Promise<ResearchHit[]> {
  const client = new FirecrawlClient(components.firecrawl);
  const res = await client.search(ctx, query, { limit });
  const raw: unknown[] = [
    ...((res as { web?: unknown[] }).web ?? []),
    ...((res as { news?: unknown[] }).news ?? []),
    ...((res as { data?: unknown[] }).data ?? []),
  ];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      url: typeof r.url === "string" ? r.url : undefined,
      title: typeof r.title === "string" ? r.title : undefined,
      description:
        typeof r.description === "string" ? r.description : undefined,
      snippet: typeof r.snippet === "string" ? r.snippet : undefined,
      markdown: typeof r.markdown === "string" ? r.markdown : undefined,
    }));
}

export interface ScrapedPage {
  url: string;
  markdown: string;
  links: string[];
}

/**
 * Scrape one URL via the official Firecrawl component.
 * Returns null on any failure so callers can fall back to snippets.
 */
export async function firecrawlScrape(
  ctx: any,
  url: string,
): Promise<ScrapedPage | null> {
  try {
    const client = new FirecrawlClient(components.firecrawl);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    let doc: Record<string, unknown>;
    try {
      doc = (await client.scrape(ctx, url, {
        formats: ["markdown", "links"],
        onlyMainContent: true,
      })) as unknown as Record<string, unknown>;
    } finally {
      clearTimeout(t);
    }
    const nested =
      doc.data && typeof doc.data === "object"
        ? (doc.data as Record<string, unknown>)
        : undefined;
    const markdown = String(
      (typeof doc.markdown === "string" ? doc.markdown : undefined) ??
        (typeof nested?.markdown === "string" ? nested.markdown : undefined) ??
        "",
    );
    if (!markdown) return null;
    const linkSources = [doc.links, nested?.links];
    const links: string[] = [];
    for (const src of linkSources) {
      if (Array.isArray(src)) {
        for (const l of src) if (typeof l === "string") links.push(l);
      }
    }
    return { url, markdown, links };
  } catch {
    return null;
  }
}
