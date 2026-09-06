import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A signed per-page nonce for the realtime token route.
 *
 * The critique (N8) found that `POST /api/realtime/token` with an empty body minted a live
 * OpenAI secret from anywhere, and that every failed typed attempt minted another. The
 * nonce is the half of the fix that says "this caller loaded our page": the root layout
 * mints one into the HTML on every request, the client sends it back, the route checks the
 * signature. Nothing is stored server side, so it works the same on Vercel and in the Azure
 * container with no shared cache between them.
 *
 * It is not an identity and it is not a session. A person who scrapes one nonce can reuse
 * it until it expires; the per-IP rate limit is what caps what that is worth.
 */

/** The meta tag the root layout renders. Clients read `content` off it. */
export const REALTIME_NONCE_META_NAME = "realtime-nonce";

/** Preferred way to send the nonce back. The route also accepts a `nonce` body field. */
export const REALTIME_NONCE_HEADER = "x-realtime-nonce";

/**
 * Two hours. A phone can sit on the food door for a long stretch before anyone taps the
 * mic, and a nonce that dies first turns live voice off with no explanation. Spend is
 * capped by the rate limit, not by this number.
 */
export const REALTIME_NONCE_TTL_SECONDS = 2 * 60 * 60;

/**
 * Last resort key. Two processes generate two different ones, so a nonce minted by one
 * instance is refused by the other. That only bites a deployment with no API key and no
 * `REALTIME_NONCE_SECRET`, which is a mock build with the mic already off.
 */
const processLifetimeKey = randomBytes(32);

function signingKey(): Buffer {
  const explicit = process.env.REALTIME_NONCE_SECRET?.trim();
  if (explicit) {
    return createHmac("sha256", explicit).update("realtime-nonce/v1").digest();
  }
  // No new env var required to work across instances: derive from the key the live path
  // already needs. One-way, labelled, and never sent anywhere. Rotating the API key
  // invalidates nonces already in the wild, which costs one page reload.
  const apiKey = process.env.HEALTH_AI_API_KEY?.trim();
  if (apiKey) {
    return createHmac("sha256", apiKey).update("realtime-nonce/v1").digest();
  }
  return processLifetimeKey;
}

function signature(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
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

/** `rt1.<expiry seconds>.<random>.<signature>` */
export function issueRealtimeNonce(nowMs = Date.now()): string {
  const expiresAt = Math.floor(nowMs / 1000) + REALTIME_NONCE_TTL_SECONDS;
  const payload = `rt1.${expiresAt}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${signature(payload)}`;
}

export function validRealtimeNonce(nonce: string | null | undefined, nowMs = Date.now()): boolean {
  if (typeof nonce !== "string" || nonce.length === 0 || nonce.length > 256) return false;
  const parts = nonce.split(".");
  if (parts.length !== 4 || parts[0] !== "rt1") return false;

  const expiresAt = Number(parts[1]);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds) return false;
  // A signed nonce claiming an expiry further out than we ever issue is not one of ours.
  if (expiresAt > nowSeconds + REALTIME_NONCE_TTL_SECONDS) return false;

  return constantTimeEqual(parts[3], signature(parts.slice(0, 3).join(".")));
}
