import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import {
  FAMILY_AI_DISCLOSURE_VERSION,
  FAMILY_AI_CONSENT_HEADER,
  type FamilyAiEgressPurpose
} from "@/domain/family-ai-consent";

export { FAMILY_AI_CONSENT_HEADER } from "@/domain/family-ai-consent";

export const FAMILY_AI_SESSION_COOKIE = "ladder_family_ai";
export const FAMILY_AI_SESSION_TTL_SECONDS = 30 * 60;
export const FAMILY_AI_MAX_BODY_BYTES = 32 * 1024;
export const FAMILY_AI_SESSION_ISSUE_LIMIT = 10;
export const FAMILY_AI_RATE_MAX_KEYS = 4_096;

type FamilyAiAuthConfig = {
  inviteCode: string;
  signingSecret: string;
};

function authConfig(): FamilyAiAuthConfig | null {
  const inviteCode = process.env.DEMO_PASSCODE?.trim() ?? "";
  const signingSecret = process.env.FAMILY_AI_SESSION_SECRET?.trim() ?? "";
  if (inviteCode.length === 0 || signingSecret.length < 32) return null;
  return { inviteCode, signingSecret };
}

export function familyAiServiceConfigured(): boolean {
  return (
    process.env.HEALTH_AI_PROVIDER === "openai" &&
    (process.env.HEALTH_AI_API_KEY?.trim().length ?? 0) > 0 &&
    authConfig() !== null
  );
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) {
    timingSafeEqual(leftBytes, leftBytes);
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}

export function validFamilyAiInvite(code: string): boolean {
  const config = authConfig();
  return config !== null && constantTimeEqual(code, config.inviteCode);
}

export function createFamilyAiSessionToken(nowMs = Date.now()): string | null {
  const config = authConfig();
  if (config === null) return null;
  const expiresAt = Math.floor(nowMs / 1000) + FAMILY_AI_SESSION_TTL_SECONDS;
  const payload = `v1.${expiresAt}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${signature(payload, config.signingSecret)}`;
}

function cookieValue(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== FAMILY_AI_SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function familyAiSessionTokenExpiresAt(
  token: string | undefined,
  nowMs = Date.now()
): number | null {
  const config = authConfig();
  if (config === null || token === undefined) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(nowMs / 1000)) return null;
  const payload = parts.slice(0, 3).join(".");
  return constantTimeEqual(parts[3], signature(payload, config.signingSecret))
    ? expiresAt * 1_000
    : null;
}

export function validFamilyAiSessionToken(token: string | undefined, nowMs = Date.now()): boolean {
  return familyAiSessionTokenExpiresAt(token, nowMs) !== null;
}

export function isSameOriginFamilyAiRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function authorizeFamilyAiRequest(request: Request, nowMs = Date.now()): boolean {
  return isSameOriginFamilyAiRequest(request) && validFamilyAiSessionToken(cookieValue(request), nowMs);
}

export function familyAiSessionExpiresAt(request: Request, nowMs = Date.now()): number | null {
  if (!isSameOriginFamilyAiRequest(request)) return null;
  return familyAiSessionTokenExpiresAt(cookieValue(request), nowMs);
}

export function familyAiSessionIdentifier(request: Request): string {
  const config = authConfig();
  const token = cookieValue(request) ?? "missing";
  return config === null ? "unconfigured" : signature(token, config.signingSecret).slice(0, 24);
}

type FamilyAiConsentClaims = {
  exp: number;
  nonce: string;
  purposes: FamilyAiEgressPurpose[];
  session: string;
  version: string;
};

function consentClaims(token: string | null): FamilyAiConsentClaims | null {
  const config = authConfig();
  if (config === null || token === null) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "c1") return null;
  const payload = `${parts[0]}.${parts[1]}`;
  if (!constantTimeEqual(parts[2], signature(payload, config.signingSecret))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<FamilyAiConsentClaims>;
    if (
      !Number.isSafeInteger(candidate.exp) ||
      typeof candidate.nonce !== "string" ||
      candidate.nonce.length < 16 ||
      typeof candidate.session !== "string" ||
      typeof candidate.version !== "string" ||
      !Array.isArray(candidate.purposes) ||
      candidate.purposes.some((purpose) => purpose !== "interview" && purpose !== "recommend")
    ) {
      return null;
    }
    return candidate as FamilyAiConsentClaims;
  } catch {
    return null;
  }
}

export function createFamilyAiConsentCapability(
  request: Request,
  disclosureVersion = FAMILY_AI_DISCLOSURE_VERSION,
  nowMs = Date.now(),
  purposes: readonly FamilyAiEgressPurpose[] = ["interview", "recommend"]
): string | null {
  const config = authConfig();
  const sessionExpiresAt = familyAiSessionExpiresAt(request, nowMs);
  if (
    config === null ||
    sessionExpiresAt === null ||
    disclosureVersion !== FAMILY_AI_DISCLOSURE_VERSION ||
    purposes.length === 0 ||
    purposes.some((purpose) => purpose !== "interview" && purpose !== "recommend")
  ) {
    return null;
  }
  const claims: FamilyAiConsentClaims = {
    exp: Math.floor(sessionExpiresAt / 1000),
    nonce: randomBytes(18).toString("base64url"),
    purposes: [...new Set(purposes)],
    session: familyAiSessionIdentifier(request),
    version: disclosureVersion
  };
  const encoded = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const payload = `c1.${encoded}`;
  return `${payload}.${signature(payload, config.signingSecret)}`;
}

export function familyAiConsentCapabilityExpiresAt(
  request: Request,
  capability = request.headers.get(FAMILY_AI_CONSENT_HEADER),
  nowMs = Date.now()
): number | null {
  if (!authorizeFamilyAiRequest(request, nowMs)) return null;
  const claims = consentClaims(capability);
  if (
    claims === null ||
    claims.version !== FAMILY_AI_DISCLOSURE_VERSION ||
    claims.session !== familyAiSessionIdentifier(request) ||
    claims.exp <= Math.floor(nowMs / 1000)
  ) {
    return null;
  }
  const sessionExpiresAt = familyAiSessionExpiresAt(request, nowMs);
  const capabilityExpiresAt = claims.exp * 1_000;
  return sessionExpiresAt !== null && capabilityExpiresAt <= sessionExpiresAt
    ? capabilityExpiresAt
    : null;
}

export function authorizeFamilyAiConsent(
  request: Request,
  purpose: FamilyAiEgressPurpose,
  nowMs = Date.now()
): boolean {
  const claims = consentClaims(request.headers.get(FAMILY_AI_CONSENT_HEADER));
  return (
    claims !== null &&
    claims.purposes.includes(purpose) &&
    familyAiConsentCapabilityExpiresAt(
      request,
      request.headers.get(FAMILY_AI_CONSENT_HEADER),
      nowMs
    ) !== null
  );
}

export function familyAiSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${FAMILY_AI_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/api/family; HttpOnly; SameSite=Strict; Max-Age=${FAMILY_AI_SESSION_TTL_SECONDS}${secure}`;
}

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415 };

export async function readBoundedFamilyJson(
  request: Request,
  maxBytes = FAMILY_AI_MAX_BODY_BYTES
): Promise<BoundedJsonResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return { ok: false, status: 415 };
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413 };
  }
  if (request.body === null) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

type RateWindow = { expiresAt: number; count: number };
type RateScope = "issue" | "provider";
const rateWindows: Record<RateScope, Map<string, RateWindow>> = {
  issue: new Map(),
  provider: new Map()
};

function familyAiRequestSourceIdentifier(request: Request): string {
  const config = authConfig();
  if (config === null) return "unconfigured";
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0].trim();
  // Vercel overwrites this header at the edge. Self-hosted deployments that do
  // not provide a trusted address deliberately share one conservative bucket.
  const source = forwarded && isIP(forwarded) !== 0 ? forwarded : "unknown-source";
  return signature(source, config.signingSecret).slice(0, 24);
}

function allowRateWindow(
  scope: RateScope,
  request: Request,
  nowMs: number,
  limit: number,
  windowMs: number
): boolean {
  const windows = rateWindows[scope];
  const key = familyAiRequestSourceIdentifier(request);
  const current = windows.get(key);
  if (current && nowMs < current.expiresAt) {
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  }
  if (current) windows.delete(key);

  if (windows.size >= FAMILY_AI_RATE_MAX_KEYS) {
    for (const [candidate, window] of windows) {
      if (nowMs >= window.expiresAt) windows.delete(candidate);
    }
    // Never evict an active bucket to admit an attacker-controlled new key.
    if (windows.size >= FAMILY_AI_RATE_MAX_KEYS) return false;
  }

  windows.set(key, { expiresAt: nowMs + windowMs, count: 1 });
  return true;
}

export function allowFamilyAiSessionIssuance(
  request: Request,
  nowMs = Date.now(),
  limit = FAMILY_AI_SESSION_ISSUE_LIMIT,
  windowMs = 60_000
): boolean {
  return allowRateWindow("issue", request, nowMs, limit, windowMs);
}

export function allowFamilyAiRequest(
  request: Request,
  nowMs = Date.now(),
  limit = 20,
  windowMs = 60_000
): boolean {
  return allowRateWindow("provider", request, nowMs, limit, windowMs);
}

export function resetFamilyAiRateLimitsForTest(): void {
  rateWindows.issue.clear();
  rateWindows.provider.clear();
}
