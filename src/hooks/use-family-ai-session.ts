"use client";

import { useEffect, useRef, useState } from "react";

export type FamilyAiCapability = "checking" | "authorized" | "unavailable";
const FAMILY_AI_CLIENT_SESSION_FALLBACK_MS = 30 * 60 * 1_000;

function inviteFromUrl(url: URL): string | undefined {
  const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  return fragment.get("invite") ?? undefined;
}

function removeInviteFromAddressBar(url: URL): void {
  const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  if (fragment.has("invite")) url.hash = "";
  // Old query-string invites can already be present in access logs. Never use
  // them as credentials, but still scrub them so they are not copied onward.
  url.searchParams.delete("k");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function useFamilyAiSession(): FamilyAiCapability {
  const [capability, setCapability] = useState<FamilyAiCapability>("checking");
  // Preserve the one-time credential across React Strict Mode's development
  // setup/cleanup replay after it has been scrubbed from the address bar.
  const inviteRef = useRef<{ value: string | undefined } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let expiryTimer: number | undefined;
    let authorizedUntil = 0;
    let invite: string | undefined;
    // An offline repeat visit always uses the deterministic on-device path.
    // Avoid even an empty authorization request while the browser is offline.
    if (!navigator.onLine) {
      setCapability("unavailable");
      return () => controller.abort();
    }
    if (inviteRef.current === null) {
      const url = new URL(window.location.href);
      invite = inviteFromUrl(url);
      inviteRef.current = { value: invite };
      if (invite !== undefined || url.searchParams.has("k")) removeInviteFromAddressBar(url);
    } else {
      invite = inviteRef.current.value;
    }

    // Strict Mode tears down the first effect pass synchronously. Deferring the
    // request one microtask lets that pass abort before any credential is sent,
    // while the committed pass performs exactly one exchange.
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      try {
        const response = await fetch("/api/family/session", {
          method: invite === undefined ? "GET" : "POST",
          ...(invite === undefined
            ? {}
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ passcode: invite })
              }),
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json()) as unknown;
        const authorized =
          response.ok &&
          typeof payload === "object" &&
          payload !== null &&
          "authorized" in payload &&
          payload.authorized === true;
        const reportedExpiry =
          authorized &&
          "expiresAt" in payload &&
          typeof payload.expiresAt === "number" &&
          Number.isFinite(payload.expiresAt)
            ? payload.expiresAt
            : Date.now() + FAMILY_AI_CLIENT_SESSION_FALLBACK_MS;
        if (!controller.signal.aborted) {
          if (!authorized || reportedExpiry <= Date.now()) {
            authorizedUntil = 0;
            setCapability("unavailable");
          } else {
            authorizedUntil = reportedExpiry;
            setCapability("authorized");
            expiryTimer = window.setTimeout(() => {
              authorizedUntil = 0;
              setCapability("unavailable");
            }, Math.max(0, reportedExpiry - Date.now()));
          }
        }
      } catch {
        if (!controller.signal.aborted) setCapability("unavailable");
      }
    });

    const expireOnResume = (): void => {
      if (authorizedUntil > 0 && Date.now() >= authorizedUntil) {
        authorizedUntil = 0;
        if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
        setCapability("unavailable");
      }
    };
    window.addEventListener("focus", expireOnResume);
    document.addEventListener("visibilitychange", expireOnResume);

    return () => {
      controller.abort();
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      window.removeEventListener("focus", expireOnResume);
      document.removeEventListener("visibilitychange", expireOnResume);
    };
  }, []);

  return capability;
}
