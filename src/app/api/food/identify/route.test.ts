import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// The route's response is a discriminated union across six modes; the tests assert on
// one branch at a time, so a loose read-only shape keeps them honest without ceremony.
type IdentifyJson = {
  mode: string;
  reason?: string;
  candidates?: Array<{ code: string; description: string; fcs: number }>;
  match?: {
    food: { code: string; description: string; group: string };
    tier: string;
    score: { fcs: number; band: string; tier: string };
    alternatives: Array<{ fcs: number; recipeSearchUrl: string; description: string }>;
    estimatedDomains?: {
      domains: Array<{ key: string; value: number }>;
      coverage: { included: string[]; missing: string[]; partial: string[] };
    };
    interpretation?: {
      kind: string;
      restaurant: string | null;
      item: string;
      toppings: string[];
      size: string | null;
      crust: string | null;
      matchQuery: string;
    };
    provenance?: {
      kind: string;
      exact: boolean;
      matchedAs: string;
      unmatchedDetails: string[];
      note: string;
    };
  };
};

const ORIGINAL_ENV = { ...process.env };

function request(body: unknown): Request {
  return new Request("http://localhost/api/food/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
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

describe("POST /api/food/identify — deterministic paths", () => {
  it("serves a typed query with no provider configured and no model spend", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(request({ text: "banana" }));
    const json = (await response.json()) as IdentifyJson;

    expect(response.status).toBe(200);
    expect(json.mode).toBe("match");
    // The headline demo number: 83 is what Tufts published for Banana, raw.
    expect(json.match?.score.fcs).toBe(83);
    expect(json.match?.score.band).toBe("encourage");
    expect(json.match?.score.tier).toBe("T1");
    expect(json.match?.food.code).toBe("63107010");
    expect(json.match?.estimatedDomains?.domains.length).toBeGreaterThan(0);
    expect(json.match?.estimatedDomains?.coverage.missing).toContain("D4");
    expect(json.match?.estimatedDomains?.coverage.partial).toContain("D5");
    expect(json.match?.score.fcs).toBe(83);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("serves a typed query even when the provider is live and the passcode is wrong", async () => {
    process.env.HEALTH_AI_PROVIDER = "openai";
    process.env.HEALTH_AI_API_KEY = "key";
    process.env.DEMO_PASSCODE = "secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const json = (await (await POST(request({ text: "quinoa", passcode: "wrong" }))).json()) as IdentifyJson;
    expect(json.mode).toBe("match");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("understands a branded restaurant order without inventing brand-specific nutrition", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const text = "I am ordering a pepperoni and sausage pizza from Papa John's";
    const json = (await (await POST(request({ text }))).json()) as IdentifyJson;

    expect(json.mode).toBe("match");
    expect(json.match?.food.code).toBe("58106540");
    expect(json.match?.score.fcs).toBe(23);
    expect(json.match?.interpretation).toMatchObject({
      kind: "food_order",
      restaurant: "Papa John's",
      item: "pizza",
      toppings: ["pepperoni", "sausage"],
      size: null,
      crust: null
    });
    expect(json.match?.provenance).toMatchObject({
      kind: "published_closest_match",
      exact: false,
      matchedAs: "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust",
      unmatchedDetails: ["Papa John's exact menu item", "sausage-specific topping"]
    });
    expect(json.candidates?.some((candidate) => /meat other than pepperoni/i.test(candidate.description))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves restaurant details spoken after the camera has already identified pizza", async () => {
    const text = "This came from Papa John's. It is a pepperoni and sausage pizza.";
    const json = (await (await POST(request({ text }))).json()) as IdentifyJson;

    expect(json.mode).toBe("match");
    expect(json.match?.food.code).toBe("58106540");
    expect(json.match?.score.fcs).toBe(23);
    expect(json.match?.interpretation).toMatchObject({
      restaurant: "Papa John's",
      item: "pizza",
      toppings: ["pepperoni", "sausage"]
    });
    expect(json.match?.provenance?.exact).toBe(false);
  });

  it("uses a stated crust when resolving a restaurant order", async () => {
    const text = "Getting a thin crust pepperoni pizza at Papa Johns";
    const json = (await (await POST(request({ text }))).json()) as IdentifyJson;

    expect(json.match?.food.code).toBe("58106550");
    expect(json.match?.score.fcs).toBe(24);
    expect(json.match?.interpretation?.crust).toBe("thin");
  });

  it("returns the carve-out for plain water instead of a flavoured-water score", async () => {
    const json = (await (await POST(request({ text: "water" }))).json()) as IdentifyJson;
    expect(json.mode).toBe("carve_out");
    expect(json.reason).toBe("zero_calorie");
    expect(json.match).toBeUndefined();
  });

  it("offers same-group better options with recipe links", async () => {
    const json = (await (await POST(request({ text: "doritos" }))).json()) as IdentifyJson;
    expect(json.mode).toBe("match");
    expect(json.match?.alternatives.length).toBeGreaterThan(0);
    for (const alternative of json.match?.alternatives ?? []) {
      expect(alternative.fcs).toBeGreaterThanOrEqual((json.match?.score.fcs ?? 0) + 10);
      expect(alternative.recipeSearchUrl).toContain("google.com/search");
    }
  });

  it("re-scores an exact food code for a correction-chip tap", async () => {
    const json = (await (await POST(request({ foodId: "63107010" }))).json()) as IdentifyJson;
    expect(json.mode).toBe("match");
    expect(json.match?.score.fcs).toBe(83);
  });

  it("preserves the order interpretation when a correction chip selects an exact row", async () => {
    const text = "Pepperoni and sausage pizza from Papa John's";
    const json = (await (await POST(request({ text, foodId: "58106610" }))).json()) as IdentifyJson;

    expect(json.match?.food.code).toBe("58106610");
    expect(json.match?.interpretation?.restaurant).toBe("Papa John's");
    expect(json.match?.provenance?.unmatchedDetails).toContain("pepperoni topping");
  });

  it("reports a code it does not know rather than guessing", async () => {
    const json = (await (await POST(request({ foodId: "99999999" }))).json()) as IdentifyJson;
    expect(json.mode).toBe("none");
  });

  it("rejects an empty request", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/food/identify — image gating", () => {
  it("reports unconfigured when no provider is set", async () => {
    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as IdentifyJson;
    expect(json.mode).toBe("unconfigured");
  });

  it("reports locked on a passcode mismatch, at HTTP 200 like the vision route", async () => {
    process.env.HEALTH_AI_PROVIDER = "openai";
    process.env.HEALTH_AI_API_KEY = "key";
    process.env.DEMO_PASSCODE = "secret";

    const response = await POST(request({ image: TINY_IMAGE, passcode: "nope" }));
    expect(response.status).toBe(200);
    expect(((await response.json()) as IdentifyJson).mode).toBe("locked");
  });

  it("short-circuits the disambiguation call when the top match leads clearly", async () => {
    process.env.HEALTH_AI_PROVIDER = "openai";
    process.env.HEALTH_AI_API_KEY = "key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"food":"quinoa, no added fat"}' } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as IdentifyJson;
    expect(json.mode).toBe("match");
    // One call to identify, none to disambiguate: that is what keeps the live loop cheap.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("asks a second, cheap question only when the candidates are close", async () => {
    process.env.HEALTH_AI_PROVIDER = "openai";
    process.env.HEALTH_AI_API_KEY = "key";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"food":"pizza"}' } }] }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"index":0}' } }] }), { status: 200 })
      );

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as IdentifyJson;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(json.mode).toBe("match");
    expect(json.match?.food.description).toMatch(/pizza/i);
  });

  it("returns none, never a guess, when the model sees no food", async () => {
    process.env.HEALTH_AI_PROVIDER = "openai";
    process.env.HEALTH_AI_API_KEY = "key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"food":"","confidence":0}' } }] }), { status: 200 })
    );

    const json = (await (await POST(request({ image: TINY_IMAGE }))).json()) as IdentifyJson;
    expect(json.mode).toBe("none");
  });

  it("surfaces an upstream failure as an error rather than a fabricated match", async () => {
    process.env.HEALTH_AI_PROVIDER = "openai";
    process.env.HEALTH_AI_API_KEY = "key";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));

    const response = await POST(request({ image: TINY_IMAGE }));
    expect(response.status).toBe(502);
    expect(((await response.json()) as IdentifyJson).mode).toBe("error");
  });
});
