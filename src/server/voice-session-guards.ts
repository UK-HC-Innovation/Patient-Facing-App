import { allowWithinWindow } from "@/server/rate-limit";
import { REALTIME_NONCE_HEADER, validRealtimeNonce } from "@/server/realtime-nonce";

/**
 * The checks a route runs before it starts a paid voice session.
 *
 * Split out of the realtime token route when GPT-Live got a session route of its own, so the
 * two cannot drift apart: one spend window per address covers both, and the order below is
 * the order both run.
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Ten mints per ten minutes per address, per the spend gate in spec 29 P7. */
const MINT_LIMIT = 10;
const WINDOW_MS = 10 * 60 * 1000;
/**
 * A probe spends nothing: it reports whether this build can go live and returns. It still
 * gets a ceiling so the route is never an unbounded free endpoint, but a ceiling no real
 * phone reaches. Sharing the mint window would have meant ten page loads turning voice off.
 */
const PROBE_LIMIT = 120;

/** A browser's SDP offer is a few kilobytes. Nothing a voice route accepts comes near this. */
const MAX_BODY_CHARS = 128 * 1024;

/**
 * Hosts allowed to be the `Origin` of a token request. A same-origin request is admitted by
 * matching the request's own Host header, which covers the Azure FQDN and Vercel previews
 * without anyone editing this list. Add more with `REALTIME_ALLOWED_ORIGINS`, comma
 * separated, hostnames only.
 */
const DEFAULT_ALLOWED_ORIGIN_HOSTS = [
  "localhost",
  "127.0.0.1",
  "[::1]",
  "patient-centered.vercel.app"
];

/** An unreadable, oversized or non-object body reads as empty, which the checks then refuse. */
export async function readVoiceBody<T extends object>(request: Request): Promise<Partial<T>> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_CHARS) {
    return {};
  }
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) {
      return {};
    }
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Partial<T>;
    }
  } catch {
    // no body / invalid JSON — treated as an empty attestation
  }
  return {};
}

function firstHeaderValue(request: Request, name: string): string | null {
  const raw = request.headers.get(name);
  if (!raw) return null;
  const value = raw.split(",", 1)[0].trim();
  return value.length > 0 ? value : null;
}

function allowedOriginHosts(): Set<string> {
  const configured = (process.env.REALTIME_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
  const vercel = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
    .map((host) => host?.trim().toLowerCase() ?? "")
    .filter((host) => host.length > 0);
  return new Set([...DEFAULT_ALLOWED_ORIGIN_HOSTS, ...configured, ...vercel]);
}

/**
 * Browsers send `Origin` on every cross-site POST and on same-origin POSTs too, so a page on
 * someone else's domain cannot hide. They omit it on same-origin GETs, and curl and the
 * Azure smoke script omit it entirely, so a missing `Origin` is not treated as an attack:
 * this check exists to stop a browser on another site, and the nonce is what stops a script.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  // An opaque origin is a sandboxed frame or a file:// page. Neither is one of our doors.
  if (origin === "null") return false;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const host = parsed.host.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  if (hostname.length === 0) return false;

  try {
    if (parsed.origin === new URL(request.url).origin) return true;
  } catch {
    // fall through to the host comparison below
  }

  const self = (
    firstHeaderValue(request, "x-forwarded-host") ?? firstHeaderValue(request, "host")
  )?.toLowerCase();
  if (self && host === self) return true;

  return allowedOriginHosts().has(hostname);
}

/**
 * Best available caller address. Vercel rewrites `x-vercel-forwarded-for` at the edge and
 * Azure Container Apps ingress sets `x-forwarded-for`; neither is trustworthy without a
 * proxy in front, so this buckets rather than authorises. Requests with no address share
 * one conservative bucket instead of each getting a private allowance.
 */
function requestAddress(request: Request): string {
  return (
    firstHeaderValue(request, "x-vercel-forwarded-for") ??
    firstHeaderValue(request, "x-forwarded-for") ??
    firstHeaderValue(request, "x-real-ip") ??
    "unknown-source"
  );
}

export type VoiceGuard = {
  /** The client's attestation that an unacknowledged crisis is on screen. */
  crisisOpen: boolean;
  /** A request that can lead to spend must prove it came from our page. A probe cannot. */
  requireNonce: boolean;
  /** Only a request that can start a paid session draws on the mint window. */
  bucket: "mint" | "probe";
  /** The nonce from the body, for callers that cannot set the header. */
  nonce: unknown;
};

/**
 * Crisis first, because it is a safety answer and not a spend answer. Then the spend gates in
 * order: the origin stops a browser on another site, the nonce stops a script that never
 * loaded our page, and the window caps what either is worth. Null means carry on.
 */
export function refuseVoiceRequest(request: Request, guard: VoiceGuard): Response | null {
  // Attestation gate: the server cannot see localStorage, so the client attests
  // whether an unacknowledged crisis is open. Routine voice cannot start while it
  // is — documented as an attestation, not a server-verified guarantee.
  if (guard.crisisOpen) {
    return Response.json({ mode: "blocked", reason: "open_red_flag" }, { status: 409 });
  }

  if (!originAllowed(request)) {
    return Response.json(
      { mode: "error", message: "origin_not_allowed" },
      { status: 403, headers: NO_STORE }
    );
  }

  if (guard.requireNonce) {
    const nonce =
      request.headers.get(REALTIME_NONCE_HEADER) ?? (typeof guard.nonce === "string" ? guard.nonce : null);
    if (!validRealtimeNonce(nonce)) {
      return Response.json(
        { mode: "error", message: "nonce_required" },
        { status: 401, headers: NO_STORE }
      );
    }
  }

  const mint = guard.bucket === "mint";
  const limit = allowWithinWindow(
    mint ? "realtime-mint" : "realtime-probe",
    requestAddress(request),
    mint ? MINT_LIMIT : PROBE_LIMIT,
    WINDOW_MS
  );
  if (!limit.allowed) {
    return Response.json(
      { mode: "error", message: "rate_limited" },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) }
      }
    );
  }

  return null;
}

export type VoiceProvider =
  | { kind: "ready"; apiKey: string }
  | { kind: "mock"; reason: "provider_mock" | "no_api_key" | "locked" };

/** Whether this build may spend at all. Every "no" answers mock, so typing keeps working. */
export function voiceProvider(passcode: unknown): VoiceProvider {
  if (process.env.HEALTH_AI_PROVIDER !== "openai") {
    return { kind: "mock", reason: "provider_mock" };
  }
  const apiKey = process.env.HEALTH_AI_API_KEY;
  if (!apiKey) {
    return { kind: "mock", reason: "no_api_key" };
  }
  // Demo cost gate: on a public deployment, only start a real OpenAI session when the
  // request carries the shared passcode. Without it, fall back to mock (typed) so a stray
  // visitor cannot spend credits. Skipped entirely when DEMO_PASSCODE is unset.
  const requiredPasscode = process.env.DEMO_PASSCODE;
  if (requiredPasscode && passcode !== requiredPasscode) {
    return { kind: "mock", reason: "locked" };
  }
  return { kind: "ready", apiKey };
}
