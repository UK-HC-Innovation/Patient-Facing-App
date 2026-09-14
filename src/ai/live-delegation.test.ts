import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompassContext } from "@/domain/compass-context";
import {
  LIVE_VOICE_POLICY,
  answerDelegation,
  buildLiveFacts,
  createDelegationAnswerer,
  describeCurrent,
  extractSpokenAsk,
  lookupSpokenFood,
  withLiveVoicePolicy,
  type CurrentFood,
  type SpokenLookup
} from "./live-delegation";

const recordUsage = vi.hoisted(() => vi.fn());
vi.mock("@/telemetry/recorder", () => ({ recordUsage }));

const BANANA: CompassContext = {
  kind: "score",
  fcs: 95,
  band: "encourage",
  tier: "T1",
  calorieDensityKcalPer100g: 89,
  alternatives: []
};

const CHEERIOS: CompassContext = {
  kind: "score",
  fcs: 58,
  band: "moderate",
  tier: "T1",
  calorieDensityKcalPer100g: 390,
  alternatives: [
    { description: "Cereal (General Mills Cheerios)", fcs: 77 },
    { description: "Cereal, oat, NFS", fcs: 70 }
  ]
};

describe("extractSpokenAsk", () => {
  it.each([
    ["what about peanut butter?", "peanut butter"],
    ["¿y el pan integral?", "pan integral"],
    ["is honey nut cheerios better", "honey nut cheerios"],
    ["and a coke", "coke"],
    ["¿qué tal la manzana?", "manzana"],
    ["¿es mejor la avena?", "avena"],
    ["¿cuál es el puntaje de los frijoles?", "frijoles"],
    ["peanut butter", "peanut butter"],
    ["um, what about cheerios then", "cheerios"],
    ["how does oatmeal score", "oatmeal"]
  ])("hears a named food in %j", (turn, query) => {
    expect(extractSpokenAsk(turn)).toEqual({ kind: "food", query });
  });

  it.each([
    "This came from Papa John's, pepperoni",
    "with sausage",
    "is this a good choice?",
    "why that score?",
    "what's a better choice",
    "can I have this for lunch?",
    "is it healthy",
    "what is this?",
    "¿es bueno esto?",
    "¿por qué ese puntaje?",
    ""
  ])("hears a question about the food on screen in %j", (turn) => {
    expect(extractSpokenAsk(turn)).toEqual({ kind: "current" });
  });

  it("leaves anything else to a fixed line", () => {
    expect(extractSpokenAsk("tell me a story about the moon and a very long road")).toEqual({ kind: "other" });
  });
});

describe("describeCurrent", () => {
  it("names the score, the band and the best swap", () => {
    expect(describeCurrent({ name: "Honey Nut Cheerios", compass: CHEERIOS }, "en").text).toBe(
      "Honey Nut Cheerios scores 58 out of 100. That's in the moderate range. Cereal (General Mills Cheerios) scores higher, at 77."
    );
  });

  it("does not invent an improvement for a food already at the top", () => {
    expect(describeCurrent({ name: "Banana, raw", compass: BANANA }, "en").text).toBe(
      "Banana, raw scores 95 out of 100. That's a food to encourage."
    );
  });

  it("says no close swap when a moderate food has none", () => {
    expect(describeCurrent({ name: "Toast", compass: { ...CHEERIOS, alternatives: [] } }, "en").text).toContain(
      "No close swap found."
    );
  });

  it("has no score for a food outside the range, and asks when nothing is on screen", () => {
    expect(describeCurrent({ name: "Water", compass: { kind: "carve_out", reason: "zero_calorie" } }, "en")).toEqual({
      text: "Water has no score. It's outside the range the score covers.",
      branch: "current_carve_out"
    });
    expect(describeCurrent({ name: null, compass: null }, "es")).toEqual({
      text: "Muéstrame la comida o escribe su nombre.",
      branch: "nothing_on_screen"
    });
  });

  it("speaks Spanish on the Spanish door", () => {
    expect(describeCurrent({ name: "Plátano", compass: BANANA }, "es").text).toBe(
      "Plátano obtiene 95 de 100. Es un alimento recomendado."
    );
  });
});

describe("answerDelegation", () => {
  const onScreen = (): CurrentFood => ({ name: "Banana, raw", compass: BANANA });

  it("answers a named food from the lookup, never from the food on screen", async () => {
    const lookup = vi.fn(async (): Promise<SpokenLookup> => ({
      kind: "match",
      description: "Peanut butter",
      fcs: 43,
      band: "moderate",
      alternatives: [{ description: "Almond butter", fcs: 52 }]
    }));

    const answer = await answerDelegation("what about peanut butter?", { language: "en", currentFood: onScreen, lookup });

    expect(lookup).toHaveBeenCalledWith("peanut butter");
    expect(answer).toEqual({
      text: "Peanut butter scores 43 out of 100. That's in the moderate range. Almond butter scores higher, at 52.",
      branch: "lookup_match"
    });
  });

  it("asks which one rather than scoring a candidate", async () => {
    const lookup = vi.fn(async (): Promise<SpokenLookup> => ({
      kind: "candidate",
      descriptions: ["Soft drink, cola", "Soft drink, cola, diet", "Soft drink, cola, caffeine free"]
    }));

    const answer = await answerDelegation("and a coke", { language: "en", currentFood: onScreen, lookup });

    expect(answer).toEqual({
      text: "Which one was it: Soft drink, cola, Soft drink, cola, diet or Soft drink, cola, caffeine free?",
      branch: "lookup_candidate"
    });
    expect(answer.text).not.toMatch(/\d/);
  });

  it("says a carve-out has no score and a miss was not found", async () => {
    const carveOut = await answerDelegation("what about water", {
      language: "en",
      currentFood: onScreen,
      lookup: async () => ({ kind: "carve_out" })
    });
    expect(carveOut.text).toBe("Water has no score. It's outside the range the score covers.");

    const miss = await answerDelegation("what about unobtainium", {
      language: "en",
      currentFood: onScreen,
      lookup: async () => ({ kind: "none" })
    });
    expect(miss).toEqual({ text: "I couldn't find that one. You can type it.", branch: "lookup_none" });
  });

  it("describes the refined food when the door's refinement changed it", async () => {
    let food: CurrentFood = { name: "Pizza, cheese", compass: { ...CHEERIOS, fcs: 38, alternatives: [] } };
    const lookup = vi.fn(async (): Promise<SpokenLookup> => ({ kind: "none" }));

    const answer = await answerDelegation("This came from Papa John's, pepperoni", {
      language: "en",
      currentFood: () => food,
      prepare: async () => {
        food = { name: "Pizza, pepperoni", compass: { ...CHEERIOS, fcs: 31, alternatives: [] } };
      },
      lookup
    });

    expect(answer.text).toMatch(/^Pizza, pepperoni scores 31 out of 100\./);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("gives a fixed line for anything it cannot answer from the table", async () => {
    const answer = await answerDelegation("tell me a story about the moon and a very long road", {
      language: "en",
      currentFood: onScreen,
      lookup: async () => ({ kind: "none" })
    });
    expect(answer).toEqual({ text: "I can only speak to the food on screen.", branch: "other" });
  });
});

describe("createDelegationAnswerer", () => {
  beforeEach(() => {
    recordUsage.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers a stalled lookup with a fixed line at the deadline, and records it", async () => {
    const answer = createDelegationAnswerer(
      { language: "en", currentFood: () => ({ name: null, compass: null }), lookup: () => new Promise(() => undefined) },
      5000
    );

    const pending = answer("what about peanut butter");
    await vi.advanceTimersByTimeAsync(5000);

    await expect(pending).resolves.toBe("I couldn't check that. You can type it.");
    expect(recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "decision", decision: "voice_delegation", outcome: "timeout", source: "fallback" })
    );
  });

  it("answers a failed lookup with the same line", async () => {
    const answer = createDelegationAnswerer({
      language: "es",
      currentFood: () => ({ name: null, compass: null }),
      lookup: async () => {
        throw new Error("offline");
      }
    });

    await expect(answer("¿qué tal la manzana?")).resolves.toBe("No pude revisarlo. Puedes escribirlo.");
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
  });
});

describe("lookupSpokenFood", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function answerWith(body: unknown) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("reads a published match and asks the route with the typed box's request", async () => {
    const fetchMock = answerWith({
      mode: "match",
      match: {
        food: { description: "Banana, raw" },
        score: { fcs: 95, band: "encourage" },
        alternatives: [{ description: "Apple, raw", fcs: 95 }]
      }
    });

    await expect(lookupSpokenFood("banana", "code")).resolves.toEqual({
      kind: "match",
      description: "Banana, raw",
      fcs: 95,
      band: "encourage",
      alternatives: [{ description: "Apple, raw", fcs: 95 }]
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/food/identify");
    expect(JSON.parse(String(init.body))).toEqual({ text: "banana", passcode: "code" });
  });

  it("reads both candidate shapes, a carve-out and a miss", async () => {
    answerWith({ mode: "candidate", candidates: [{ code: "1", description: "Chicken breast" }] });
    await expect(lookupSpokenFood("chicken")).resolves.toEqual({ kind: "candidate", descriptions: ["Chicken breast"] });

    answerWith({ mode: "candidate", candidate: { food: { code: "2", description: "Tamale with meat" } } });
    await expect(lookupSpokenFood("tamal")).resolves.toEqual({ kind: "candidate", descriptions: ["Tamale with meat"] });

    answerWith({ mode: "carve_out", reason: "zero_calorie" });
    await expect(lookupSpokenFood("water")).resolves.toEqual({ kind: "carve_out" });

    answerWith({ mode: "none", candidates: [] });
    await expect(lookupSpokenFood("zzz")).resolves.toEqual({ kind: "none" });
  });
});

describe("the Live instructions and facts", () => {
  it("adds the voice rules after the door's own instructions", () => {
    const instructions = withLiveVoicePolicy("You are a friendly food-choice assistant.");
    expect(instructions.startsWith("You are a friendly food-choice assistant.")).toBe(true);
    expect(instructions.endsWith(LIVE_VOICE_POLICY)).toBe(true);
    expect(LIVE_VOICE_POLICY).toMatch(/Never state a score or any other number the app did not give you/);
  });

  it("puts the food and the rule first, and has nothing to say with nothing on screen", () => {
    const facts = buildLiveFacts(
      { frameDataUrl: null, identifiedFood: null, flagTexts: ["High sodium"], compass: CHEERIOS, historyLine: "History." },
      "Honey Nut Cheerios"
    );
    expect(facts?.split("\n").slice(0, 2)).toEqual([
      "[camera context, not spoken by the user] Food on screen: Honey Nut Cheerios.",
      "Use these numbers exactly; do not recompute them."
    ]);
    expect(facts).toContain("Food Compass score: 58 out of 100");
    expect(facts?.endsWith("History.")).toBe(true);

    expect(buildLiveFacts({ frameDataUrl: null, identifiedFood: null, flagTexts: [] }, null)).toBeNull();
  });
});
