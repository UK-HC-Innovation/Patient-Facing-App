import type { RouteDecision } from "@/domain/route-classifier";

// Best-effort client call to the constrained LLM router. It is only ever reached
// after the deterministic safety gate has already cleared the utterance, and it
// fails closed to `coach` on any error, timeout, or missing model — so the
// composer degrades to the Coach rather than blocking on the network. Safety
// never depends on this call.
export async function classifyRouteRemote(utterance: string, allowedHrefs: readonly string[]): Promise<RouteDecision> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 4500) : null;
  const passcode =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("k") ?? undefined
      : undefined;
  try {
    const response = await fetch("/api/route/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utterance, allowedHrefs, passcode }),
      signal: controller?.signal
    });
    if (!response.ok) {
      return { kind: "coach", confidence: 0 };
    }
    const data = (await response.json()) as RouteDecision;
    return data;
  } catch {
    return { kind: "coach", confidence: 0 };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
