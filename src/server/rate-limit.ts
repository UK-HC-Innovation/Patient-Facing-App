/**
 * A sliding-window counter held in this process's memory.
 *
 * Honest about what it is: one process, one map. A Vercel lambda that cold-starts, or a
 * second Azure replica, begins with an empty window, so a determined caller who hops
 * instances gets a fresh allowance. It is a spend ceiling for the single warm container we
 * actually run, not a distributed limit, and nothing here should be described as one.
 *
 * The window is a list of hit timestamps rather than a fixed bucket with a reset time, so
 * "10 in the last 10 minutes" means exactly that at every instant, with no burst at the
 * boundary.
 */

/** Buckets stop growing here. Enough for a demo day, small enough to bound memory. */
export const RATE_LIMIT_MAX_KEYS = 4_096;

export type RateLimitDecision = {
  allowed: boolean;
  /** Milliseconds until the oldest hit falls out of the window. 0 when allowed. */
  retryAfterMs: number;
};

const windows = new Map<string, number[]>();

function prune(hits: number[], cutoff: number): number[] {
  let first = 0;
  while (first < hits.length && hits[first] <= cutoff) first += 1;
  return first === 0 ? hits : hits.slice(first);
}

/**
 * Records one hit against `bucket:key` and says whether it is within `limit` per `windowMs`.
 */
export function allowWithinWindow(
  bucket: string,
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now()
): RateLimitDecision {
  const mapKey = `${bucket}:${key}`;
  const cutoff = nowMs - windowMs;
  const hits = prune(windows.get(mapKey) ?? [], cutoff);

  if (hits.length >= limit) {
    windows.set(mapKey, hits);
    return { allowed: false, retryAfterMs: Math.max(1, hits[0] + windowMs - nowMs) };
  }

  if (!windows.has(mapKey) && windows.size >= RATE_LIMIT_MAX_KEYS) {
    for (const [candidate, recorded] of windows) {
      if (prune(recorded, cutoff).length === 0) windows.delete(candidate);
    }
    // Never evict a live window to make room for a new key: that would let a flood of
    // fresh keys buy an attacker a clean slate at an honest caller's expense.
    if (windows.size >= RATE_LIMIT_MAX_KEYS) {
      return { allowed: false, retryAfterMs: windowMs };
    }
  }

  hits.push(nowMs);
  windows.set(mapKey, hits);
  return { allowed: true, retryAfterMs: 0 };
}

export function resetRateLimitsForTest(): void {
  windows.clear();
}
