/**
 * The server half of usage recording.
 *
 * API routes do not need the client's batching -- they are already running on the machine
 * that owns stdout -- so they write a line directly. Same vocabulary and same `log: "usage"`
 * key as `/api/usage`, so `scripts/usage-report.mjs` reads one merged feed and a client
 * event and the server event it caused line up in the same session.
 *
 * Server events carry `session: "server"` rather than a real session id. Correlating a
 * request back to the browser session that made it would mean threading an identifier
 * through every fetch, which is a tracking token by another name; the timestamp and the
 * decision id are enough to line up a client decision with the server one behind it.
 */

import type { UsageEventInput } from "@/domain/usage-event";
import { usageEventSchema } from "@/domain/usage-event-schema";

const LOG_KEY = "usage";
const SERVER_SESSION = "server";

let seq = 0;

/**
 * Validated before it is written, exactly like the client sink. A call site that outgrows
 * the vocabulary should fail loudly in the log rather than quietly widen what can be
 * recorded, so an invalid event becomes a rejection line and never the event itself.
 */
export function recordServerUsage(event: UsageEventInput): void {
  try {
    const candidate = { ...event, seq: seq++, at: 0 };
    const parsed = usageEventSchema.safeParse(candidate);
    const line = parsed.success
      ? { ...parsed.data }
      : {
          event: "server_event_rejected",
          reason: "schema",
          paths: parsed.error.issues.slice(0, 8).map((issue) => issue.path.join("."))
        };

    // eslint-disable-next-line no-console -- stdout IS the sink; see src/app/api/usage/route.ts.
    console.log(
      JSON.stringify({
        log: LOG_KEY,
        receivedAt: new Date().toISOString(),
        session: SERVER_SESSION,
        build: (process.env.NEXT_PUBLIC_BUILD_ID ?? "dev").toLowerCase(),
        ...line
      })
    );
  } catch {
    // A telemetry failure must never become a failed request.
  }
}

/** Test seam. Not called by the app. */
export function __resetServerUsageForTests(): void {
  seq = 0;
}
