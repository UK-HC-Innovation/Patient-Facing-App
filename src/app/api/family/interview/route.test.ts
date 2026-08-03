import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_CAREGIVER_TEXT, schoolAgeFamilyState } from "@/domain/family-fixtures";
import { POST } from "./route";

const result = {
  facts: [{ label: "Grade", value: "fourth grade", sourceSnippet: "fourth grade" }],
  domains: [{ domain: "school_iep", rationale: "The caregiver described a school concern." }],
  followUps: []
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/family/interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    text: SAMPLE_CAREGIVER_TEXT,
    profile: schoolAgeFamilyState.profile,
    passcode: "secret",
    language: "en",
    ...overrides
  };
}

function completion(content: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("family interview route", () => {
  it.each([
    ["short text", { text: "short" }],
    ["whitespace-only text", { text: " ".repeat(10) }],
    ["long text", { text: "x".repeat(5001) }],
    ["invalid profile", { profile: { ...schoolAgeFamilyState.profile, unknown: true } }],
    [
      "invalid nested diagnosis",
      {
        profile: {
          ...schoolAgeFamilyState.profile,
          diagnoses: [{ ...schoolAgeFamilyState.profile!.diagnoses[0], unknown: true }]
        }
      }
    ],
    ["invalid language", { language: "fr" }],
    ["unknown body key", { unknown: true }]
  ])("strictly rejects %s before any provider call", async (_name, overrides) => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(request(validBody(overrides)));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ data: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong passcode", { HEALTH_AI_PROVIDER: "openai", HEALTH_AI_API_KEY: "test-key", DEMO_PASSCODE: "secret" }, "locked"],
    ["missing provider before passcode", { HEALTH_AI_PROVIDER: "", HEALTH_AI_API_KEY: "test-key", DEMO_PASSCODE: "secret" }, "unconfigured"],
    ["missing key before passcode", { HEALTH_AI_PROVIDER: "openai", HEALTH_AI_API_KEY: "", DEMO_PASSCODE: "secret" }, "unconfigured"]
  ])("returns %s without calling the provider", async (_name, env, mode) => {
    vi.stubEnv("HEALTH_AI_PROVIDER", env.HEALTH_AI_PROVIDER);
    vi.stubEnv("HEALTH_AI_API_KEY", env.HEALTH_AI_API_KEY);
    vi.stubEnv("DEMO_PASSCODE", env.DEMO_PASSCODE);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(request(validBody({ passcode: "wrong" })));
    expect(await res.json()).toEqual({ mode, data: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a pre-basics profile and nulls the unknown fields in the prompt", async () => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "secret");
    const fetchMock = vi.fn().mockResolvedValue(completion(JSON.stringify(result)));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      request(
        validBody({
          profile: { birthYear: 0, schoolStage: "not_school_age", county: "", diagnoses: [] }
        })
      )
    );
    expect(await res.json()).toEqual({ mode: "success", data: result });
    const payload = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as {
      messages: Array<{ content: string }>;
    };
    const prompt = payload.messages[1].content;
    expect(prompt).toContain('"birthYear":null');
    expect(prompt).toContain('"county":null');
    expect(prompt).toContain('"schoolStage":null');
  });

  it("still rejects an out-of-range birth year", async () => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      request(validBody({ profile: { ...schoolAgeFamilyState.profile, birthYear: 1850 } }))
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows configured local development when DEMO_PASSCODE is unset", async () => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "");
    const fetchMock = vi.fn().mockResolvedValue(completion(JSON.stringify(result)));
    vi.stubGlobal("fetch", fetchMock);

    expect(await (await POST(request(validBody({ passcode: undefined })))).json()).toEqual({ mode: "success", data: result });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("calls OpenAI-compatible JSON chat completions with a 15-second abort signal and no catalog names", async () => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "secret");
    vi.stubEnv("HEALTH_AI_INTERVIEW_MODEL", "interview-model");
    const fetchMock = vi.fn().mockResolvedValue(completion(JSON.stringify(result)));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(request(validBody()));
    expect(await res.json()).toEqual({ mode: "success", data: result });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const payload = JSON.parse(options.body as string) as {
      model: string;
      max_tokens: number;
      response_format: { type: string };
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.model).toBe("interview-model");
    expect(payload.max_tokens).toBe(1200);
    expect(payload.response_format).toEqual({ type: "json_object" });
    const prompt = payload.messages[0].content;
    expect(prompt).toContain("early_intervention");
    expect(prompt).toContain('"followUps":[{"question":"","options":["",""]}]');
    expect(prompt).toMatch(/at most 3 short orientation questions/i);
    expect(prompt).toMatch(/2 to 4 suggested short answers under 60 characters/i);
    expect(prompt).toMatch(/questions under 200 characters/i);
    expect(prompt).toContain('lines beginning with "Q:"');
    expect(prompt).toContain('lines beginning with "A:"');
    expect(prompt).toMatch(/only from the caregiver's words/i);
    expect(prompt).toMatch(/never repeat a question already asked/i);
    expect(prompt).toContain("never state that the child has a condition");
    expect(prompt).toMatch(/diagnosis_education only when.*neutral information/i);
    expect(prompt).toMatch(/saying there is no diagnosis are not enough/i);
    expect(prompt).toMatch(/rationales, followUps questions, or options/i);
    expect(payload.messages.map(({ content }) => content).join("\n")).toContain("Riley");
    expect(payload.messages.map(({ content }) => content).join("\n")).not.toMatch(/KY-SPIN|Michelle P\.|First Steps|catalog|resource name/i);
  });

  it.each([
    ["malformed JSON", "not json"],
    ["off-shape JSON", JSON.stringify({ ...result, surprise: true })],
    ["legacy string follow-ups", JSON.stringify({ ...result, followUps: ["What has helped?"] })]
  ])("returns data null for %s model content", async (_name, content) => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion(content)));

    const res = await POST(request(validBody()));
    expect(await res.json()).toEqual({ mode: "success", data: null });
  });

  it("defensively returns data null for a malformed provider envelope", async () => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: "wrong" }), { status: 200 })));

    expect(await (await POST(request(validBody()))).json()).toEqual({ mode: "success", data: null });
  });

  it.each([
    ["upstream non-OK", vi.fn().mockResolvedValue(new Response("failed", { status: 503 }))],
    ["rejected fetch", vi.fn().mockRejectedValue(new Error("network"))]
  ])("returns 502 data null for %s", async (_name, fetchMock) => {
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "secret");
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(validBody()));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ data: null });
  });

  it("aborts the provider after 15 seconds and clears its timer", async () => {
    vi.useFakeTimers();
    vi.stubEnv("HEALTH_AI_PROVIDER", "openai");
    vi.stubEnv("HEALTH_AI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PASSCODE", "secret");
    const fetchMock = vi.fn((_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = POST(request(validBody()));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(15_000);
    const response = await pending;
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ data: null });
    expect(vi.getTimerCount()).toBe(0);
  });
});
