import { afterEach, describe, expect, it, vi } from "vitest";
import { blankCompassState } from "@/domain/fixtures";
import { createSafeAiResponse } from "./safety-gate";
import { runRealtimeToolCall, type RealtimeTool } from "./realtime-session";
import {
  LOOKUP_FOOD_SCORE_TOOL,
  buildCompassInstructions,
  buildCompassVoiceContext,
  lookupFoodScore
} from "./compass-instructions";
import type { HealthAiProvider } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("blankCompassState", () => {
  it("carries no patient data for a prompt to leak", () => {
    const state = blankCompassState();
    expect(state.medications).toEqual([]);
    expect(state.readings).toEqual([]);
    expect(state.glucoseReadings).toEqual([]);
    expect(state.mealLog).toEqual([]);
    expect(state.aiMessages).toEqual([]);
    // The demo patient the root layout would otherwise seed.
    expect(state.patient.id).not.toBe("patient-1");
    expect(state.patient.name).toBe("Guest");
  });

  it("still carries a care plan, because grounding requires one to be cited", () => {
    expect(blankCompassState().carePlan.id).toBe("plan-compass");
  });
});

describe("the safety gate on a blank compass state", () => {
  it("still intercepts a crisis utterance — crisis detection does not depend on state", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({ content: "should not be called", safety: "allowed" as const, sources: [] })
    };

    const response = await createSafeAiResponse(
      { mode: "food", patientInput: "I'm having crushing chest pain right now", state: blankCompassState() },
      provider
    );

    expect(response.safety).not.toBe("allowed");
    expect(provider.respond).not.toHaveBeenCalled();
  });

  it("lets an ordinary food answer through when the provider cites the synthetic care plan", async () => {
    const provider: HealthAiProvider = {
      respond: vi.fn().mockResolvedValue({
        content: "Raspberries score 100 — one of the best choices in the fruit group.",
        safety: "allowed" as const,
        sources: ["plan-compass"]
      })
    };

    const response = await createSafeAiResponse(
      { mode: "food", patientInput: "how do raspberries score?", state: blankCompassState() },
      provider
    );

    expect(response.safety).toBe("allowed");
    expect(response.content).toContain("100");
  });
});

describe("buildCompassInstructions", () => {
  it("forbids inventing a number and points at the lookup tool instead", () => {
    const instructions = buildCompassInstructions();
    expect(instructions).toContain("never state a number you were not given");
    expect(instructions).toContain("lookup_food_score");
    expect(instructions).toContain("You never calculate, estimate, adjust or average a score yourself");
  });

  it("says outright that it knows nothing about the person", () => {
    expect(buildCompassInstructions()).toContain("no medical history, no medications, no test results");
  });
});

describe("buildCompassVoiceContext", () => {
  it("carries the score and closes with the do-not-recompute instruction", () => {
    const context = buildCompassVoiceContext(
      {
        kind: "score",
        fcs: 83,
        band: "encourage",
        tier: "T1",
        calorieDensityKcalPer100g: 89,
        alternatives: []
      },
      "Banana, raw"
    );
    expect(context).toContain("Banana, raw");
    expect(context).toContain("83 out of 100");
    expect(context).toContain("Use the numbers above exactly; do not recompute them.");
  });

  it("says nothing was identified rather than naming a food it does not have", () => {
    expect(buildCompassVoiceContext(null, null)).toContain("none identified yet");
  });
});

describe("lookupFoodScore", () => {
  it("returns a compact deterministic result the model can read out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            mode: "match",
            match: {
              food: { description: "Peanut butter, smooth" },
              score: { fcs: 61, band: "moderate" },
              alternatives: [
                { description: "Peanuts, dry roasted", fcs: 78 },
                { description: "Almond butter", fcs: 80 },
                { description: "Cashews, raw", fcs: 85 },
                { description: "Walnuts", fcs: 90 }
              ]
            }
          })
      })
    );

    const result = await lookupFoodScore("peanut butter");
    expect(result).toEqual({
      found: true,
      food: "Peanut butter, smooth",
      fcs: 61,
      band: "moderate",
      betterOptions: [
        { description: "Peanuts, dry roasted", fcs: 78 },
        { description: "Almond butter", fcs: 80 },
        { description: "Cashews, raw", fcs: 85 }
      ]
    });
  });

  it("reports a carve-out with an explanation and no number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ mode: "carve_out", reason: "zero_calorie" }) })
    );
    const result = await lookupFoodScore("water");
    expect(result).toEqual({
      found: false,
      reason: "not_scoreable",
      explanation: "outside the score's range — it provides essentially no calories"
    });
  });

  it("reports no match rather than an approximate one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve({ mode: "none", candidates: [] }) }));
    expect(await lookupFoodScore("zzzzz")).toEqual({ found: false, reason: "no_match" });
  });
});

describe("runRealtimeToolCall", () => {
  const tool: RealtimeTool = {
    ...LOOKUP_FOOD_SCORE_TOOL,
    parameters: LOOKUP_FOOD_SCORE_TOOL.parameters as unknown as Record<string, unknown>,
    handler: vi.fn().mockResolvedValue({ found: true, fcs: 61 })
  };

  it("answers the call with a function_call_output and a response.create", async () => {
    const payloads = await runRealtimeToolCall([tool], {
      type: "response.function_call_arguments.done",
      name: "lookup_food_score",
      call_id: "call_1",
      arguments: '{"query":"peanut butter"}'
    });

    expect(tool.handler).toHaveBeenCalledWith({ query: "peanut butter" });
    expect(payloads).toEqual([
      {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: "call_1",
          output: JSON.stringify({ found: true, fcs: 61 })
        }
      },
      { type: "response.create" }
    ]);
  });

  it("ignores a call for a tool it does not have", async () => {
    expect(
      await runRealtimeToolCall([tool], {
        type: "response.function_call_arguments.done",
        name: "delete_everything",
        call_id: "call_2",
        arguments: "{}"
      })
    ).toEqual([]);
  });

  it("hands back an error rather than nothing when the handler throws, so no gap is filled by a guess", async () => {
    const failing: RealtimeTool = { ...tool, handler: vi.fn().mockRejectedValue(new Error("offline")) };
    const payloads = await runRealtimeToolCall([failing], {
      type: "response.function_call_arguments.done",
      name: "lookup_food_score",
      call_id: "call_3",
      arguments: '{"query":"tofu"}'
    });
    expect(payloads[0]).toMatchObject({
      item: { output: JSON.stringify({ error: "lookup_failed" }) }
    });
  });

  it("survives malformed arguments", async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true });
    const payloads = await runRealtimeToolCall([{ ...tool, handler: spy }], {
      type: "response.function_call_arguments.done",
      name: "lookup_food_score",
      call_id: "call_4",
      arguments: "not json"
    });
    expect(spy).toHaveBeenCalledWith({});
    expect(payloads).toHaveLength(2);
  });
});
