import { expect, test } from "@playwright/test";

const SOUP_BARCODE = "051000012616";
const OATS_BARCODE = "030000010204";
const UNKNOWN_BARCODE = "000000000099";

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

async function confirmBarcode(page: import("@playwright/test").Page) {
  const useProduct = page.getByRole("button", { name: "Use this product" });
  await expect(useProduct).toBeVisible();
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await useProduct.click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
}

test("builds and logs a two-item plate with one shared meal id", async ({ page }) => {
  await stubFoodLens(page);
  await page.goto("/food");
  await confirmBarcode(page);

  await expect(page.getByTestId("food-verdict")).toContainText("Chicken Noodle Soup");
  await expect(page.getByTestId("food-verdict")).toContainText("Food Compass score");
  await page.getByRole("button", { name: "Add to plate" }).click();

  // A plate of one is still a published score with its band, not an average.
  const onePlate = page.getByTestId("plate-card");
  await expect(onePlate.getByTestId("plate-item")).toHaveCount(1);
  await expect(onePlate.getByText(/average/i)).toHaveCount(0);
  await expect(onePlate.getByText(/Food Compass \d+/)).toBeVisible();

  await page.evaluate((barcode) => {
    (window as unknown as { __e2eBarcode?: string }).__e2eBarcode = barcode;
  }, OATS_BARCODE);
  // Clicking "Add to plate" scrolled the viewfinder away, and the verdict stops printing
  // the food's name while the sticky strip is printing it. Back to the top to read it.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  // The scanner requires two consecutive 500 ms detections before changing.
  await confirmBarcode(page);
  await expect(page.getByTestId("food-verdict")).toContainText("Old Fashioned Oats");
  await expect(page.getByTestId("food-verdict")).toContainText("Food Compass score");
  await page.getByRole("button", { name: "Add to plate" }).click();

  const plate = page.getByTestId("plate-card");
  await expect(plate.getByTestId("plate-item")).toHaveCount(2);
  // At two the headline changes meaning, not just value: label and caveat both switch.
  await expect(plate.getByText("Plate average · 2 items")).toBeVisible();
  await expect(plate.getByText("Average of the items below, weighted by calories.")).toBeVisible();
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

async function stubUnknownBarcode(page: import("@playwright/test").Page) {
  await page.addInitScript((barcode) => {
    window.localStorage.clear();
    class FakeBarcodeDetector {
      static getSupportedFormats() {
        return Promise.resolve(["ean_13", "upc_a"]);
      }
      detect() {
        return Promise.resolve([{ rawValue: barcode, format: "ean_13" }]);
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeBarcodeDetector;
  }, UNKNOWN_BARCODE);
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "mock", reason: "provider_mock" })
    })
  );
  await page.route("**/api/food/lookup?*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ found: false }) })
  );
}

test("hides label-photo scoring when the provider probe is mocked", async ({ page }) => {
  await stubUnknownBarcode(page);
  const packageAssets: string[] = [];
  const packageApiRequests: string[] = [];
  page.on("request", (request) => {
    const url = decodeURIComponent(request.url());
    if (/food-package-scan/iu.test(url)) packageAssets.push(url);
    if (/\/api\/food\/package(?:\/|\?|$)/u.test(new URL(url).pathname)) {
      packageApiRequests.push(url);
    }
  });
  await page.goto("/food");

  await expect(page.getByLabel("Food camera").getByText(UNKNOWN_BARCODE, { exact: true })).toBeVisible();
  await page.waitForTimeout(750);
  await expect(page.getByText(/not in the product databases/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan a package" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Read the Nutrition Facts label" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Nutrition label photo" })).toHaveCount(0);
  expect(packageAssets).toEqual([]);
  expect(packageApiRequests).toEqual([]);
});

test("labels the personalized route without inventing a current-food recommendation", async ({ page }) => {
  await stubEmptyFoodLens(page);
  await page.goto("/food");

  await expect(page.getByRole("heading", { name: "Food Lens" })).toBeVisible();
  await expect(page.locator('[data-guidance-scope="personalized"]').first()).toContainText(
    "Based on your recent readings and health history."
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
  await confirmBarcode(page);

  await expect(page.getByTestId("food-verdict")).toContainText("Chicken Noodle Soup");
  await expect(page.getByText(/mg sodium/)).toBeVisible();
  await expect(page.locator('[data-guidance-scope="personalized"]').first()).toBeVisible();

  await page.getByLabel("Ask about this food…").fill("Can I have this for lunch?");
  await page.getByRole("button", { name: "Ask" }).click();

  // The transcript now lives in the pinned voice bar and grows upward from it.
  await page.getByRole("button", { name: /Show the conversation/ }).click();
  await expect(page.getByText("Can I have this for lunch?", { exact: true })).toBeVisible();
  await expect(page.getByText(/has 890 mg of sodium/)).toBeVisible();
  await page.getByRole("button", { name: /Hide the conversation/ }).click();

  // spec 23: the Food Compass score sits above the flag chips, badged as a label estimate.
  await expect(page.getByTestId("food-verdict")).toContainText("Food Compass score");
  await expect(page.locator('[data-guidance-scope="general"]')).toContainText(
    "General nutrition advice — not based on your readings or health history."
  );
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
  await confirmBarcode(page);
  await page.getByLabel("Ask about this food…").fill("Is this okay?");
  await page.getByRole("button", { name: "Ask" }).click();
  // The published alternatives arrive last and move everything below them, so wait for the
  // slot to land before reaching for an action underneath it.
  await expect(page.getByTestId("food-alternatives")).toBeVisible();
  await page.getByRole("button", { name: "Log this" }).click();
  await expect(page.getByText("Added to your meals")).toBeVisible();
});
