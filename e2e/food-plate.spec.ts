import { expect, test, type Page } from "@playwright/test";

/**
 * One photo of a dinner, decomposed. The plate route is stubbed (it is the only paid call in
 * the flow); every score below still comes from the real ledger, because the correction chip
 * posts a food code to the live identify route and reads back what Tufts published.
 */

const quinoaScore = {
  fcs: 89,
  band: "encourage",
  tier: "T1",
  ambiguous: false,
  range: null,
  calorieDensity: { kcalPer100g: 120, band: "low" },
  domains: null,
  coverage: null
};

const appleScore = {
  fcs: 95,
  band: "encourage",
  tier: "T1",
  ambiguous: false,
  range: null,
  calorieDensity: { kcalPer100g: 52, band: "very_low" },
  domains: null,
  coverage: null
};

// Full literals on purpose: a new required field on CompassScore breaks this at runtime, not
// at compile time, so the fixture carries every key the client reads.
const quinoaNutrients = {
  desc: "Quinoa, no added fat",
  wweia: "Pasta, noodles, cooked grains",
  kcal: 120,
  protein: 4.38,
  carb: 21.21,
  sugar: 0.87,
  fiber: 2.8,
  fat: 1.91,
  sfa: 0.23,
  mufa: 0.526,
  pufa: 1.074,
  chol: 0,
  ca: 17,
  fe: 1.48,
  k: 171,
  na: 163
};

const appleNutrients = {
  desc: "Apple, raw",
  wweia: "Apples",
  kcal: 52,
  protein: 0.26,
  carb: 13.81,
  sugar: 10.39,
  fiber: 2.4,
  fat: 0.17,
  sfa: 0.028,
  mufa: 0.007,
  pufa: 0.051,
  chol: 0,
  ca: 6,
  fe: 0.12,
  k: 107,
  na: 1
};

const platePayload = {
  mode: "plate",
  items: [
    {
      kind: "match",
      match: {
        food: { code: "56204005", description: "Quinoa, no added fat", group: "1000_Grains" },
        tier: "T1",
        score: quinoaScore,
        nutrients: quinoaNutrients
      },
      candidates: [
        { code: "56204005", description: "Quinoa, no added fat", fcs: 89 },
        { code: "56204010", description: "Quinoa, fat added", fcs: 81 }
      ],
      proposedServings: 1.5,
      basis: "about two thirds of a cup"
    },
    {
      kind: "match",
      match: {
        food: { code: "63101000", description: "Apple, raw", group: "2000_Fruit" },
        tier: "T1",
        score: appleScore,
        nutrients: appleNutrients
      },
      candidates: [],
      proposedServings: 1,
      basis: "one small apple"
    }
  ]
};

async function stubPlateDoor(page: Page, plateBody: object = platePayload) {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "mock", reason: "provider_mock" })
    })
  );
  // Without this the Playwright web server's forced mock provider makes the live loop
  // provider-disarm, which is exactly the state that disables the scan button.
  await page.route("**/api/food/identify", async (route) => {
    const body = route.request().postDataJSON() as { image?: string };
    if (!body.image) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "match",
        match: {
          food: { code: "63107010", description: "Banana, raw", group: "2000_Fruit" },
          tier: "T1",
          score: {
            fcs: 83,
            band: "encourage",
            tier: "T1",
            ambiguous: false,
            range: null,
            calorieDensity: { kcalPer100g: 89, band: "low" },
            domains: null,
            coverage: null
          },
          alternatives: [],
          nutrients: null
        },
        candidates: []
      })
    });
  });
  await page.route("**/api/food/plate", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plateBody) })
  );
}

async function scan(page: Page) {
  // The camera reports "active" the moment its capture interval starts, half a second before
  // the first frame lands in the ring. A live verdict proves a frame exists to scan.
  await expect(page.getByTestId("food-verdict")).toContainText("Food Compass score", { timeout: 20_000 });
  await page.getByRole("button", { name: "Scan the plate" }).click();
}

test("turns one photo into two scored plate items with photo-estimate portions", async ({ page }) => {
  await stubPlateDoor(page);
  await page.goto("/food");
  await expect(page.getByRole("heading", { name: "Food Lens" })).toBeVisible();

  await scan(page);

  const plate = page.getByTestId("plate-card");
  await expect(plate.getByTestId("plate-item")).toHaveCount(2);
  // The remove control names its own item, so this reads the plate row and never the chip
  // beside it that happens to carry the same words.
  await expect(plate.getByRole("button", { name: "Remove Quinoa, no added fat", exact: true })).toBeVisible();
  await expect(plate.getByRole("button", { name: "Remove Apple, raw", exact: true })).toBeVisible();

  // The portion is the model's guess and says so; the score beside it is published.
  await expect(plate.getByText("Photo estimate: about two thirds of a cup")).toBeVisible();
  await expect(plate.getByText("Photo estimate: one small apple")).toBeVisible();
  await expect(plate.getByText("1.5 serving(s)")).toBeVisible();
  await expect(plate.getByText("1 serving(s)")).toBeVisible();
  await expect(plate.getByText("Food Compass 89")).toBeVisible();
  await expect(plate.getByText("Food Compass 95")).toBeVisible();
});

test("swaps a scanned item for a candidate row and logs the plate under one meal id", async ({ page }) => {
  await stubPlateDoor(page);
  await page.goto("/food");
  await scan(page);

  const plate = page.getByTestId("plate-card");
  await expect(plate.getByTestId("plate-item")).toHaveCount(2);
  await expect(plate.getByTestId("plate-item-candidates")).toHaveCount(1);

  // The chip re-scores against the real ledger: 81 is the published value for the fat-added
  // row, and it arrives without a model call.
  await plate.getByRole("button", { name: "Quinoa, fat added", exact: true }).click();
  await expect(plate.getByRole("button", { name: "Remove Quinoa, fat added", exact: true })).toBeVisible();
  await expect(plate.getByText("Food Compass 81")).toBeVisible();
  await expect(plate.getByTestId("plate-item-candidates")).toHaveCount(0);
  // A swap corrects the food, never the portion the photo proposed.
  await expect(plate.getByText("1.5 serving(s)")).toBeVisible();

  await page.getByRole("button", { name: "Log plate" }).click();

  const entries = await page.evaluate(() => {
    const raw = window.localStorage.getItem("home-health-ai-ownership-state");
    const parsed = raw ? (JSON.parse(raw) as { mealLog?: Array<Record<string, unknown>> }) : null;
    return (parsed?.mealLog ?? []).slice(-2);
  });

  expect(entries).toHaveLength(2);
  expect(entries[0].mealId).toBeTruthy();
  expect(entries[1].mealId).toBe(entries[0].mealId);
  // 20.22 g of carbs per 100 g at 1.5 servings, and 13.81 at 1: scaled once, from the
  // unscaled ledger row, at log time.
  expect((entries[0].food as { nutrition: { carbsG: number } }).nutrition.carbsG).toBe(30.3);
  expect(entries[0].servings).toBe(1.5);
  expect((entries[1].food as { nutrition: { carbsG: number } }).nutrition.carbsG).toBe(13.8);
  expect(entries[0].compassScore).toMatchObject({ fcs: 81, tier: "T1" });
  expect(entries[1].compassScore).toMatchObject({ fcs: 95, tier: "T1" });
});

test("names what it skipped and offers rows for what it could not place", async ({ page }) => {
  await stubPlateDoor(page, {
    mode: "plate",
    items: [
      { kind: "carve_out", name: "water", reason: "zero_calorie" },
      {
        kind: "none",
        name: "banana",
        candidates: [
          { code: "63107010", description: "Banana, raw", fcs: 83 },
          { code: "63107110", description: "Banana, baked", fcs: 71 }
        ]
      }
    ]
  });
  await page.goto("/food");
  await scan(page);

  await expect(page.getByText("Skipped: water (not scored)")).toBeVisible();

  const scanBlock = page.getByTestId("plate-scan");
  await scanBlock.getByRole("button", { name: "Banana, raw", exact: true }).click();

  const plate = page.getByTestId("plate-card");
  await expect(plate.getByTestId("plate-item")).toHaveCount(1);
  await expect(plate.getByText("Food Compass 83")).toBeVisible();
});

test("says the plate was empty instead of inventing an item", async ({ page }) => {
  await stubPlateDoor(page, { mode: "none" });
  await page.goto("/food");
  await scan(page);

  await expect(
    page.getByText("No separate foods found. Get the whole plate in view and try again.")
  ).toBeVisible();
  await expect(page.getByTestId("plate-card")).toHaveCount(0);
});

test("says the scan needs a key rather than failing silently", async ({ page }) => {
  await stubPlateDoor(page, { mode: "unconfigured" });
  await page.goto("/food");
  await scan(page);

  await expect(page.getByText("Plate scan needs the live camera key.")).toBeVisible();
  await expect(page.getByTestId("plate-card")).toHaveCount(0);
});

test("corrects a photo portion in one tap and then stops offering to", async ({ page }) => {
  await stubPlateDoor(page);
  await page.goto("/food");
  await scan(page);

  const plate = page.getByTestId("plate-card");
  const quinoa = plate.getByTestId("plate-item").first();
  await expect(quinoa.getByText("1.5 serving(s)")).toBeVisible();

  await quinoa.getByRole("button", { name: "Half that", exact: true }).click();
  // Halving 1.5 lands on 0.75, which the servings label rounds for display only.
  await expect(quinoa.getByText("0.8 serving(s)")).toBeVisible();
  // The portion is the patient's now, so the app stops second-guessing it.
  await expect(quinoa.getByTestId("plate-item-portion-chips")).toHaveCount(0);
  await expect(plate.getByTestId("plate-item-portion-chips")).toHaveCount(1);
});
