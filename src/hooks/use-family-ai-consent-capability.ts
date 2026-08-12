"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FAMILY_AI_DISCLOSURE_VERSION } from "@/domain/family-ai-consent";

type ConsentCapabilityState = {
  capability: string | null;
  error: boolean;
  pending: boolean;
};

export type FamilyAiConsentCapabilityController = ConsentCapabilityState & {
  grant: () => Promise<string | null>;
  revoke: () => void;
};

function validPayload(value: unknown): value is { capability: string; expiresAt: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "capability" in value &&
    typeof value.capability === "string" &&
    value.capability.length > 0 &&
    "expiresAt" in value &&
    typeof value.expiresAt === "number" &&
    Number.isFinite(value.expiresAt) &&
    value.expiresAt > Date.now()
  );
}

export function useFamilyAiConsentCapability(
  enabled: boolean
): FamilyAiConsentCapabilityController {
  const [state, setState] = useState<ConsentCapabilityState>({
    capability: null,
    error: false,
    pending: false
  });
  const requestRef = useRef<AbortController | null>(null);
  const expiryRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const revoke = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    if (expiryRef.current !== null) window.clearTimeout(expiryRef.current);
    expiryRef.current = null;
    if (mountedRef.current) {
      setState({ capability: null, error: false, pending: false });
    }
  }, []);

  const grant = useCallback(async (): Promise<string | null> => {
    if (!enabled || !mountedRef.current) return null;
    // Treat rapid repeat activation as the same pending choice. The first
    // request remains authoritative; a second consent token is never minted.
    if (requestRef.current !== null) return null;
    const controller = new AbortController();
    requestRef.current = controller;
    setState({ capability: null, error: false, pending: true });
    try {
      const response = await fetch("/api/family/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disclosureVersion: FAMILY_AI_DISCLOSURE_VERSION }),
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok || !validPayload(payload) || controller.signal.aborted) {
        throw new Error("Consent capability unavailable");
      }
      if (!mountedRef.current) return null;
      const delay = Math.max(0, payload.expiresAt - Date.now());
      if (expiryRef.current !== null) window.clearTimeout(expiryRef.current);
      expiryRef.current = window.setTimeout(revoke, delay);
      requestRef.current = null;
      setState({ capability: payload.capability, error: false, pending: false });
      return payload.capability;
    } catch {
      if (!controller.signal.aborted && mountedRef.current) {
        setState({ capability: null, error: true, pending: false });
      }
      return null;
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [enabled, revoke]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) revoke();
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
      if (expiryRef.current !== null) window.clearTimeout(expiryRef.current);
      expiryRef.current = null;
    };
  }, [enabled, revoke]);

  return { ...state, grant, revoke };
}
