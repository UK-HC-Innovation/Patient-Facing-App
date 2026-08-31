import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { FOOD_PACKAGE_DISCLOSURE_VERSION } from "@/domain/package-scan";

export { FOOD_PACKAGE_DISCLOSURE_VERSION };
export const FOOD_PACKAGE_SESSION_COOKIE = "ladder_food_package";
export const FOOD_PACKAGE_SESSION_TTL_SECONDS = 15 * 60;
export const FOOD_PACKAGE_MAX_BODY_BYTES = 4_000_000;
export const FOOD_PACKAGE_SESSION_MAX_BODY_BYTES = 1_024;
export const FOOD_PACKAGE_SESSION_ISSUE_LIMIT = 10;
export const FOOD_PACKAGE_PROVIDER_RATE_LIMIT = 6;
export const FOOD_PACKAGE_RATE_MAX_KEYS = 4_096;
export const FOOD_PACKAGE_MAX_CONCURRENT_REQUESTS = 4;
export const FOOD_PACKAGE_MAX_CONCURRENT_PER_SESSION = 1;

type FoodPackageAuthConfig = {
  inviteCode: string;
  signingSecret: string;
};

export type FoodPackageProviderConfig = {
  apiKey: string;
  model: string;
};

export type FoodPackageServiceStatus = "disabled" | "unconfigured" | "ready";

function authConfig(): FoodPackageAuthConfig | null {
  const inviteCode = process.env.DEMO_PASSCODE?.trim() ?? "";
  const signingSecret = process.env.FOOD_PACKAGE_SESSION_SECRET?.trim() ?? "";
  if (
    inviteCode.length === 0 ||
    Buffer.byteLength(signingSecret, "utf8") < 32
  ) {
    return null;
  }
  return { inviteCode, signingSecret };
}

function configuredProvider(): FoodPackageProviderConfig | null {
  const apiKey = process.env.HEALTH_AI_API_KEY?.trim() ?? "";
  const model = process.env.HEALTH_AI_PACKAGE_MODEL?.trim() ?? "";
  if (process.env.HEALTH_AI_PROVIDER !== "openai" || apiKey.length === 0 || model.length === 0) {
    return null;
  }
  return { apiKey, model };
}

export function foodPackageFeatureEnabled(): boolean {
  return process.env.FOOD_PACKAGE_SCAN_ENABLED === "1";
}

export function foodPackageServiceStatus(): FoodPackageServiceStatus {
  if (!foodPackageFeatureEnabled()) return "disabled";
  return authConfig() !== null && configuredProvider() !== null ? "ready" : "unconfigured";
}

export function foodPackageServiceConfigured(): boolean {
  return foodPackageServiceStatus() === "ready";
}

export function foodPackageProviderConfig(): FoodPackageProviderConfig | null {
  return foodPackageServiceConfigured() ? configuredProvider() : null;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function constantTimeEqual(left: string, right: string): boolean {
  // Hashing first gives timingSafeEqual two fixed-length buffers even when an
  // attacker supplies a credential with the wrong byte length.
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function validFoodPackageInvite(passcode: string): boolean {
  const config = authConfig();
  return config !== null && constantTimeEqual(passcode, config.inviteCode);
}

export function createFoodPackageSessionToken(nowMs = Date.now()): string | null {
  const config = authConfig();
  if (config === null) return null;
  const expiresAt = Math.floor(nowMs / 1_000) + FOOD_PACKAGE_SESSION_TTL_SECONDS;
  const payload = `v2.${FOOD_PACKAGE_DISCLOSURE_VERSION}.${expiresAt}.${randomBytes(18).toString("base64url")}`;
  return `${payload}.${signature(payload, config.signingSecret)}`;
}

function cookieValue(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator).trim() !== FOOD_PACKAGE_SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function foodPackageSessionTokenExpiresAt(
  token: string | undefined,
  nowMs = Date.now()
): number | null {
  const config = authConfig();
  if (config === null || token === undefined || !Number.isFinite(nowMs)) return null;
  const parts = token.split(".");
  if (
    parts.length !== 5 ||
    parts[0] !== "v2" ||
    parts[1] !== FOOD_PACKAGE_DISCLOSURE_VERSION
  ) return null;
  const expiresAtSeconds = Number(parts[2]);
  if (
    !Number.isSafeInteger(expiresAtSeconds) ||
    expiresAtSeconds <= Math.floor(nowMs / 1_000)
  ) {
    return null;
  }
  const payload = parts.slice(0, 4).join(".");
  return constantTimeEqual(parts[4], signature(payload, config.signingSecret))
    ? expiresAtSeconds * 1_000
    : null;
}

export function validFoodPackageSessionToken(
  token: string | undefined,
  nowMs = Date.now()
): boolean {
  return foodPackageSessionTokenExpiresAt(token, nowMs) !== null;
}

export function isSameOriginFoodPackageRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function foodPackageSessionExpiresAt(
  request: Request,
  nowMs = Date.now()
): number | null {
  if (!foodPackageServiceConfigured() || !isSameOriginFoodPackageRequest(request)) return null;
  return foodPackageSessionTokenExpiresAt(cookieValue(request), nowMs);
}

export function authorizeFoodPackageRequest(request: Request, nowMs = Date.now()): boolean {
  return foodPackageSessionExpiresAt(request, nowMs) !== null;
}

function foodPackageSessionIdentifier(request: Request, nowMs: number): string | null {
  const config = authConfig();
  const token = cookieValue(request);
  if (
    config === null ||
    token === undefined ||
    foodPackageSessionTokenExpiresAt(token, nowMs) === null
  ) {
    return null;
  }
  return signature(token, config.signingSecret).slice(0, 24);
}

export function foodPackageSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${FOOD_PACKAGE_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/api/food/package; HttpOnly; SameSite=Strict; Max-Age=${FOOD_PACKAGE_SESSION_TTL_SECONDS}${secure}`;
}

export type BoundedFoodPackageJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415 };

export async function readBoundedFoodPackageJson(
  request: Request,
  maxBytes = FOOD_PACKAGE_MAX_BODY_BYTES
): Promise<BoundedFoodPackageJsonResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return { ok: false, status: 415 };
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return { ok: false, status: 413 };

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      return { ok: false, status: 400 };
    }
    if (declaredLength > maxBytes) return { ok: false, status: 413 };
  }
  if (request.body === null) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The byte cap has already decided the result. A failed cancellation
          // must not turn an over-limit request into a different response.
        }
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

function requestSourceIdentifier(request: Request): string | null {
  const config = authConfig();
  if (config === null) return null;
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0].trim();
  // Vercel overwrites this header at the edge. A deployment without that trusted
  // address deliberately shares one conservative issuance bucket.
  const source = forwarded && isIP(forwarded) !== 0 ? forwarded : "unknown-source";
  return signature(source, config.signingSecret).slice(0, 24);
}

function allowRateWindow(args: {
  scope: RateScope;
  key: string | null;
  nowMs: number;
  limit: number;
  windowMs: number;
}): boolean {
  if (
    args.key === null ||
    !Number.isFinite(args.nowMs) ||
    !Number.isSafeInteger(args.limit) ||
    args.limit < 1 ||
    !Number.isSafeInteger(args.windowMs) ||
    args.windowMs < 1
  ) {
    return false;
  }

  const windows = rateWindows[args.scope];
  const current = windows.get(args.key);
  if (current && args.nowMs < current.expiresAt) {
    if (current.count >= args.limit) return false;
    current.count += 1;
    return true;
  }
  if (current) windows.delete(args.key);

  if (windows.size >= FOOD_PACKAGE_RATE_MAX_KEYS) {
    for (const [candidate, window] of windows) {
      if (args.nowMs >= window.expiresAt) windows.delete(candidate);
    }
    // Do not evict a live bucket to admit an attacker-controlled new key.
    if (windows.size >= FOOD_PACKAGE_RATE_MAX_KEYS) return false;
  }

  windows.set(args.key, { expiresAt: args.nowMs + args.windowMs, count: 1 });
  return true;
}

export function allowFoodPackageSessionIssuance(
  request: Request,
  nowMs = Date.now(),
  limit = FOOD_PACKAGE_SESSION_ISSUE_LIMIT,
  windowMs = 60_000
): boolean {
  if (!foodPackageServiceConfigured()) return false;
  return allowRateWindow({
    scope: "issue",
    key: requestSourceIdentifier(request),
    nowMs,
    limit,
    windowMs
  });
}

export function allowFoodPackageProviderRequest(
  request: Request,
  nowMs = Date.now(),
  limit = FOOD_PACKAGE_PROVIDER_RATE_LIMIT,
  windowMs = 60_000
): boolean {
  if (!authorizeFoodPackageRequest(request, nowMs)) return false;
  return allowRateWindow({
    scope: "provider",
    key: foodPackageSessionIdentifier(request, nowMs),
    nowMs,
    limit,
    windowMs
  });
}

export type FoodPackageConcurrencyLease = {
  release: () => void;
};

let activeLeaseCount = 0;
const activeSessionLeases = new Map<string, number>();

export function acquireFoodPackageConcurrencyLease(
  request: Request,
  nowMs = Date.now(),
  maxConcurrent = FOOD_PACKAGE_MAX_CONCURRENT_REQUESTS,
  maxPerSession = FOOD_PACKAGE_MAX_CONCURRENT_PER_SESSION
): FoodPackageConcurrencyLease | null {
  if (
    !authorizeFoodPackageRequest(request, nowMs) ||
    !Number.isSafeInteger(maxConcurrent) ||
    maxConcurrent < 1 ||
    !Number.isSafeInteger(maxPerSession) ||
    maxPerSession < 1 ||
    activeLeaseCount >= maxConcurrent
  ) {
    return null;
  }

  const session = foodPackageSessionIdentifier(request, nowMs);
  if (session === null) return null;
  const activeForSession = activeSessionLeases.get(session) ?? 0;
  if (activeForSession >= maxPerSession) return null;
  if (
    activeForSession === 0 &&
    activeSessionLeases.size >= FOOD_PACKAGE_RATE_MAX_KEYS
  ) {
    return null;
  }

  activeLeaseCount += 1;
  activeSessionLeases.set(session, activeForSession + 1);
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      activeLeaseCount = Math.max(0, activeLeaseCount - 1);
      const remaining = (activeSessionLeases.get(session) ?? 1) - 1;
      if (remaining <= 0) activeSessionLeases.delete(session);
      else activeSessionLeases.set(session, remaining);
    }
  };
}

export function resetFoodPackageAuthStateForTest(): void {
  rateWindows.issue.clear();
  rateWindows.provider.clear();
  activeLeaseCount = 0;
  activeSessionLeases.clear();
}
