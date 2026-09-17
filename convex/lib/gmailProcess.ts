import { internal } from "../_generated/api";
import { getMessage } from "./gmail";
import { processOneEmail } from "./processEmail";

export type ScanCounters = {
  scanned: number;
  created: number;
  merged: number;
  skipped: number;
  unparsed: number;
  duplicate: number;
  cancelled: number;
  failed: number;
};

export function newScanCounters(): ScanCounters {
  return {
    scanned: 0,
    created: 0,
    merged: 0,
    skipped: 0,
    unparsed: 0,
    duplicate: 0,
    cancelled: 0,
    failed: 0,
  };
}

type ConnRef = {
  _id: any;
  accountEmail?: string;
};

type FetchedMsg = {
  id: string;
  subject: string;
  text: string;
  html: string;
  from: string;
};

// 3-wide extracts with a start-gap so Groq 8000 TPM isn't burst-tripped.
// Replaces the old serial + fixed 450ms sleep (505s manual scans).
// The starter chain serializes read-wait-write so concurrent workers actually
// space MIN_START_GAP apart (a plain read-then-write races under concurrency
// and both workers pass with zero wait). Module-level = per-isolate throttle,
// which is what TPM wants: concurrent scans share the same budget.
const EXTRACT_CONCURRENCY = 3;
const MIN_START_GAP_MS = 350;
let lastExtractStart = 0;
let startChain: Promise<void> = Promise.resolve();

async function paceExtract() {
  const run = startChain.then(async () => {
    const now = Date.now();
    const wait = MIN_START_GAP_MS - (now - lastExtractStart);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastExtractStart = Date.now();
  });
  startChain = run.catch(() => {});
  await run;
}

export async function mapWithConcurrency<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  concurrency = EXTRACT_CONCURRENCY,
): Promise<void> {
  let next = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        await worker(items[i], i);
      }
    },
  );
  await Promise.all(runners);
}

// Queue one failure for later retry. Exported for loops that fetch
// messages themselves (batched manual scan).
export async function queueFailure(
  ctx: any,
  userId: string,
  conn: ConnRef,
  gmailMessageId: string,
  errorKind: "fetch" | "extract" | "weak",
  lastError: string,
  counters: ScanCounters,
) {
  counters.failed++;
  try {
    await ctx.runMutation(internal.gmailRetries.enqueueFailure, {
      userId,
      connId: conn._id,
      gmailMessageId,
      errorKind,
      lastError: lastError.slice(0, 300),
    });
  } catch (e) {
    console.error("enqueueFailure failed", conn._id, String(e).slice(0, 200));
  }
}

// Process one already-fetched message. Transient extraction errors and
// low-confidence AI results go to the retry queue instead of being dropped;
// anything that resolves successfully clears its queue row.
export async function handleFetchedMessage(
  ctx: any,
  userId: string,
  conn: ConnRef,
  msg: FetchedMsg,
  counters: ScanCounters,
): Promise<void> {
  counters.scanned++;
  // Dedup before LLM: re-scans must not re-extract seen mails.
  // persist stores gmail:${id} as svixId, so one indexed check skips the
  // ~1-60s LLM call entirely. Suppressed/deleted stays suppressed.
  try {
    const seen = await ctx.runQuery(internal.ingestion.persist.checkSvixId, {
      svixId: `gmail:${msg.id}`,
    });
    if (seen) {
      counters.duplicate++;
      try {
        await ctx.runMutation(internal.gmailRetries.resolveForMessage, {
          connId: conn._id,
          gmailMessageId: msg.id,
        });
      } catch {}
      return;
    }
  } catch {}
  await paceExtract();
  try {
    const r = await processOneEmail(
      ctx,
      userId,
      msg.subject,
      msg.text,
      msg.html,
      msg.id,
      conn.accountEmail,
      conn._id,
      msg.from,
    );
    if (r.status === "created") counters.created++;
    else if (r.status === "merged") counters.merged++;
    else if (r.status === "skipped") counters.skipped++;
    else if (r.status === "duplicate") counters.duplicate++;
    else if (r.status === "cancelled") counters.cancelled++;
    else if (r.status === "unparsed") {
      // Low-confidence AI result — worth a short-leash retry, not a drop.
      counters.unparsed++;
      await queueFailure(ctx, userId, conn, msg.id, "weak", "ai_unparsed", counters);
      return;
    }
    try {
      await ctx.runMutation(internal.gmailRetries.resolveForMessage, {
        connId: conn._id,
        gmailMessageId: msg.id,
      });
    } catch {}
  } catch (e: any) {
    counters.unparsed++;
    await queueFailure(
      ctx,
      userId,
      conn,
      msg.id,
      "extract",
      String(e?.message ?? e),
      counters,
    );
  }
}

// Fetch one message by Gmail id, then process it. A fetch that fails goes
// to the retry queue — the cursor must still advance past it.
export async function fetchAndHandle(
  ctx: any,
  userId: string,
  conn: ConnRef,
  accessToken: string,
  gmailId: string,
  counters: ScanCounters,
): Promise<void> {
  let msg: any = null;
  try {
    msg = await getMessage(accessToken, gmailId);
  } catch (e: any) {
    await queueFailure(
      ctx,
      userId,
      conn,
      gmailId,
      "fetch",
      String(e?.message ?? e),
      counters,
    );
    return;
  }
  if (!msg) {
    await queueFailure(ctx, userId, conn, gmailId, "fetch", "empty_response", counters);
    return;
  }
  await handleFetchedMessage(ctx, userId, conn, msg, counters);
}

// Reprocess due retry-queue rows for one connection (live mail first —
// callers run this after their live batch). Returns rows still failing.
export async function runDueRetries(
  ctx: any,
  userId: string,
  conn: ConnRef,
  accessToken: string,
  budget: number,
  counters: ScanCounters,
): Promise<void> {
  if (budget <= 0) return;
  let due: any[] = [];
  try {
    due = await ctx.runQuery(internal.gmailRetries.getDue, {
      connId: conn._id,
      limit: budget,
    });
  } catch (e) {
    console.error("getDue failed", conn._id, String(e).slice(0, 200));
    return;
  }
  await mapWithConcurrency(due, (row) =>
    fetchAndHandle(ctx, userId, conn, accessToken, row.gmailMessageId, counters),
  );
}
