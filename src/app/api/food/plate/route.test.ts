import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// The response is a discriminated union across five modes; a loose read-only shape keeps
// each test honest about the one branch it asserts on.
type PlateJson = {
  mode: string;
  message?: string;
  items?: Array<{
    kind: string;
    name?: string;
    reason?: string;
    proposedServings?: number | null;
    basis?: string | null;
    candidates?: Array<{ code: string; description: string; fcs: number }>;
    match?: {
      food: { code: string; description: string; group: string };
      tier: string;
      score: { fcs: number; band: string; tier: string };
      nutrients: { kcal: number | null } | null;
    };
  }>;
};

const ORIGINAL_ENV = { ...process.env };

function request(body: unknown): Request {
  return new Request("http://localhost/api/food/plate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function modelReply(payload: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function live(): void {
  process.env.HEALTH_AI_PROVIDER = "openai";
  process.env.HEALTH_AI_API_KEY = "key";
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.HEALTH_AI_PROVIDER;
  delete process.env.HEALTH_AI_API_KEY;
  delete process.env.DEMO_PASSCODE;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

const TINY_IMAGE = `data:image/jpeg;base64,${"A".repeat(64)}`;

describe("POST /api/food/plate — gating", () => {
  it("rejects a request with no image and buys no model call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(((await response.json()) as PlateJson).message).toBe("empty_request");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a text-only body: this route has no text path", async () => {
    const response = await POST(request({ text: "chicken and rice" }));
    expect(response.status).toBe(400);
  });

  it("reports unconfigured, at HTTP 200, when no provider is set", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(request({ image: TINY_IMAGE }));

    expect(response.status).toBe(200);
    expect(((await response.json()) as PlateJson).mode).toBe("unconfigured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports locked on a passcode mismatch, at HTTP 200 like the identify route", async () => {
    live();
    process.env.DEMO_PASSCODE = "secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(request({ image: TINY_IMAGE, passcode: "nope" }));
    expect(response.status).toBe(200);
    expect(((await response.json()) as PlateJson).mode).toBe("locked");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("checks the provider before the passcode, so a keyless build never says locked", async () => {
    process.env.DEMO_PASSCODE = "secret";
    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;
    expect(json.mode).toBe("unconfigured");
  });
});

describe("POST /api/food/plate — decomposition", () => {
  it("lands three confident foods on one model call, snapping grams to half-step servings", async () => {
    live();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      modelReply({
        foods: [
          { name: "quinoa, no added fat", grams: 140, note: "about two thirds of a cup", confidence: 0.9 },
          { name: "apple, raw", grams: 80, note: "one small apple", confidence: 0.85 },
          { name: "beef curry", grams: 30, note: "a spoonful", confidence: 0.7 }
        ]
      })
    );

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;

    // One call for the whole plate: every name led its runner-up clearly enough to skip
    // the disambiguation pass. That is what keeps a plate scan one spend, not five.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(json.mode).toBe("plate");
    expect(json.items?.map((item) => item.kind)).toEqual(["match", "match", "match"]);
    expect(json.items?.map((item) => item.proposedServings)).toEqual([1.5, 1, 0.5]);
    expect(json.items?.map((item) => item.basis)).toEqual([
      "about two thirds of a cup",
      "one small apple",
      "a spoonful"
    ]);
    // Every number comes from the ledger: 89 is what Tufts published for Quinoa, no added fat.
    expect(json.items?.[0].match?.food.code).toBe("56204005");
    expect(json.items?.[0].match?.score.fcs).toBe(89);
    expect(json.items?.[0].match?.tier).toBe("T1");
    expect(json.items?.[1].match?.score.fcs).toBe(95);
    expect(json.items?.[0].match?.nutrients?.kcal).toBe(120);
  });

  it("clamps a serving-platter estimate rather than logging nine servings", async () => {
    live();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      modelReply({ foods: [{ name: "guacamole", grams: 900, confidence: 0.8 }] })
    );

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;
    expect(json.items?.[0].proposedServings).toBe(6);
    expect(json.items?.[0].basis).toBeNull();
  });

  it("leaves proposedServings null when the model gave no mass", async () => {
    live();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      modelReply({ foods: [{ name: "apple, raw", grams: null, confidence: 0.9 }] })
    );

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;
    expect(json.items?.[0].kind).toBe("match");
    expect(json.items?.[0].proposedServings).toBeNull();
  });

  it("offers candidate chips beside the matched row, primary first and deduped", async () => {
    live();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      modelReply({ foods: [{ name: "apple, raw", grams: 80, confidence: 0.9 }] })
    );

    const candidates = ((await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson).items?.[0]
      .candidates;
    expect(candidates?.[0].code).toBe("63101000");
    expect(candidates?.length).toBeLessThanOrEqual(4);
    expect(new Set(candidates?.map((candidate) => candidate.code)).size).toBe(candidates?.length);
  });

  it("carves out one item without swallowing the plate", async () => {
    live();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      modelReply({
        foods: [
          { name: "water", grams: 250, confidence: 0.95 },
          { name: "apple, raw", grams: 80, confidence: 0.9 }
        ]
      })
    );

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;
    expect(json.items?.[0]).toMatchObject({ kind: "carve_out", name: "water", reason: "zero_calorie" });
    expect(json.items?.[1].kind).toBe("match");
    expect(json.items?.[1].match?.score.fcs).toBe(95);
  });

  it("truncates a seven-food answer to five items", async () => {
    live();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      modelReply({
        foods: Array.from({ length: 7 }, () => ({ name: "apple, raw", grams: 80, confidence: 0.9 }))
      })
    );

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;
    expect(json.items).toHaveLength(5);
  });
});

describe("POST /api/food/plate — batched disambiguation", () => {
  it("asks one second question for every unconfident name at once", async () => {
    live();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        modelReply({
          foods: [
            { name: "apple, raw", grams: 80, confidence: 0.9 },
            { name: "banana", grams: 120, confidence: 0.8 },
            { name: "green beans", grams: 90, confidence: 0.8 }
          ]
        })
      )
      .mockResolvedValueOnce(modelReply({ choices: [{ item: 0, row: 0 }, { item: 1, row: 0 }] }));

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;

    // Two unconfident names, still exactly two calls: never one per item.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(json.items?.map((item) => item.kind)).toEqual(["match", "match", "match"]);
    expect(json.items?.[1].match?.food.code).toBe("63107010");
    expect(json.items?.[1].proposedServings).toBe(1);
  });

  it("demotes a row -1 to an unmatched item with its candidates still attached", async () => {
    live();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(modelReply({ foods: [{ name: "banana", grams: 120, confidence: 0.8 }] }))
      .mockResolvedValueOnce(modelReply({ choices: [{ item: 0, row: -1 }] }));

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;
    expect(json.items?.[0].kind).toBe("none");
    expect(json.items?.[0].name).toBe("banana");
    expect(json.items?.[0].candidates?.length).toBe(3);
  });

  it("demotes an out-of-range row the same way", async () => {
    live();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(modelReply({ foods: [{ name: "banana", grams: 120, confidence: 0.8 }] }))
      .mockResolvedValueOnce(modelReply({ choices: [{ item: 0, row: 99 }] }));

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;
    expect(json.items?.[0].kind).toBe("none");
  });

  it("demotes an item the disambiguation answer never mentioned", async () => {
    live();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(modelReply({ foods: [{ name: "banana", grams: 120, confidence: 0.8 }] }))
      .mockResolvedValueOnce(modelReply({ choices: [] }));

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as PlateJson;
    expect(json.items?.[0].kind).toBe("none");
  });
});

describe("POST /api/food/plate — failure shapes", () => {
  it("reads an empty answer as nothing seen, never a guess", async () => {
    live();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(modelReply({ foods: [] }));

    const response = await POST(request({ image: TINY_IMAGE }));
    expect(response.status).toBe(200);
    expect(((await response.json()) as PlateJson).mode).toBe("none");
  });

  it("reads an upstream refusal as nothing seen, not an error", async () => {
    live();
    // A rate-limited or bad key comes back !ok. The identify route calls that "none"; a 502
    // here would tell the patient the app broke when the camera simply has nothing to say.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 429 }));

    const response = await POST(request({ image: TINY_IMAGE }));
    expect(response.status).toBe(200);
    expect(((await response.json()) as PlateJson).mode).toBe("none");
  });

  it("surfaces a thrown request as a 502 rather than a fabricated plate", async () => {
    live();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    const response = await POST(request({ image: TINY_IMAGE }));
    expect(response.status).toBe(502);
    expect(((await response.json()) as PlateJson).message).toBe("plate_request_error");
  });

  it("never caches a plate response", async () => {
    live();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      modelReply({ foods: [{ name: "apple, raw", grams: 80, confidence: 0.9 }] })
    );

    const response = await POST(request({ image: TINY_IMAGE }));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
