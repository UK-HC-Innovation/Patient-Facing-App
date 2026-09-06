/**
 * The usage sink.
 *
 * Writes one JSON line per event to stdout and nothing else. There is no database here on
 * purpose: both hosts already collect stdout -- Azure Container Apps ships it to the
 * Log Analytics workspace named in `docs/ops/food-lens-azure-hosting-plan.md`, and Vercel
 * keeps it in runtime logs -- so a line written here is queryable without adding a store,
 * a migration or a second thing to keep alive.
 *
 * Three rules the shape of this file follows:
 *
 *  - Fail closed. An invalid batch is rejected whole rather than partially recorded, so a
 *    line that reaches the log has passed the full schema. Recording "most of" a malformed
 *    batch would put unvalidated strings in the log, which is the one outcome the
 *    vocabulary exists to prevent.
 *  - Always answer 204. The client has no retry queue and nothing to do with an error, and
 *    a validation message in the response body would tell an unknown caller how to shape a
 *    payload that lands in the operator's log.
 *  - Log the rejection too. A spike in rejected batches is itself a bug report -- it means
 *    a call site is emitting something the vocabulary does not cover.
 *
 * The envelope is flattened onto every line so a query can filter on session, build or
 * surface without a join.
 */

import { MAX_USAGE_BATCH_BYTES } from "@/domain/usage-event";
import { usageBatchSchema } from "@/domain/usage-event-schema";
import { readBoundedJson } from "@/server/read-bounded-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One stable key so the whole feed is `where log_s == "usage"` and never a text search. */
const LOG_KEY = "usage";

const accepted = new Response(null, {
  status: 204,
  headers: { "cache-control": "no-store" }
});

function emit(line: Record<string, unknown>): void {
  // eslint-disable-next-line no-console -- stdout IS the sink; see the file header.
  console.log(JSON.stringify({ log: LOG_KEY, ...line }));
}

export async function POST(request: Request): Promise<Response> {
  const body = await readBoundedJson(request, MAX_USAGE_BATCH_BYTES);
  if (!body.ok) {
    emit({ event: "batch_rejected", reason: "unreadable" });
    return accepted;
  }

  const parsed = usageBatchSchema.safeParse(body.value);
  if (!parsed.success) {
    // The failing path, never the failing value: the value is what we could not validate.
    emit({
      event: "batch_rejected",
      reason: "schema",
      paths: parsed.error.issues.slice(0, 8).map((issue) => issue.path.join("."))
    });
    return accepted;
  }

  const { events, ...batch } = parsed.data;
  const receivedAt = new Date().toISOString();
  for (const event of events) {
    emit({
      receivedAt,
      session: batch.session,
      surface: batch.surface,
      build: batch.build,
      lang: batch.lang,
      viewport: batch.viewport,
      startedAt: batch.startedAt,
      dropped: batch.dropped,
      ...event
    });
  }

  return accepted;
}
