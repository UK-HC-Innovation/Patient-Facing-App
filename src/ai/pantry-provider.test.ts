import { afterEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import { PantryProvider } from "./pantry-provider";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const validPantry = {
  detectedItems: ["canned beans", "brown rice", "onion", "canned tomatoes"],
  recipes: [
    {
      title: "Beans and rice bowl",
      whyItFits: "Beans and rice are filling and easy on sodium for your plan.",
      haveItems: ["canned beans", "brown rice", "onion"],
      buyItems: ["cumin", "bell pepper"],
      watchOut: "Rinse the canned beans to cut the added salt."
    }
  ]
};

describe("PantryProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns structured recipes and a grounding-safe summary on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ mode: "answer", content: JSON.stringify(validPantry) })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new PantryProvider({ passcode: "Tama" });
    const response = await provider.respond({
      mode: "food",
      patientInput: "pantry",
      state: demoState,
      image: "data:image/jpeg;base64,AAAA"
    });

    expect(response.safety).toBe("allowed");
    expect(response.recipes).toHaveLength(1);
    expect(response.recipes?.[0].title).toBe("Beans and rice bowl");
    expect(response.detectedItems).toContain("brown rice");
    expect(response.content).toContain("Beans and rice bowl");
    // Grounding backstop: every field the card renders must be in the summary the
    // verifier reads — including watchOut, the highest-risk caution field.
    expect(response.content).toContain("Rinse the canned beans");
    expect(response.content).toContain("canned tomatoes");
    expect(response.sources).toContain(demoState.carePlan.id);

    // Requests JSON mode with room for a structured completion.
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(options.body as string) as { json?: boolean; maxTokens?: number };
    expect(payload.json).toBe(true);
    expect(payload.maxTokens).toBeGreaterThan(220);
  });

  it("degrades to a plain message when the model is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ mode: "unconfigured" }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new PantryProvider();
    const response = await provider.respond({ mode: "food", patientInput: "pantry", state: demoState });

    expect(response.safety).toBe("allowed");
    expect(response.recipes).toBeUndefined();
    expect(response.content.toLowerCase()).toContain("pantry");
  });

  it("degrades to a no-food message when the completion has no recipes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ mode: "answer", content: JSON.stringify({ detectedItems: [], recipes: [] }) })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new PantryProvider();
    const response = await provider.respond({ mode: "food", patientInput: "pantry", state: demoState });

    expect(response.recipes).toBeUndefined();
    expect(response.content.toLowerCase()).toContain("didn't see any food");
  });

  it("degrades safely when the completion is not valid JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ mode: "answer", content: "not json at all" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new PantryProvider();
    const response = await provider.respond({ mode: "food", patientInput: "pantry", state: demoState });

    expect(response.safety).toBe("allowed");
    expect(response.recipes).toBeUndefined();
  });
});
