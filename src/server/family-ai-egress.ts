import { z } from "zod";
import { buildVoiceSafetyIdentifier } from "@/ai/voice-safety-identifier";
import type { FamilyAiEgressPurpose } from "@/domain/family-ai-consent";
import {
  allowFamilyAiRequest,
  authorizeFamilyAiConsent,
  familyAiServiceConfigured,
  familyAiSessionIdentifier
} from "@/server/family-ai-auth";

const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;

const providerEnvelopeSchema = z
  .object({
    choices: z
      .array(
        z
          .object({ message: z.object({ content: z.string() }).passthrough() })
          .passthrough()
      )
      .min(1)
  })
  .passthrough();

export type FamilyAiEgressContext = {
  apiKey: string;
  request: Request;
  safetyIdentifier: string;
};

export type FamilyAiEgressStart =
  | { ok: true; context: FamilyAiEgressContext }
  | { ok: false; mode: "unconfigured" | "locked" | "limited" };

export function beginFamilyAiEgress(
  request: Request,
  purpose: FamilyAiEgressPurpose
): FamilyAiEgressStart {
  if (
    process.env.HEALTH_AI_PROVIDER !== "openai" ||
    !(process.env.HEALTH_AI_API_KEY?.trim())
  ) {
    return { ok: false, mode: "unconfigured" };
  }
  // A configured provider with missing session-signing configuration is locked,
  // matching the pre-gateway route behavior and never becoming an open proxy.
  if (!familyAiServiceConfigured()) return { ok: false, mode: "locked" };
  if (!authorizeFamilyAiConsent(request, purpose)) return { ok: false, mode: "locked" };
  if (!allowFamilyAiRequest(request)) return { ok: false, mode: "limited" };
  return {
    ok: true,
    context: {
      apiKey: process.env.HEALTH_AI_API_KEY!,
      request,
      safetyIdentifier: buildVoiceSafetyIdentifier(familyAiSessionIdentifier(request))
    }
  };
}

export type FamilyAiCompletionConfig = {
  maxTokens: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
  model: string;
  timeoutMs?: number;
};

export type FamilyAiCompletionResult =
  | { ok: true; data: unknown }
  | { ok: false };

async function readBoundedResponse(response: Response): Promise<unknown | null> {
  if (response.body === null) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_PROVIDER_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Provider response exceeded limit");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}

export async function requestFamilyAiJsonCompletion(
  context: FamilyAiEgressContext,
  config: FamilyAiCompletionConfig
): Promise<FamilyAiCompletionResult> {
  const controller = new AbortController();
  const abortFromRequest = (): void => controller.abort();
  if (context.request.signal.aborted) controller.abort();
  else context.request.signal.addEventListener("abort", abortFromRequest, { once: true });
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000);
  try {
    if (controller.signal.aborted) return { ok: false };
    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": context.safetyIdentifier
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: config.maxTokens,
        response_format: { type: "json_object" },
        messages: config.messages
      }),
      signal: controller.signal
    });
    if (!response.ok) return { ok: false };

    const envelope = providerEnvelopeSchema.safeParse(await readBoundedResponse(response));
    if (!envelope.success) return { ok: true, data: null };
    try {
      return { ok: true, data: JSON.parse(envelope.data.choices[0].message.content) as unknown };
    } catch {
      return { ok: true, data: null };
    }
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
    context.request.signal.removeEventListener("abort", abortFromRequest);
  }
}
