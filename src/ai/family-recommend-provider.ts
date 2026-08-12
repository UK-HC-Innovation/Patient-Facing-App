import { z } from "zod";
import { parseFamilyRankPayload, type FamilyRankResult } from "@/domain/family-rank";
import type { FamilyProfile } from "@/domain/types";
import { FAMILY_AI_CONSENT_HEADER } from "@/domain/family-ai-consent";
import type { Language } from "@/i18n/strings";

export type FamilyRecommendRequest = {
  text: string;
  profile: FamilyProfile;
  language: Language;
  candidateIds: string[];
};

export type FamilyRecommendRequestOptions = {
  /** Memory-only capability minted after the current disclosure is accepted. */
  consentCapability?: string;
  /** Cancels work that is no longer relevant to the mounted Ladder view. */
  signal?: AbortSignal;
};

const routeEnvelopeSchema = z
  .object({
    mode: z.literal("success"),
    data: z.unknown()
  })
  .strict();

/**
 * Every failure class — unconfigured, locked, timeout, off-shape reply — collapses
 * to null so the caller lands on the deterministic ranker instead of an error.
 */
export async function requestFamilyRecommendations(
  request: FamilyRecommendRequest,
  options: FamilyRecommendRequestOptions = {}
): Promise<FamilyRankResult | null> {
  if (request.candidateIds.length === 0 || !options.consentCapability?.trim()) {
    return null;
  }

  let controller: AbortController;
  try {
    controller = new AbortController();
  } catch {
    return null;
  }
  let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  const abortFromCaller = (): void => controller.abort();
  try {
    if (options.signal?.aborted) {
      controller.abort();
      return null;
    }
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    timeout = globalThis.setTimeout(() => controller.abort(), 15_000);
    const response = await fetch("/api/family/recommend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [FAMILY_AI_CONSENT_HEADER]: options.consentCapability
      },
      body: JSON.stringify(request),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    const envelope = routeEnvelopeSchema.safeParse((await response.json()) as unknown);
    return envelope.success ? parseFamilyRankPayload(envelope.data.data) : null;
  } catch {
    return null;
  } finally {
    options.signal?.removeEventListener("abort", abortFromCaller);
    if (timeout !== undefined) {
      globalThis.clearTimeout(timeout);
    }
  }
}
