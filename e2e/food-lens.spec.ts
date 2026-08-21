import { expect, test } from "@playwright/test";

const SOUP_BARCODE = "051000012616";
const OATS_BARCODE = "030000010204";

async function stubFoodLens(page: import("@playwright/test").Page) {
  await page.addInitScript((barcode) => {
    if (!window.sessionStorage.getItem("__e2e_cleared")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("__e2e_cleared", "1");
    }
    (window as unknown as { __e2eBarcode?: string }).__e2eBarcode = barcode;
    class FakeBarcodeDetector {
      static getSupportedFormats() {
        return Promise.resolve(["ean_13", "upc_a"]);
      }
      detect() {
        const current = (window as unknown as { __e2eBarcode?: string }).__e2eBarcode;
        return Promise.resolve(current ? [{ rawValue: current, format: "ean_13" }] : []);
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeBarcodeDetector;
  }, SOUP_BARCODE);

  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "mock", reason: "provider_mock" }) })
  );
}

test("builds and logs a two-item plate with one shared meal id", async ({ page }) => {
  await stubFoodLens(page);
  await page.goto("/food");

  await expect(page.getByRole("heading", { name: /Chicken Noodle Soup/ })).toBeVisible();
  await expect(page.getByText("Food Compass score")).toBeVisible();
  await page.getByRole("button", { name: "Add to plate" }).click();

  await page.evaluate((barcode) => {
    (window as unknown as { __e2eBarcode?: string }).__e2eBarcode = barcode;
  }, OATS_BARCODE);
  // The scanner requires two consecutive 500 ms detections before changing.
  await expect(page.getByRole("heading", { name: /Old Fashioned Oats/ })).toBeVisible();
  await expect(page.getByText("Food Compass score")).toBeVisible();
  await page.getByRole("button", { name: "Add to plate" }).click();

  const plate = page.getByTestId("plate-card");
  await expect(plate.getByTestId("plate-item")).toHaveCount(2);
  await expect(plate.getByText("Plate average")).toBeVisible();
  await page.getByRole("button", { name: /Increase servings for Campbell's Condensed Chicken Noodle Soup/ }).click();
  await expect(plate.getByText("2 serving(s)")).toBeVisible();
  await page.getByRole("button", { name: "Log plate" }).click();

  await expect(page.getByRole("listitem").filter({ hasText: "Campbell's Condensed Chicken Noodle Soup" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Quaker Old Fashioned Oats" })).toBeVisible();
  const entries = await page.evaluate(() => {
    const raw = window.localStorage.getItem("home-health-ai-ownership-state");
    const parsed = raw ? (JSON.parse(raw) as { mealLog?: Array<Record<string, unknown>> }) : null;
    return (parsed?.mealLog ?? []).slice(-2);
  });
  expect(entries).toHaveLength(2);
  expect(entries[0].mealId).toBeTruthy();
  expect(entries[1].mealId).toBe(entries[0].mealId);
  expect((entries[0].food as { nutrition: { carbsG: number } }).nutrition.carbsG).toBe(16);
  expect(entries[0].servings).toBe(2);
  expect((entries[1].food as { nutrition: { carbsG: number } }).nutrition.carbsG).toBe(27);
});

async function stubEmptyFoodLens(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "mock", reason: "provider_mock" }) })
  );
  await page.route("**/api/food/identify", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "none", candidates: [] }) })
  );
}

test("labels the personalized route without inventing a current-food recommendation", async ({ page }) => {
  await stubEmptyFoodLens(page);
  await page.goto("/food");

  await expect(page.getByRole("heading", { name: "Food Lens" })).toBeVisible();
  await expect(page.locator('[data-guidance-scope="personalized"]').first()).toContainText(
    "considers your recent readings and health profile"
  );
  await expect(page.getByText("Tap start and describe your food.", { exact: true })).toBeVisible();
  await expect(page.getByText("Tap start to talk about this food.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "This food" })).toHaveCount(0);
  await expect(page.getByText(/Your recent readings are trending up/i)).toHaveCount(0);
  await expect(page.locator('[data-guidance-scope="general"]')).toHaveCount(0);
});

test("scans a food, asks a typed question, logs the meal, and persists it", async ({ page }) => {
  await stubFoodLens(page);

  await page.goto("/today");
  await page.goto("/food");
  await expect(page.getByRole("heading", { name: "Food Lens" })).toBeVisible();

  await expect(page.getByRole("heading", { name: /Chicken Noodle Soup/ })).toBeVisible();
  await expect(page.getByText(/mg sodium/)).toBeVisible();
  await expect(page.locator('[data-guidance-scope="personalized"]').first()).toBeVisible();

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByLabel("Ask about this food…").fill("Can I have this for lunch?");
  await page.getByRole("button", { name: "Ask" }).click();

  await expect(page.getByText(/Chicken Noodle Soup/).first()).toBeVisible();
  await expect(page.getByText(/890/).first()).toBeVisible();

  // spec 23: the Food Compass score sits above the flag chips, badged as a label estimate.
  await expect(page.getByText("Food Compass score")).toBeVisible();
  await expect(page.locator('[data-guidance-scope="general"]')).toContainText("Food Compass only");
  // Shown twice on purpose: the viewfinder badge and the score row on the card.
  await expect(page.getByText("Estimate from label")).toHaveCount(2);
  await expect(page.getByText("Better options")).toBeVisible();

  await page.getByRole("button", { name: "Log this" }).click();
  await expect(page.getByText("Added to your meals")).toBeVisible();

  // and the logged entry carries it, so a clinician-facing view can read it back
  const logged = await page.evaluate(() => {
    const raw = window.localStorage.getItem("home-health-ai-ownership-state");
    const parsed = raw ? (JSON.parse(raw) as { mealLog?: Array<Record<string, unknown>> }) : null;
    const entries = parsed?.mealLog ?? [];
    return entries[entries.length - 1]?.compassScore ?? null;
  });
  expect(logged).toMatchObject({ tier: "T2" });
  expect(["encourage", "moderate", "minimize"]).toContain((logged as { band: string }).band);
  expect(typeof (logged as { fcs: number }).fcs).toBe("number");

  await expect(page.getByRole("listitem").filter({ hasText: "Campbell's Condensed Chicken Noodle Soup" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Campbell's Condensed Chicken Noodle Soup" })).toBeVisible();

  await page.goto("/chat");
  await expect(page.getByText(/Chicken Noodle Soup/).first()).toBeVisible();
});

test("keeps existing state when migrating a pre-mealLog save", async ({ page }) => {
  await stubFoodLens(page);
  await page.addInitScript(() => {
    const legacy = {
      patient: {
        id: "patient-1",
        name: "Legacy Patient",
        preferredName: "Legacy",
        language: "en",
        primaryClinicName: "Bluegrass Primary Care",
        primaryClinicPhone: "555-0142"
      },
      carePlan: {
        id: "plan-1",
        patientId: "patient-1",
        condition: "hypertension",
        plainLanguageSummary: "Keep blood pressure in range.",
        goals: [],
        dailyActions: [],
        callThresholdSystolic: 160,
        callThresholdDiastolic: 100,
        thresholdSource: "clinician_authored",
        warningSymptoms: [],
        nextVisitReason: "Review readings."
      },
      medications: [],
      readings: [
        {
          id: "legacy-reading",
          patientId: "patient-1",
          systolic: 137,
          diastolic: 86,
          pulse: 70,
          measuredAt: "2026-07-01T07:00:00.000Z",
          contexts: ["morning"],
          note: ""
        }
      ],
      tasks: [],
      contextItems: [],
      extractedFacts: [],
      aiMessages: [],
      auditEvents: []
    };
    window.localStorage.setItem("home-health-ai-ownership-state", JSON.stringify(legacy));
  });

  await page.goto("/numbers");
  await expect(page.getByText("137/86")).toBeVisible();

  await page.goto("/food");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByLabel("Ask about this food…").fill("Is this okay?");
  await page.getByRole("button", { name: "Ask" }).click();
  await page.getByRole("button", { name: "Log this" }).click();
  await expect(page.getByText("Added to your meals")).toBeVisible();
});
