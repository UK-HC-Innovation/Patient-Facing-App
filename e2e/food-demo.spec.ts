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
  await expect(page.getByRole("button", { name: /Expand camera|Back to result|Tap start|Ask about/i })).toHaveCount(0);
  await expect(page.getByLabel("Describe a food or order")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Find score|Plot this order|Play voice example/i })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("plots Food Compass on X and calorie density on Y in one of four quadrants", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/food/demo");
  await confirmCameraCandidate(page);

  const chart = page.getByRole("region", { name: "Score and calories" });
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
  await expect(page.locator('[data-guidance-scope="general"]').first()).toContainText(
    "General nutrition advice — not based on your readings or health history."
  );
  await expect(page.locator('[data-guidance-scope="personalized"]')).toHaveCount(0);
  await expect(page.getByText(/Maria|Brent|blood pressure|lisinopril/i)).toHaveCount(0);
});

test("localizes the stateless camera-first flow in Spanish", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/food/demo?lang=es");
  await confirmCameraCandidate(page, "es");

  await expect(page.getByRole("heading", { name: "1 good choice" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cámara de alimentos" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Puntaje y calorías" })).toContainText("83");
  await expect(page.getByRole("textbox")).toHaveCount(0);
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
