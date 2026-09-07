import { expect, test, type Page } from "@playwright/test";

const bananaMatch = {
  food: { code: "63107010", description: "Banana, raw", group: "2000_Fruit" },
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
};

const doritosMatch = {
  ...bananaMatch,
  food: {
    code: "54401110",
    description: "Tortilla chips, nacho cheese flavor (Doritos)",
    group: "9000_SavorySweet"
  },
  score: {
    ...bananaMatch.score,
    fcs: 19,
    band: "minimize"
  }
};

async function stubRealtime(page: Page) {
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "mock", reason: "provider_mock" })
    })
  );
}

async function stubCameraMatch(page: Page, match = bananaMatch) {
  await page.route("**/api/food/identify", async (route) => {
    const body = route.request().postDataJSON() as { image?: string; foodId?: string };
    if (body.foodId) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mode: "match", match, candidates: [] })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "candidate", candidate: { food: match.food }, candidates: [] })
    });
  });
}

async function confirmCameraCandidate(page: Page, language: "en" | "es" = "en") {
  await page.getByRole("button", { name: language === "es" ? "Toca para escanear" : "Tap to scan" }).click();
  await page.getByRole("button", { name: language === "es" ? "Sí, usar esta comida" : "Yes, use this food" }).click();
}

/**
 * Spec 29 P8 (critique N5): the answer is the score, the verdict, one alternative and one
 * button. The chart, the score drivers, the "we heard" block, the flags, the day totals,
 * the nutrient tiles and the meal log all moved under one disclosure, so a test that reads
 * any of them has to open it first.
 */
async function openMoreAboutThisFood(page: Page, language: "en" | "es" = "en") {
  await page.getByText(language === "es" ? "Más sobre esta comida" : "More about this food").click();
}

/**
 * Spec 29 P3 (critique F5, G1): the public door's ask box. `?lang=es` is read after mount,
 * so the label arrives a tick after the page does.
 */
function askBox(page: Page, language: "en" | "es" = "en") {
  return page.getByLabel(language === "es" ? "Pregunta sobre esta comida…" : "Ask about this food…");
}

test("keeps the camera in place and starts the food conversation automatically", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/food/demo");
  await confirmCameraCandidate(page);

  // The verdict says band, sentence and number; the food name rides its subline.
  await expect(page.getByTestId("food-verdict")).toContainText("Banana, raw", { timeout: 10_000 });
  await expect(page.getByRole("region", { name: "Food camera" })).toBeVisible();
  await expect(page.getByRole("log")).toContainText("1 good choice: I see Banana, raw");

  await expect(page.getByText("Camera collapsed")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Expand camera|Back to result|Tap start/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Find score|Plot this order|Play voice example/i })).toHaveCount(0);

  // Spec 29 P3, inverted from spec 26: the public door now carries the same ask box the
  // personal door has. Without it a phone that said no to the camera had no way in at all
  // (critique F5, G1), which is the single thing that stopped Brenda opening the link her
  // nurse sent. One box, not two, and not a hidden one.
  await expect(askBox(page)).toBeVisible();
  await expect(page.getByRole("region", { name: "Voice" }).getByRole("textbox")).toHaveCount(1);

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("detects a packaged-food barcode on the public door and scores it only after confirmation", async ({ page }) => {
  const barcode = "028400090896";
  const imageRequests: string[] = [];
  const packageRequests: string[] = [];
  const scoreRequests: string[] = [];
  await stubRealtime(page);
  await page.addInitScript((detectedBarcode) => {
    class TestBarcodeDetector {
      async detect() {
        return [{ rawValue: detectedBarcode }];
      }
    }
    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      value: TestBarcodeDetector
    });
  }, barcode);
  await page.route("**/api/food/lookup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        found: true,
        food: {
          id: barcode,
          barcode,
          name: "Nacho Cheese Flavored Tortilla Chips",
          brand: "Doritos",
          category: "Snacks",
          nutrition: {
            servingSize: "1 oz (28 g)",
            calories: 150,
            sodiumMg: 210,
            potassiumMg: 50,
            totalSugarsG: 1,
            addedSugarsG: 0,
            saturatedFatG: 1,
            fiberG: 1,
            proteinG: 2,
            carbsG: 18,
            totalFatG: 8,
            monoFatG: null,
            polyFatG: null,
            transFatG: 0,
            cholesterolMg: 0,
            calciumMg: null,
            ironMg: null,
            servingGrams: 28,
            basis: "per_serving"
          },
          source: "barcode_off",
          ingredientText: null
        }
      })
    });
  });
  await page.route("**/api/food/identify", async (route) => {
    const body = route.request().postDataJSON() as {
      image?: string;
      text?: string;
      foodId?: string;
      requireConfirmation?: boolean;
    };
    if (body.image) imageRequests.push(body.image);
    if (body.requireConfirmation === true) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mode: "candidate", candidate: { food: doritosMatch.food } })
      });
      return;
    }
    if (body.foodId) scoreRequests.push(body.foodId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "match", match: doritosMatch, candidates: [] })
    });
  });
  page.on("request", (request) => {
    if (/\/api\/food\/package(?:\/|\?|$)/u.test(new URL(request.url()).pathname)) {
      packageRequests.push(request.url());
    }
  });

  await page.goto("/food/demo");
  await page.getByRole("button", { name: "Tap to scan" }).click();

  const review = page.getByRole("region", { name: "Package scan" });
  await expect(review).toContainText("Barcode found: Doritos Nacho Cheese");
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  expect(imageRequests).toEqual([]);
  expect(packageRequests).toEqual([]);

  await review.getByRole("button", { name: "Use this product" }).click();

  const identityReview = page.getByTestId("food-identity-review");
  await expect(identityReview).toContainText("Tortilla chips, nacho cheese flavor (Doritos)");
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);

  await identityReview.getByRole("button", { name: "Yes, use this food" }).click();

  await expect(identityReview).toHaveCount(0);
  await expect(page.getByTestId("food-verdict")).toContainText("19");
  // Spec 29 dropped the quadrant chart from the public door, so the density that a label
  // gives exactly is read off the compact result region instead. What this still pins is
  // the point of the packaged-scan fix: a scanned label yields a real number, never the
  // unknown or estimated fallbacks that stand in when no label was read.
  const result = page.getByRole("region", { name: "Score for this food" });
  await expect(result).toContainText("5.4 kcal/g");
  await expect(result).not.toContainText("Calories per gram unknown");
  await expect(result).not.toContainText("Estimated calorie density");
  expect(scoreRequests).toEqual([doritosMatch.food.code]);
});

test("plots Food Compass on X and calorie density on Y in one of four quadrants", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/food/demo");

  const chart = page.getByRole("region", { name: "Score and calories" });
  // Spec 29 P8 item 3 (critique N3): axes, four quadrant labels and "down and to the right
  // is better" before there is anything to plot was most of the 64 words on the public
  // door's blank first screen. There is no chart until there is a food.
  await expect(chart).toHaveCount(0);

  await confirmCameraCandidate(page);
  await expect(page.getByTestId("food-verdict")).toContainText("Banana, raw", { timeout: 10_000 });

  // And once there is one, the chart is under the fold rather than between the score and
  // the alternatives (spec 29 P8 item 5, critique N5).
  await expect(chart).toBeHidden();
  await openMoreAboutThisFood(page);
  await expect(chart).toBeVisible({ timeout: 10_000 });

  const marker = page.getByTestId("nutrition-compass-marker");
  await expect(marker).toHaveAttribute("data-x-percent", "83");
  await expect(marker).toHaveAttribute("data-y-percent", "9.9");
  await expect(marker).toHaveAttribute("data-quadrant", "choose_often");
  await expect(chart).toContainText(
    "Banana, raw: scores 83 out of 100 · 0.89 calories per gram (89 per 100 g) · Choose often."
  );
  await chart.scrollIntoViewIfNeeded();
});

test("keeps a newly detected package authoritative over a late sort response", async ({ page }) => {
  const appleMatch = {
    ...bananaMatch,
    food: { code: "63101000", description: "Apple, raw", group: "2000_Fruit" },
    score: { ...bananaMatch.score, fcs: 75 }
  };
  await stubRealtime(page);
  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __refinementStarted?: boolean;
      __releaseRefinement?: () => void;
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string"
        ? JSON.parse(init.body) as { text?: string; preferLowerCalorieDensity?: boolean }
        : null;
      if (
        String(input).includes("/api/food/identify") &&
        body?.text &&
        body.preferLowerCalorieDensity === true
      ) {
        testWindow.__refinementStarted = true;
        return new Promise<Response>((resolve) => {
          testWindow.__releaseRefinement = () => resolve(new Response(JSON.stringify({
            mode: "match",
            match: {
              food: { code: "99999999", description: "Late stale result", group: "9999_Other" },
              score: {
                fcs: 1,
                band: "minimize",
                tier: "T1",
                ambiguous: false,
                range: null,
                calorieDensity: { kcalPer100g: 999, band: "high" },
                domains: null,
                coverage: null
              },
              alternatives: [],
              nutrients: null
            },
            candidates: []
          }), { status: 200, headers: { "Content-Type": "application/json" } }));
        });
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;

    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    let signatureSample = 0;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      const data = originalGetImageData.apply(this, args);
      data.data.fill(signatureSample++ % 2 === 0 ? 0 : 255);
      return data;
    };
  });

  let packageScene = false;
  let nextSceneIsApple = false;
  await page.route("**/api/food/identify", async (route) => {
    const body = route.request().postDataJSON() as { image?: string; foodId?: string };
    if (body.foodId) {
      const match = body.foodId === appleMatch.food.code ? appleMatch : bananaMatch;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mode: "match", match, candidates: [] })
      });
      return;
    }
    const response = packageScene
      ? { mode: "package" }
      : {
          mode: "candidate",
          candidate: { food: nextSceneIsApple ? appleMatch.food : bananaMatch.food },
          candidates: []
        };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(response) });
  });

  await page.goto("/food/demo");
  await confirmCameraCandidate(page);
  await expect(page.getByTestId("food-verdict")).toContainText("Banana, raw", { timeout: 10_000 });

  await page.getByRole("radio", { name: "Lowest calorie density first" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(
    (window as typeof window & { __refinementStarted?: boolean }).__refinementStarted
  ))).toBe(true);

  packageScene = true;
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(page.getByRole("region", { name: "Food camera" })).toBeInViewport();
  await page.getByRole("button", { name: "Tap to scan again" }).click();
  await expect(page.getByRole("region", { name: "This looks packaged" })).toBeVisible({ timeout: 12_000 });
  await page.evaluate(() => {
    (window as typeof window & { __releaseRefinement?: () => void }).__releaseRefinement?.();
  });
  await expect(page.getByRole("region", { name: "This looks packaged" })).toBeVisible();
  await expect(page.getByText("Late stale result")).toHaveCount(0);
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await expect(page.getByTestId("nutrition-compass-marker")).toHaveCount(0);

  packageScene = false;
  nextSceneIsApple = true;
  await page.getByRole("button", { name: "Scan again" }).evaluate((element) => (element as HTMLButtonElement).click());
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("button", { name: "Tap to scan" }).click();
  await expect(page.getByText(/I think this is Apple, raw/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Yes, use this food" }).click();
  await expect(page.getByTestId("food-verdict")).toContainText("Apple, raw", { timeout: 10_000 });
});

test("understands restaurant details spoken after the camera sees pizza", async ({ request }) => {
  const response = await request.post("/api/food/identify", {
    data: { text: "This came from Papa John's. It is a pepperoni and sausage pizza." }
  });
  expect(response.ok()).toBe(true);

  const json = (await response.json()) as {
    mode: string;
    match: {
      food: { code: string };
      score: { fcs: number };
      interpretation: { restaurant: string; toppings: string[] };
      provenance: { exact: boolean; note: string; unmatchedDetails: string[] };
    };
  };
  expect(json.mode).toBe("match");
  expect(json.match.food.code).toBe("58106540");
  expect(json.match.score.fcs).toBe(23);
  expect(json.match.interpretation).toMatchObject({
    restaurant: "Papa John's",
    toppings: ["pepperoni", "sausage"]
  });
  expect(json.match.provenance.exact).toBe(false);
  expect(json.match.provenance.note).toContain("not Papa John's nutrition");
  expect(json.match.provenance.unmatchedDetails).toContain("sausage-specific topping");
});

test("keeps general guidance explicit through the camera-first flow", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/food/demo");

  await expect(page.getByRole("heading", { name: "1 good choice" })).toBeVisible();
  await confirmCameraCandidate(page);
  await expect(page.getByTestId("food-verdict")).toContainText("Banana, raw", { timeout: 10_000 });

  // Spec 29 P8 item 4: one banner per page. The public door has no readings to be based
  // on, so the general line is the only one, and spec 29 P8 item 1 took the em dash out of
  // it (critique N2, N6).
  await expect(page.locator('[data-guidance-scope="general"]').first()).toContainText(
    "General nutrition advice. Not based on your readings or health history."
  );
  await expect(page.locator('[data-guidance-scope="personalized"]')).toHaveCount(0);
  await expect(page.getByText(/Maria|Brent|blood pressure|lisinopril/i)).toHaveCount(0);
});

test("localizes the stateless camera-first flow in Spanish", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/food/demo?lang=es");
  // Spec 29 P6: ?lang=es is read after mount, so the Spanish scan control is what says the
  // language arrived. Reading it during render was the hydration error on local and the
  // minified React #418 on Azure (critique G7).
  await expect(page.getByRole("region", { name: "Cámara de alimentos" })).toBeVisible();
  await confirmCameraCandidate(page, "es");

  await expect(page.getByRole("heading", { name: "1 good choice" })).toBeVisible();
  await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });
  await openMoreAboutThisFood(page, "es");
  await expect(page.getByRole("region", { name: "Puntaje y calorías" })).toContainText("83");

  // Spec 29 P3: the ask box is on this door now, in Spanish, and it is the only one.
  await expect(askBox(page, "es")).toBeVisible();
  await expect(page.getByRole("region", { name: "Voz" }).getByRole("textbox")).toHaveCount(1);

  // Spec 29 P6: one EN | Español control, in the header, and it switches without a reload.
  // Scoped to the brand block on purpose -- Next's dev-tools button also answers to "EN".
  await page.getByTestId("one-good-choice-brand").getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("region", { name: "Food camera" })).toBeVisible();
  await expect(askBox(page)).toBeVisible();
});

test("turns an image-only carve-out into a safe no-match without collapsing the camera", async ({ page }) => {
  await stubRealtime(page);
  await page.route("**/api/food/identify", async (route) => {
    const body = route.request().postDataJSON() as { image?: string };
    if (!body.image) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "carve_out", reason: "zero_calorie" })
    });
  });
  await page.goto("/food/demo");
  await page.getByRole("button", { name: "Tap to scan" }).click();

  await expect(page.getByRole("region", { name: "No match" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("region", { name: "Food camera" })).toBeVisible();
  await expect(page.getByText("Camera collapsed")).toHaveCount(0);
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await expect(page.getByTestId("nutrition-compass-marker")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log it anyway" })).toHaveCount(0);
});

/**
 * The public door moved to /food/demo in spec 26 P6. The old link is in the wild -- it was
 * shared outside the project -- so these are the assertions that say it never breaks.
 */
test("keeps the shared /compass link working, query string and all", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);

  const landed = await page.goto("/compass");
  expect(landed?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/food/demo");
  await expect(page.getByRole("region", { name: "Food camera" })).toBeVisible();

  // The language a recipient was sent in has to survive the hop, or a Spanish-speaking
  // reader lands on an English page.
  await page.goto("/compass?lang=es");
  const spanish = new URL(page.url());
  expect(spanish.pathname).toBe("/food/demo");
  expect(spanish.searchParams.get("lang")).toBe("es");
  await expect(page.getByRole("region", { name: "Cámara de alimentos" })).toBeVisible();
});

test("answers the old link with a permanent redirect, not a temporary one", async ({ request }) => {
  // 308, so caches and search engines are told the move is real.
  const response = await request.get("/compass", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/food/demo");
});
