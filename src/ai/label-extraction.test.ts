import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLabelExtractionPrompt,
  extractNutritionLabel,
  parseLabelExtraction
} from "./label-extraction";

function routeResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("label photo transcription", () => {
  it("requests one JSON transcription and builds per-serving nutrition with nullable fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      routeResponse({
        mode: "answer",
        content: JSON.stringify({
          productName: "Plain yogurt",
          servingSize: "1 cup (245 g)",
          servingGrams: 245,
          calories: 150,
          sodiumMg: 105,
          potassiumMg: null,
          totalSugarsG: 12,
          addedSugarsG: null,
          saturatedFatG: 5,
          fiberG: null,
          proteinG: 8,
          carbsG: 12,
          totalFatG: 8,
          monoFatG: null,
          polyFatG: null,
          transFatG: 0,
          cholesterolMg: 30,
          calciumMg: null,
          ironMg: null,
          ingredientText: "Cultured milk"
        })
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractNutritionLabel({
      image: "data:image/jpeg;base64,AAAA",
      barcode: "000000000001",
      patientId: "patient-1",
      language: "en"
    });

    expect(result).toMatchObject({
      ok: true,
      food: {
        id: "label:000000000001",
        name: "Plain yogurt",
        source: "label_vision",
        nutrition: { basis: "per_serving", calories: 150, potassiumMg: null }
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      json: boolean;
      system: string;
    };
    expect(request.json).toBe(true);
    expect(request.system).toContain("Never estimate");
  });

  it("falls back after garbled model JSON without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(routeResponse({ mode: "answer", content: "not json" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      extractNutritionLabel({
        image: "data:image/jpeg;base64,AAAA",
        barcode: "000000000002",
        patientId: "patient-1",
        language: "en"
      })
    ).resolves.toEqual({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes invalid fields to null without discarding readable values", () => {
    const parsed = parseLabelExtraction(
      JSON.stringify({
        productName: "Test food",
        servingSize: "1 package",
        calories: 2_001,
        sodiumMg: -1,
        potassiumMg: 10_001,
        proteinG: 12,
        ingredientText: "Beans"
      })
    );

    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      calories: null,
      sodiumMg: null,
      potassiumMg: null,
      proteinG: 12,
      ingredientText: "Beans"
    });
  });

  it("does not call the paid route when no frame is available", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      extractNutritionLabel({
        image: null,
        barcode: "000000000003",
        patientId: "patient-1",
        language: "en"
      })
    ).resolves.toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explicitly forbids nutritional estimation", () => {
    const prompt = buildLabelExtractionPrompt();
    expect(prompt).toContain("only text and numbers visibly printed");
    expect(prompt).toContain("Never estimate, infer, calculate");
    expect(prompt).toContain("Use null whenever");
  });
});
