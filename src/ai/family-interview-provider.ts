import { z } from "zod";
import { familyInterviewInputSchema, parseFamilyInterviewPayload, type FamilyInterviewResult } from "@/domain/family-interview";
import type { FamilyProfile } from "@/domain/types";
import { FAMILY_AI_CONSENT_HEADER } from "@/domain/family-ai-consent";
import type { Language } from "@/i18n/strings";

export type FamilyInterviewRequest = {
  text: string;
  profile: FamilyProfile;
  language: Language;
};

export type FamilyInterviewRequestOptions = {
  /** Memory-only capability minted after the current disclosure is accepted. */
  consentCapability?: string;
  /** Cancels a send when the Ladder view, consent, or caregiver context changes. */
  signal?: AbortSignal;
};

const routeEnvelopeSchema = z
  .object({
    mode: z.literal("success"),
    data: z.unknown()
  })
  .strict();

export async function requestFamilyInterview(
  request: FamilyInterviewRequest,
  options: FamilyInterviewRequestOptions = {}
): Promise<FamilyInterviewResult | null> {
  if (
    !familyInterviewInputSchema.safeParse(request.text).success ||
    !options.consentCapability?.trim()
  ) {
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
    const response = await fetch("/api/family/interview", {
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
    return envelope.success ? parseFamilyInterviewPayload(envelope.data.data) : null;
  } catch {
    return null;
  } finally {
    options.signal?.removeEventListener("abort", abortFromCaller);
    if (timeout !== undefined) {
      globalThis.clearTimeout(timeout);
    }
  }
}
