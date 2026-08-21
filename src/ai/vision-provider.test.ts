import { afterEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import type { IdentifiedFood } from "@/domain/types";
import { OpenAiVisionProvider } from "./vision-provider";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function sodiumFood(id: string, sodiumMg: number): IdentifiedFood {
  return {
    id,
    barcode: null,
    name: "Test soup",
    brand: null,
    category: "Soup",
    nutrition: {
      servingSize: "1 serving",
      servingGrams: null,
      basis: "per_serving",
      calories: null,
      sodiumMg,
      potassiumMg: null,
      totalSugarsG: null,
      addedSugarsG: null,
      saturatedFatG: null,
      fiberG: null,
      proteinG: null,
      carbsG: null,
      totalFatG: null,
      monoFatG: null,
      polyFatG: null,
      transFatG: null,
      cholesterolMg: null,
      calciumMg: null,
      ironMg: null
    },
    source: "vision_estimate",
    ingredientText: null
  };
}

describe("OpenAiVisionProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the model answer with grounding-safe citations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ mode: "answer", content: "That looks like about 25 grams of carbs — a solid pick." })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiVisionProvider({ passcode: "Tama" });
    const response = await provider.respond({
      mode: "food",
      patientInput: "How many carbs are in this?",
      state: demoState,
      image: "data:image/jpeg;base64,AAAA"
    });

    expect(response.safety).toBe("allowed");
    expect(response.content).toContain("carbs");
    // Care plan is always cited so the answer clears the grounding gate.
    expect(response.sources).toContain(demoState.carePlan.id);

    // The passcode and image are forwarded to the server route.
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/food/vision");
    const payload = JSON.parse(options.body as string) as { passcode?: string; image?: string };
    expect(payload.passcode).toBe("Tama");
    expect(payload.image).toContain("data:image/jpeg");
  });

  it("passes the same cumulative-limit flag and compact totals into HTTP vision context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ mode: "answer", content: "That is a salty choice." }));
    vi.stubGlobal("fetch", fetchMock);
    const loggedFood = sodiumFood("logged-soup", 1400);
    const currentFood = sodiumFood("current-soup", 200);
    const state = {
      ...demoState,
      mealLog: [
        {
          id: "meal-today",
          patientId: demoState.patient.id,
          loggedAt: new Date().toISOString(),
          food: loggedFood,
          flags: [],
          assistantSummary: ""
        }
      ]
    };

    await new OpenAiVisionProvider().respond({
      mode: "food",
      patientInput: "What about this?",
      state,
      identifiedFood: currentFood
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(options.body as string) as { foodContext: string };
    expect(payload.foodContext).toContain("Together with today's meals, this passes your daily sodium limit.");
    expect(payload.foodContext).toContain("sodium 1400 of 1500 mg (93%)");
    expect(payload.foodContext).toContain("Use the numbers above exactly; do not recompute them.");
  });

  it("degrades to the on-device coach when the route is unconfigured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ mode: "unconfigured" }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiVisionProvider();
    const response = await provider.respond({
      mode: "food",
      patientInput: "What is this?",
      state: demoState
    });

    expect(response.safety).toBe("allowed");
    // Falls back to the mock coach's no-food coaching copy (conversation-first).
    expect(response.content.toLowerCase()).toContain("point your camera at any food");
  });

  it("degrades to the on-device coach when the fetch fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiVisionProvider();
    const response = await provider.respond({
      mode: "food",
      patientInput: "What is this?",
      state: demoState
    });

    expect(response.safety).toBe("allowed");
    expect(response.content.length).toBeGreaterThan(0);
  });
});
