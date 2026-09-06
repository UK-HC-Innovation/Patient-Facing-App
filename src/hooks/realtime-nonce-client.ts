"use client";

/**
 * Reads the per-page realtime nonce the root layout stamps into the HTML.
 *
 * Deliberately not imported from `@/server/realtime-nonce`: that module pulls
 * `node:crypto` and would follow this into the client bundle. The meta name is a
 * two-word contract, duplicated on purpose.
 */
export const REALTIME_NONCE_META_NAME = "realtime-nonce";

export function readRealtimeNonce(): string {
  if (typeof document === "undefined") {
    return "";
  }
  return (
    document.querySelector(`meta[name="${REALTIME_NONCE_META_NAME}"]`)?.getAttribute("content") ?? ""
  );
}
