import { describe, expect, it } from "vitest";
import { demoState } from "@/domain/fixtures";
import type { AppState } from "@/domain/types";
import { MockHealthAiProvider } from "./mock-provider";
import type { LiveSessionEvent } from "./types";

describe("MockHealthAiProvider", () => {
  it("explains a medication using the patient medication list", async () => {
    const provider = new MockHealthAiProvider();
    const response = await provider.respond({
      mode: "why",
      patientInput: "Why am I taking lisinopril?",
      state: demoState
    });

    expect(response.content).toContain("Lisinopril");
    expect(response.content).toContain("stroke");
    expect(response.content).toContain("feel fine");
    expect(response.sources).toContain("med-1");
  });

  it.each([
    ["The cost of Lisinopril is getting in the way.", "lower-cost", "pharmacy"],
    ["I ran out of Lisinopril.", "pharmacy", "care team"],
    ["A pharmacy problem is keeping me from getting Lisinopril.", "pharmacy", "care team"]
  ])("gives concrete trouble support for %s", async (patientInput, firstExpected, secondExpected) => {
    const provider = new MockHealthAiProvider();
    const response = await provider.respond({ mode: "trouble", patientInput, state: demoState });

    expect(response.content).toContain(firstExpected);
    expect(response.content).toContain(secondExpected);
    expect(response.sources).toContain("plan-1");
    expect(response.content).not.toMatch(/\$\d/);
  });

  it("offers a routine for remembering without guessing what to do about a missed dose", async () => {
    const provider = new MockHealthAiProvider();
    const response = await provider.respond({
      mode: "today",
      patientInput: "I forgot my Lisinopril. Help me make a simple routine.",
      state: demoState
    });

    expect(response.content).toContain("daily cue");
    expect(response.content).toContain("pharmacist");
    expect(response.sources).toContain("plan-1");
  });

  it("asks for the barrier when a trouble request has no specific signal", async () => {
    const provider = new MockHealthAiProvider();
    const response = await provider.respond({
      mode: "trouble",
      patientInput: "I need help with my medicine.",
      state: demoState
    });

    expect(response.content).toContain("what got in the way");
    expect(response.sources).toContain("plan-1");
  });

  it("uses the named medication in a multi-medication state", async () => {
    const provider = new MockHealthAiProvider();
    const multiMedicationState: AppState = {
      ...demoState,
      medications: [
        {
          ...demoState.medications[0]
        },
        {
          id: "med-2",
          patientId: "patient-1",
          name: "Metformin",
          dose: "500 mg",
          schedule: "With meals",
          purpose: "Helps lower blood sugar.",
          preventionBenefit: "Improved glucose control helps prevent complications.",
          safetyNote: "Take with food.",
          source: "patient_reported",
          activeBarriers: []
        }
      ]
    };

    const response = await provider.respond({
      mode: "why",
      patientInput: "Why am I taking metformin?",
      state: multiMedicationState
    });

    expect(response.content).toContain("Metformin");
    expect(response.sources).toContain("med-2");
    expect(response.sources).not.toContain("med-1");
  });

  it("creates visit prep guidance", async () => {
    const provider = new MockHealthAiProvider();
    const response = await provider.respond({
      mode: "visit",
      patientInput: "Help me prepare for my appointment.",
      state: demoState
    });

    expect(response.content).toContain("Bring your recent home readings");
    expect(response.sources).toContain("plan-1");
  });

  it("asks for medication clarification in a multi-medication state when no name matches", async () => {
    const provider = new MockHealthAiProvider();
    const multiMedicationState: AppState = {
      ...demoState,
      medications: [
        {
          ...demoState.medications[0],
          id: "med-1",
          name: "Lisinopril"
        },
        {
          id: "med-2",
          patientId: "patient-1",
          name: "Metformin",
          dose: "500 mg",
          schedule: "With meals",
          purpose: "Helps lower blood sugar.",
          preventionBenefit: "Improved glucose control helps prevent complications.",
          safetyNote: "Take with food.",
          source: "patient_reported",
          activeBarriers: []
        }
      ]
    };

    const response = await provider.respond({
      mode: "why",
      patientInput: "Why am I taking the medication for this visit?",
      state: multiMedicationState
    });

    expect(response.content.toLowerCase()).toContain("multiple medications");
    expect(response.content.toLowerCase()).toContain("which one");
    expect(response.sources).toHaveLength(0);
    expect(response.content).not.toContain("Lisinopril");
    expect(response.content).not.toContain("Medip");
  });

  it("answers a food question with the food name and sodium", async () => {
    const provider = new MockHealthAiProvider();
    const response = await provider.respond({
      mode: "food",
      patientInput: "Can I have this for lunch?",
      state: demoState,
      identifiedFood: {
        id: "051000012616",
        barcode: "051000012616",
        name: "Chicken Noodle Soup",
        brand: "Campbell's",
        category: "Soups",
        nutrition: {
          servingSize: "1/2 cup",
          calories: 60,
          sodiumMg: 890,
          potassiumMg: 100,
          totalSugarsG: 1,
          addedSugarsG: 0,
          saturatedFatG: 0.5,
          fiberG: 1,
          proteinG: 3,
          carbsG: 8,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "barcode_seed",
        ingredientText: null
      }
    });

    expect(response.content).toContain("Chicken Noodle Soup");
    expect(response.content).toContain("890");
    expect(response.sources).toContain("plan-1");
  });

  it("streams mock live session events in order", async () => {
    const provider = new MockHealthAiProvider();
    const events: string[] = [];
    const handle = await provider.openLiveSession({
      language: "en",
      getState: () => demoState,
      getContext: () => ({ frameDataUrl: null, identifiedFood: null, flagTexts: [] }),
      onEvent: (event) => {
        if (event.type === "status") {
          events.push(`status:${event.status}`);
        } else {
          events.push(event.type);
        }
      }
    });

    handle.sendUserText("Is this healthy?");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events[0]).toBe("status:listening");
    expect(events).toContain("userTranscript");
    expect(events).toContain("assistantTranscript");
    expect(events.indexOf("status:thinking")).toBeLessThan(events.indexOf("assistantTranscript"));
    expect(events.at(-1)).toBe("status:listening");
    handle.close();
  });

  it("runs the safety gate on live text turns and intercepts a crisis utterance", async () => {
    const provider = new MockHealthAiProvider();
    const events: LiveSessionEvent[] = [];
    const handle = await provider.openLiveSession({
      language: "en",
      getState: () => demoState,
      getContext: () => ({ frameDataUrl: null, identifiedFood: null, flagTexts: [] }),
      onEvent: (event) => events.push(event)
    });

    handle.sendUserText("I want to die");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const intercept = events.find((event) => event.type === "safetyIntercept");
    expect(intercept).toBeDefined();
    if (intercept && intercept.type === "safetyIntercept") {
      expect(intercept.safety).toBe("crisis");
      expect(intercept.actions).toContain("crisis_call_988");
    }
    // The mock voice bypass is closed: no spoken assistant answer is produced.
    expect(events.some((event) => event.type === "assistantTranscript")).toBe(false);
    handle.close();
  });

  it("answers 'what did my eye report say?' strictly from the confirmed report", async () => {
    const provider = new MockHealthAiProvider();
    const withResult = {
      ...demoState,
      screeningResults: [
        {
          id: "result-eye-1",
          gapId: "gap-demo-dr",
          outcome: "normal" as const,
          grade: "no_dr" as const,
          dmePresent: false,
          source: "photo_report" as const,
          reportRef: "report-no-dr.svg",
          confirmedAt: "2026-07-07T10:00:00.000Z"
        }
      ]
    };

    const response = await provider.respond({
      mode: "ask",
      patientInput: "what did my eye report say?",
      state: withResult
    });

    expect(response.content).toContain("Your report from");
    expect(response.content).toContain("no signs of diabetic eye disease were found");
    expect(response.sources).toEqual(["result-eye-1"]);
  });

  it("says so honestly when no eye report has been confirmed yet", async () => {
    const provider = new MockHealthAiProvider();
    const response = await provider.respond({
      mode: "ask",
      patientInput: "what did my eye screening say?",
      state: demoState
    });

    expect(response.content).toContain("don't have a confirmed eye screening report");
    expect(response.sources).toEqual([]);
  });
});
