import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import { allowWithinWindow } from "@/server/rate-limit";
import { REALTIME_NONCE_HEADER, validRealtimeNonce } from "@/server/realtime-nonce";

export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gpt-realtime-2";
const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";

/** Ten mints per ten minutes per address, per the spend gate in spec 29 P7. */
const MINT_LIMIT = 10;
const MINT_WINDOW_MS = 10 * 60 * 1000;
/**
 * A probe spends nothing: it reports whether this build can go live and returns. It still
 * gets a ceiling so the route is never an unbounded free endpoint, but a ceiling no real
 * phone reaches. Sharing the mint window would have meant ten page loads turning voice off.
 */
const PROBE_LIMIT = 120;

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

const NO_STORE = { "Cache-Control": "no-store" } as const;

type TokenRequestBody = {
  patientId?: string;
  crisisOpen?: boolean;
  passcode?: string;
  probe?: boolean;
  nonce?: string;
};

async function readBody(request: Request): Promise<TokenRequestBody> {
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as TokenRequestBody;
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

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request);

  // Attestation gate: the server cannot see localStorage, so the client attests
  // whether an unacknowledged crisis is open. Routine voice cannot start while it
  // is — documented as an attestation, not a server-verified guarantee. It runs before the
  // spend gates because it is a safety answer, not a spend answer.
  if (body.crisisOpen === true) {
    return Response.json({ mode: "blocked", reason: "open_red_flag" }, { status: 409 });
  }

  if (!originAllowed(request)) {
    return Response.json(
      { mode: "error", message: "origin_not_allowed" },
      { status: 403, headers: NO_STORE }
    );
  }

  const probe = body.probe === true;

  if (!probe && !validRealtimeNonce(request.headers.get(REALTIME_NONCE_HEADER) ?? body.nonce)) {
    return Response.json(
      { mode: "error", message: "nonce_required" },
      { status: 401, headers: NO_STORE }
    );
  }

  const limit = allowWithinWindow(
    probe ? "realtime-probe" : "realtime-mint",
    requestAddress(request),
    probe ? PROBE_LIMIT : MINT_LIMIT,
    MINT_WINDOW_MS
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

  const provider = process.env.HEALTH_AI_PROVIDER;
  const apiKey = process.env.HEALTH_AI_API_KEY;
  const model = process.env.HEALTH_AI_REALTIME_MODEL || DEFAULT_MODEL;

  if (provider !== "openai") {
    return Response.json({ mode: "mock", reason: "provider_mock" });
  }
  if (!apiKey) {
    return Response.json({ mode: "mock", reason: "no_api_key" });
  }

  // Demo cost gate: on a public deployment, only mint a real OpenAI session when
  // the request carries the shared passcode. Without it, fall back to mock (typed)
  // so a stray visitor cannot spend credits. Skipped entirely when DEMO_PASSCODE is unset.
  const requiredPasscode = process.env.DEMO_PASSCODE;
  if (requiredPasscode && body.passcode !== requiredPasscode) {
    return Response.json({ mode: "mock", reason: "locked" });
  }

  if (probe) {
    return Response.json({ mode: "live", model });
  }

  try {
    const upstream = await fetch(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": buildVoiceSafetyIdentifier(body.patientId ?? "anonymous")
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          audio: { output: { voice: "marin" } }
        }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      return Response.json({ mode: "error", message: "token_request_failed" }, { status: 502 });
    }

    const data = (await upstream.json()) as { value?: string; expires_at?: number };
    if (!data.value) {
      return Response.json({ mode: "error", message: "no_client_secret" }, { status: 502 });
    }

    // The body carries a short-lived client secret, so it gets at least the same
    // no-store treatment the coach and vision text responses already have.
    return Response.json(
      { mode: "live", clientSecret: data.value, model, expiresAt: data.expires_at ?? null },
      { headers: NO_STORE }
    );
  } catch {
    return Response.json({ mode: "error", message: "token_request_error" }, { status: 502 });
  }
}
