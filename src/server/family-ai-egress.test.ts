import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAMILY_AI_CONSENT_HEADER,
  FAMILY_AI_SESSION_COOKIE,
  createFamilyAiConsentCapability,
  createFamilyAiSessionToken,
  resetFamilyAiRateLimitsForTest
} from "@/server/family-ai-auth";
import {
  beginFamilyAiEgress,
  requestFamilyAiJsonCompletion
} from "@/server/family-ai-egress";

function consentedRequest(purposes: Array<"interview" | "recommend">): Request {
  const url = "https://ladder.test/api/family/interview";
  const token = createFamilyAiSessionToken()!;
  const cookie = `${FAMILY_AI_SESSION_COOKIE}=${token}`;
  const capability = createFamilyAiConsentCapability(
    new Request(url, { headers: { Cookie: cookie } }),
    undefined,
    Date.now(),
    purposes
  )!;
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      [FAMILY_AI_CONSENT_HEADER]: capability
    },
    body: JSON.stringify({ caregiver: "private words" })
  });
}

beforeEach(() => {
  process.env.HEALTH_AI_PROVIDER = "openai";
  process.env.HEALTH_AI_API_KEY = "test-key";
  process.env.DEMO_PASSCODE = "invite-code";
  process.env.FAMILY_AI_SESSION_SECRET = "test-session-secret-that-is-at-least-32-bytes";
  resetFamilyAiRateLimitsForTest();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("family AI egress gateway", () => {
  it("rejects a wrong-purpose capability before caregiver text is read", () => {
    const request = consentedRequest(["interview"]);

    expect(beginFamilyAiEgress(request, "recommend")).toEqual({ ok: false, mode: "locked" });
    expect(request.bodyUsed).toBe(false);
  });

  it("owns provider credentials, safety headers, and JSON-envelope decoding", async () => {
    const request = consentedRequest(["interview"]);
    const start = beginFamilyAiEgress(request, "interview");
    expect(start.ok).toBe(true);
    if (!start.ok) throw new Error("Expected egress context");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ safe: true }) } }] }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestFamilyAiJsonCompletion(start.context, {
        model: "test-model",
        maxTokens: 100,
        messages: [
          { role: "system", content: "Return JSON." },
          { role: "user", content: "Prompt assembled by the route." }
        ]
      })
    ).resolves.toEqual({ ok: true, data: { safe: true } });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json"
    });
    expect((options.headers as Record<string, string>)["OpenAI-Safety-Identifier"]).toMatch(
      /^pc_voice_[a-f0-9]{32}$/
    );
    expect(JSON.stringify(options)).not.toContain("ladder_family_ai");
  });
});
