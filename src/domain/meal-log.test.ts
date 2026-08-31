import { describe, expect, it } from "vitest";
import { mealLogEntrySchema } from "./schemas";
import { buildMealLogEntry } from "./meal-log";
import type { FoodFlag } from "./food-flags";
import type { IdentifiedFood } from "./types";

const soup: IdentifiedFood = {
  id: "051000012616",
  barcode: "051000012616",
  name: "Chicken Noodle Soup",
  brand: "Campbell's",
  category: "Soups",
  nutrition: null,
  source: "barcode_seed",
  ingredientText: null
};

const flags: FoodFlag[] = [{ id: "nutrient-sodiumMg", severity: "warning", text: "890 mg sodium — 59% of your 1500 mg daily limit" }];

describe("buildMealLogEntry", () => {
  it("builds a schema-valid entry from a resolved food", () => {
    const entry = buildMealLogEntry({
      patientId: "patient-1",
      food: soup,
      flags,
      lastAssistantText: "That soup is high in sodium.",
      language: "en",
      now: new Date("2026-07-05T12:00:00.000Z"),
      id: "meal-1"
    });

    expect(entry.food.name).toBe("Chicken Noodle Soup");
    expect(entry.flags).toEqual([flags[0].text]);
    expect(entry.assistantSummary).toBe("That soup is high in sodium.");
    expect(entry.servings).toBe(1);
    expect(mealLogEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("does not persist OCR-derived package ingredient text", () => {
    const entry = buildMealLogEntry({
      patientId: "p1",
      food: {
        ...soup,
        source: "label_vision",
        ingredientText: "soybeans, sunflower oil, ranch seasoning"
      },
      flags: [],
      lastAssistantText: null,
      language: "en"
    });

    expect(entry.food.ingredientText).toBeNull();
  });

  it("uses a placeholder food when none was identified", () => {
    const entry = buildMealLogEntry({
      patientId: "patient-1",
      food: null,
      flags: [],
      lastAssistantText: null,
      language: "en",
      id: "meal-2"
    });

    expect(entry.food.source).toBe("vision_estimate");
    expect(entry.food.name).toBe("This food");
    expect(entry.assistantSummary).toBe("");
    expect(mealLogEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("round-trips legacy-absent and present integrity fields", () => {
    const legacyEntry = {
      id: "meal-legacy",
      patientId: "patient-1",
      loggedAt: "2026-07-05T12:00:00.000Z",
      food: soup,
      flags: [],
      assistantSummary: ""
    };
    const currentEntry = {
      ...buildMealLogEntry({
        patientId: "patient-1",
        food: soup,
        flags: [],
        lastAssistantText: null,
        language: "en",
        servings: 1.5,
        mealId: "plate-1"
      }),
      editedAt: "2026-07-05T13:00:00.000Z"
    };

    expect(mealLogEntrySchema.parse(legacyEntry)).toEqual(legacyEntry);
    expect(mealLogEntrySchema.parse(currentEntry)).toMatchObject({
      servings: 1.5,
      mealId: "plate-1",
      editedAt: "2026-07-05T13:00:00.000Z"
    });
  });

  it("trims a long summary to 240 characters with an ellipsis", () => {
    const entry = buildMealLogEntry({
      patientId: "patient-1",
      food: soup,
      flags: [],
      lastAssistantText: "word ".repeat(100),
      language: "en",
      id: "meal-3"
    });

    expect(entry.assistantSummary.length).toBeLessThanOrEqual(241);
    expect(entry.assistantSummary.endsWith("…")).toBe(true);
  });
});

describe("buildMealLogEntry — Food Compass score", () => {
  it("carries the score when one was computed", () => {
    const entry = buildMealLogEntry({
      patientId: "patient-1",
      food: null,
      flags: [],
      lastAssistantText: null,
      language: "en",
      compassScore: { fcs: 19, band: "minimize", tier: "T2" }
    });
    expect(entry.compassScore).toEqual({ fcs: 19, band: "minimize", tier: "T2" });
    expect(mealLogEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("omits the key entirely when there is no score, so older entries stay valid", () => {
    const entry = buildMealLogEntry({
      patientId: "patient-1",
      food: null,
      flags: [],
      lastAssistantText: null,
      language: "en"
    });
    expect("compassScore" in entry).toBe(false);
    expect(mealLogEntrySchema.safeParse(entry).success).toBe(true);
  });
});
