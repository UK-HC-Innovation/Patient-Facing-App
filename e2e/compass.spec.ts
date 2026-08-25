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
    const body = route.request().postDataJSON() as { image?: string };
    if (!body.image) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "match", match })
    });
  });
}

test("keeps the camera in place and starts the food conversation automatically", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/compass");

  // The verdict says band, sentence and number; the food name rides its subline.
  await expect(page.getByTestId("food-verdict")).toContainText("Banana, raw", { timeout: 10_000 });
  await expect(page.getByRole("region", { name: "Food camera" })).toBeVisible();
  await expect(page.getByRole("log")).toContainText("Food Lens: I see Banana, raw");
  await expect(page.getByText("Scripted fallback for the functional prototype.")).toBeVisible();

  await expect(page.getByText("Camera collapsed")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Expand camera|Back to result|Tap start|Ask about/i })).toHaveCount(0);
  await expect(page.getByLabel("Describe a food or order")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Find score|Plot this order|Play voice example/i })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("plots Food Compass on X and calorie density on Y in one of four quadrants", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/compass");

  const chart = page.getByRole("region", { name: "Food Compass score vs calorie density" });
  await expect(chart).toContainText("X: Food Compass score · Y: calorie density (kcal/g)");
  await expect(chart).toContainText("The four quadrants combine two separate measures");

  const marker = page.getByTestId("nutrition-compass-marker");
  await expect(marker).toHaveAttribute("data-x-percent", "83");
  await expect(marker).toHaveAttribute("data-y-percent", "9.9");
  await expect(marker).toHaveAttribute("data-quadrant", "choose_often");
  await expect(chart).toContainText(
    "Banana, raw: 83 / 100 Food Compass score · 0.89 kcal/g (89 kcal / 100 g) · Choose often quadrant."
  );
  await chart.scrollIntoViewIfNeeded();
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
  await page.goto("/compass");

  await expect(page.getByRole("heading", { name: "Food Lens functional prototype" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Prototype flow" })).toContainText(
    "1Point the camera2Talk naturally3Compare options"
  );
  await expect(page.getByLabel("Guidance source").first()).toContainText("General nutrition: Food Compass only");
  await expect(page.locator('[data-guidance-scope="personalized"]')).toHaveCount(0);
  await expect(page.getByText(/Maria|Brent|blood pressure|lisinopril/i)).toHaveCount(0);
});

test("localizes the stateless camera-first flow in Spanish", async ({ page }) => {
  await stubRealtime(page);
  await stubCameraMatch(page);
  await page.goto("/compass?lang=es");

  await expect(page.getByRole("heading", { name: "Prototipo funcional de Lente de Comida" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cámara de alimentos" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Flujo del prototipo" })).toContainText(
    "1Apunta la cámara2Habla naturalmente3Compara opciones"
  );
  await expect(
    page.getByRole("region", { name: "Puntaje Food Compass frente a densidad calórica" })
  ).toContainText("83");
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("shows a carve-out without collapsing the camera or inventing a score", async ({ page }) => {
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
  await page.goto("/compass");

  await expect(page.getByRole("region", { name: "Food result" }).getByText(/Water is the best choice there is/)).toBeVisible({
    timeout: 10_000
  });
  await expect(page.getByRole("region", { name: "Food camera" })).toBeVisible();
  await expect(page.getByText("Camera collapsed")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Food result" }).getByText("Food Compass score", { exact: true })
  ).toHaveCount(0);
  await expect(page.getByTestId("nutrition-compass-marker")).toHaveCount(0);
});
