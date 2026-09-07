import { expect, test } from "@playwright/test";

const SOUP_BARCODE = "051000012616";
const OATS_BARCODE = "030000010204";
const UNKNOWN_BARCODE = "000000000099";

test("Isopure stays confirmed after its barcode leaves and re-enters the camera", async ({ page }) => {
  await stubFoodLens(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    (window as unknown as { __e2eBarcode: string }).__e2eBarcode = "089094026219";
  });
  let lookupCalls = 0;
  await page.route("**/api/food/lookup", (route) => {
    if (route.request().postDataJSON().barcode !== "089094026219") return route.fallback();
    lookupCalls += 1;
    return route.fulfill({ json: {
      found: true,
      food: {
        id: "barcode:089094026219", barcode: "089094026219",
        name: "Protein Powder Drink Mix", brand: "Isopure", category: null,
        source: "barcode_off", ingredientText: null,
        nutrition: {
          servingSize: "1 scoop (31 g)", servingGrams: 31, basis: "per_serving",
          calories: 100, proteinG: 25, carbsG: 0, totalSugarsG: 0, addedSugarsG: 0,
          fiberG: 0, totalFatG: 0, saturatedFatG: 0, sodiumMg: 160, potassiumMg: null,
          monoFatG: null, polyFatG: null, transFatG: null, cholesterolMg: null,
          calciumMg: null, ironMg: null
        }
      }
    } });
  });
  await page.route("**/api/food/identify", (route) => route.fulfill({ json: {
    mode: "candidate",
    candidate: { food: { code: "92510610", description: "Lemonade-flavored drink, made from powdered mix, with sugar", group: "Beverages" } },
    candidates: []
  } }));
  await page.goto("/food");
  await confirmBarcode(page);
  const review = page.getByTestId("food-barcode-review");
  await expect(review).toContainText("Confirmed package: Isopure Protein Powder Drink Mix");
  await expect(page.getByTestId("food-verdict")).toContainText("Isopure");

  await page.evaluate(() => {
    (window as unknown as { __e2eBarcode: string }).__e2eBarcode = "";
  });
  // The reader drops a barcode after ten 500 ms frames without it.
  await page.waitForTimeout(5_500);
  await page.evaluate(() => {
    (window as unknown as { __e2eBarcode: string }).__e2eBarcode = "089094026219";
  });
  await page.waitForTimeout(1_500);
  await expect(review).toContainText("Confirmed package: Isopure Protein Powder Drink Mix");
  await expect(page.getByTestId("food-verdict")).toContainText("Isopure");
  await expect(page.getByTestId("food-identity-review")).toHaveCount(0);
  expect(lookupCalls).toBe(1);

  await page.getByRole("button", { name: "Scan another food" }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByLabel("Food camera")).toBeInViewport();
  await page.waitForTimeout(1_500);
  await expect(review).toHaveCount(0);
  await page.evaluate((barcode) => {
    (window as unknown as { __e2eBarcode: string }).__e2eBarcode = barcode;
  }, SOUP_BARCODE);
  await confirmBarcode(page);
  await expect(page.getByTestId("food-verdict")).toContainText("Chicken Noodle Soup");
});

test("rejecting a camera guess returns to the camera without immediately reopening it", async ({ page }) => {
  await stubFoodLens(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    (window as unknown as { __e2eBarcode: string }).__e2eBarcode = "";
  });
  await page.route("**/api/food/identify", (route) => route.fulfill({ json: {
    mode: "candidate",
    candidate: { food: { code: "92510610", description: "Lemonade-flavored drink", group: "Beverages" } },
    candidates: []
  } }));
  await page.goto("/food");
  // Nothing is sent until the person taps: no guess appears on its own.
  await expect(page.getByTestId("food-identity-review")).toHaveCount(0);
  await page.getByRole("button", { name: "Tap to scan" }).click();
  await expect(page.getByTestId("food-identity-review")).toContainText("Lemonade");
  await page.getByRole("button", { name: "No, scan again" }).click();
  await expect(page.getByTestId("food-identity-review")).toHaveCount(0);
  await expect(page.getByLabel("Food camera")).toBeInViewport();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("food-identity-review")).toHaveCount(0);
});

/**
 * Spec 29 P8: the answer is the score, the verdict, one alternative and one button. The
 * chart, the drivers, what we heard, the flags, the day totals, the nutrient tiles and the
 * meal log all moved behind one disclosure, so a barcode result is three screens instead of
 * ten and a half (critique N5). Anything under the fold has to be opened before it is read.
 */
async function openMoreAboutThisFood(page: import("@playwright/test").Page) {
  const details = page.locator("details").filter({ hasText: "More about this food" }).first();
  await expect(details).toBeVisible();
  if (await details.evaluate((element) => !(element as HTMLDetailsElement).open)) {
    await details.getByText("More about this food", { exact: true }).click();
  }
  await expect(details).toHaveJSProperty("open", true);
}

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

/**
 * A tap before the video has frames reads no barcode at all (`readyState < 2` is an early
 * null in `useBarcodeScan`), and the scan falls through to the image path. Nothing about
 * that is worth testing, so wait for the camera rather than race it.
 */
async function waitForCameraFrames(page: import("@playwright/test").Page) {
  await expect
    .poll(
      async () =>
        page.locator("video").first().evaluate((video) => (video as HTMLVideoElement).readyState),
      { timeout: 15_000 }
    )
    .toBeGreaterThanOrEqual(2);
}

async function confirmBarcode(page: import("@playwright/test").Page) {
  await waitForCameraFrames(page);
  await page.getByRole("button", { name: /Tap to scan(?: again)?/ }).click();
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

  // The meal log is under the fold now, so a logged plate is confirmed, then read.
  await openMoreAboutThisFood(page);
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
  // Cleared once per context, not once per navigation: a sample patient loaded from /menu
  // has to survive the walk to /food.
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("__e2e_cleared")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("__e2e_cleared", "1");
    }
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
  await page.route("**/api/food/lookup", (route) =>
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
  await page.getByRole("button", { name: "Tap to scan" }).click();

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

  // Spec 29 P2: a fresh phone is nobody. Nothing claims to know this person's readings, and
  // there are no meals they never logged.
  await expect(page.getByRole("heading", { name: "1 good choice" })).toBeVisible();
  await expect(page.locator('[data-guidance-scope="personalized"]')).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "Chicken Noodle Soup" })).toHaveCount(0);
  // No live provider on this build, so the bar says so instead of offering a mic that fails.
  await expect(page.getByText("Voice is off. Typed questions still work.")).toBeVisible();

  // The personalized label is earned, and only the one explicit control earns it.
  await page.goto("/menu");
  await page.getByRole("button", { name: "Load a sample patient (Brent)" }).click();
  await page.waitForURL("**/screening**");
  await page.goto("/food");

  await expect(page.locator('[data-guidance-scope="personalized"]').first()).toContainText(
    "Based on your recent readings and health history."
  );
  // One banner per page: the general line never doubles up with the personalized one.
  await expect(page.locator('[data-guidance-scope="general"]')).toHaveCount(0);
  await expect(page.getByText("Tap start to talk about this food.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "This food" })).toHaveCount(0);
  await expect(page.getByText(/Your recent readings are trending up/i)).toHaveCount(0);
});

test("scans a food, asks a typed question, logs the meal, and persists it", async ({ page }) => {
  await stubFoodLens(page);

  await page.goto("/today");
  await page.goto("/food");
  await expect(page.getByRole("heading", { name: "1 good choice" })).toBeVisible();
  await confirmBarcode(page);

  await expect(page.getByTestId("food-verdict")).toContainText("Chicken Noodle Soup");
  // spec 29 P8: the answer first. The sodium flag is real, and it is one tap down.
  await expect(page.getByText(/mg sodium/)).toBeHidden();
  await openMoreAboutThisFood(page);
  await expect(page.getByText("890 mg sodium, 59% of your 1500 mg daily limit")).toBeVisible();

  await page.getByLabel("Ask about this food…").fill("Can I have this for lunch?");
  await page.getByRole("button", { name: "Ask" }).click();

  // The transcript lives in the pinned voice bar and opens itself when the answer lands;
  // every persona in the critique typed into a panel that stayed shut.
  const voiceBar = page.getByRole("region", { name: "Voice" });
  // .first() because the question is currently echoed twice: the typed path appends the
  // patient line and the session it forwards to emits its own userTranscript for the same
  // text. Cosmetic, and reported rather than asserted as intended.
  await expect(voiceBar.getByText("Can I have this for lunch?", { exact: true }).first()).toBeVisible();
  await expect(voiceBar.getByText(/has 890 mg of sodium/)).toBeVisible();
  await voiceBar.getByRole("button", { name: /Hide the conversation/ }).click();

  // spec 23: the Food Compass score sits above the flag chips, badged as a label estimate.
  await expect(page.getByTestId("food-verdict")).toContainText("Food Compass score");
  // Nobody is Brent, so nothing over the camera claims to know this person's readings and
  // the banner at the bottom is the general one, in the em-dash-free copy.
  await expect(
    page.getByRole("region", { name: "Food camera" }).locator('[data-guidance-scope="personalized"]')
  ).toHaveCount(0);
  await expect(page.locator('[data-guidance-scope="general"]').first()).toContainText(
    "General nutrition advice. Not based on your readings or health history."
  );
  // Shown twice on purpose: the viewfinder badge and the score row on the card.
  await expect(page.getByText("Estimate from label")).toHaveCount(2);
  // Package names alone cannot establish comparable catalogue foods.
  await expect(page.getByText("Better options")).toHaveCount(0);

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

  await openMoreAboutThisFood(page);
  await expect(page.getByRole("listitem").filter({ hasText: "Campbell's Condensed Chicken Noodle Soup" })).toBeVisible();

  await page.reload();
  await openMoreAboutThisFood(page);
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
  await expect(page.getByTestId("food-alternatives")).toHaveCount(0);
  await page.getByRole("button", { name: "Log this" }).click();
  await expect(page.getByText("Added to your meals")).toBeVisible();
});
