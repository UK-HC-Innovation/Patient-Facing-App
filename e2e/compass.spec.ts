import { expect, test } from "@playwright/test";

const ORDER_EXAMPLE = "I am ordering a pepperoni and sausage pizza from Papa John's";

// Playwright forces HEALTH_AI_PROVIDER=mock, so nothing here stubs an identify response:
// the typed path is served before the provider and passcode checks and is fully
// deterministic against the published Table S5 asset. That is the point of the gate order.
async function stubRealtime(page: import("@playwright/test").Page) {
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "mock", reason: "provider_mock" })
    })
  );
}

async function fillCompassQuery(page: import("@playwright/test").Page, value: string) {
  const query = page.getByLabel("Describe a food or order");
  // The textarea is server-rendered with a useful example. Wait for hydration
  // before replacing it so an eager browser action cannot race the streamed text.
  await expect(query).toHaveValue(ORDER_EXAMPLE);
  await query.fill(value);
  await expect(query).toHaveValue(value);
}

test("starts with a readable order example that can be scored in one tap", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await expect(page.getByLabel("Describe a food or order")).toHaveValue(ORDER_EXAMPLE);
  await expect(page.getByRole("button", { name: "Find score" })).toBeEnabled();
  await page.getByRole("button", { name: "Find score" }).click();

  await expect(page.getByLabel("Order interpretation")).toContainText("Papa John's");
  await expect(page.getByRole("region", { name: "Food result" })).toBeFocused();
});

test("the empty nutrition compass offers a working plot action", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await page.getByRole("button", { name: "Plot this order" }).click();

  await expect(page.getByLabel("Order interpretation")).toContainText("Papa John's");
  await expect(page.getByRole("region", { name: "Food result" })).toBeFocused();
});

test("scores a typed food from the published table and offers better options", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await expect(page.getByRole("heading", { name: "Food Lens functional prototype" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Prototype flow" })).toContainText("1Scan or describe2Review the score3Ask a question");
  await expect(page.getByLabel("Guidance source").first()).toContainText("General nutrition: Food Compass only");
  await expect(page.locator('[data-guidance-scope="personalized"]')).toHaveCount(0);
  await expect(
    page.locator('section[aria-label="Food camera"] + section[aria-labelledby="nutrition-compass-title"]')
  ).toHaveCount(1);
  await expect(page.locator('section[aria-labelledby="nutrition-compass-title"] + form')).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Nutrition compass" })).toContainText(
    "Point at a food or type one to place it on the compass."
  );

  await fillCompassQuery(page, "pizza");
  await page.getByRole("button", { name: "Find score" }).click();

  await expect(page.getByRole("heading", { name: /^Pizza,/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Food result" })).toBeFocused();
  await expect(page.getByText("Food Compass score")).toBeVisible();
  await expect(page.getByTestId("nutrition-compass-marker")).toBeVisible();
  await expect(page.getByRole("region", { name: "Nutrition compass" })).toContainText(/Pizza.*nutrition score.*calorie density/i);
  // A published score is not an estimate, so the label badge must not appear.
  await expect(page.getByText("Estimate from label")).toHaveCount(0);

  const alternatives = page.getByRole("listitem").filter({ hasText: "Recipe ideas" });
  await expect(alternatives).toHaveCount(3);
  await expect(alternatives.first()).toContainText(/Pizza/i);

  const recipeLink = alternatives.first().getByRole("link", { name: "Recipe ideas" });
  await expect(recipeLink).toHaveAttribute("href", /google\.com\/search/);
});

test("a live camera identification also collapses the camera and focuses the result", async ({ page }) => {
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
      body: JSON.stringify({
        mode: "match",
        match: {
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
        }
      })
    });
  });
  await page.goto("/compass");

  await expect(page.getByRole("heading", { name: "Banana, raw" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("region", { name: "Food result" })).toBeFocused();
  await expect(page.getByRole("button", { name: /Expand camera/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Nutrition compass" })).toContainText(
    "Banana, raw: 83 / 100 nutrition score · Encourage · Low calorie density · 89 kcal / 100 g."
  );
});

test("understands a restaurant order and labels the closest published match honestly", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await fillCompassQuery(page, ORDER_EXAMPLE);
  await page.getByRole("button", { name: "Find score" }).click();

  await expect(page.getByLabel("Order interpretation")).toBeVisible();
  await expect(page.getByLabel("Order interpretation")).toBeInViewport();
  await expect(page.getByRole("button", { name: /Expand camera/ })).toBeVisible();
  await expect(page.getByText("Papa John's", { exact: true })).toBeVisible();
  await expect(page.getByText("Pepperoni, Sausage", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust"
    })
  ).toBeVisible();
  await expect(page.getByText("23", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/not Papa John's nutrition/i)).toBeVisible();
  await expect(page.getByText(/sausage-specific topping/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await page
    .getByRole("button", { name: /Pizza with meat other than pepperoni, from restaurant or fast food.*18/i })
    .click();
  await expect(page.getByRole("heading", { name: /Pizza with meat other than pepperoni/ })).toBeVisible();
  await expect(page.getByText(/pepperoni topping/i)).toBeVisible();
});

test("the sort control is exclusive and labels the active ordering", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await fillCompassQuery(page, "latte");
  await page.getByRole("button", { name: "Find score" }).click();
  await expect(page.getByRole("heading", { name: /Latte/i })).toBeVisible();

  const firstAlternative = () => page.getByRole("listitem").filter({ hasText: "Recipe ideas" }).first();
  const before = await firstAlternative().textContent();

  await expect(page.getByLabel("Highest score first")).toBeChecked();
  await expect(page.getByLabel("Lowest calorie density first")).not.toBeChecked();
  await expect(page.getByRole("heading", { name: /Better options · highest score first/i })).toBeVisible();

  await page.getByLabel("Lowest calorie density first").check();
  await expect(page.getByLabel("Highest score first")).not.toBeChecked();
  await expect(page.getByLabel("Lowest calorie density first")).toBeChecked();
  await expect(page.getByRole("heading", { name: /Better options · lowest calorie density first/i })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Recipe ideas" }).first()).not.toHaveText(before ?? "");
});

test("plays a deterministic voice example with a visible question, answer, and source", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await page.getByRole("button", { name: "Play voice example" }).click();

  const transcript = page.getByLabel("Canned voice transcript");
  await expect(transcript).toBeVisible();
  await expect(transcript).toContainText("I am ordering a pepperoni and sausage pizza from Papa John's");
  await expect(transcript).toContainText("Its Food Compass score is 23 out of 100");
  await expect(transcript.getByLabel("Guidance source")).toContainText("General nutrition: Food Compass only");
});

test("water gets the carve-out copy and no number at all", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await fillCompassQuery(page, "water");
  await page.getByRole("button", { name: "Find score" }).click();

  // The camera collapses, so the carve-out appears once in the focused result instead of behind the fold too.
  await expect(page.getByText(/Water is the best choice there is/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Food result" })).toBeInViewport();
  await expect(page.getByRole("button", { name: /Expand camera/ })).toBeVisible();
  await expect(page.getByText("Food Compass score")).toHaveCount(0);
});

test("shows the voice control as soon as the token route reports a live provider", async ({ page }) => {
  // The mount probe is what makes this reachable at all: the control renders only when
  // mode === "live", and before spec 23's fix mode only left "unknown" inside start() —
  // which could only be triggered by the control that was not being rendered.
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "live", model: "gpt-realtime-2" })
    })
  );
  await page.goto("/compass?k=anything");

  await expect(page.getByRole("button", { name: "Tap start and describe your order." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Describe an order by voice" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ask about/ })).toHaveCount(0);

  await fillCompassQuery(page, "banana");
  await page.getByRole("button", { name: "Find score" }).click();
  await expect(page.getByRole("button", { name: "Ask about Banana, raw" })).toBeVisible();
});

test("hides the voice button without a live provider, and carries no patient data", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  // The on-device coach speaks in a patient-care-plan voice, wrong for this surface.
  await expect(page.getByRole("button", { name: /Ask about/ })).toHaveCount(0);
  // ...and with no voice control on screen, nothing may tell the reader to tap one.
  await expect(page.getByText("Tap start to talk about this food.")).toHaveCount(0);

  // The root layout seeds a demo patient into every other route; none of it reaches here.
  await expect(page.getByText(/Maria|Brent|blood pressure|lisinopril/i)).toHaveCount(0);

  await expect(page.getByText(/Food Compass 2\.0 \(Tufts University, used with permission\)/)).not.toBeVisible();
  await page.getByText("How scoring works").click();
  await expect(page.getByText(/Food Compass 2\.0 \(Tufts University, used with permission\)/)).toBeVisible();
  await expect(page.getByText(/Not medical advice/)).toBeVisible();
});

test("typed scoring still works with a passcode in the URL", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass?k=anything");

  await fillCompassQuery(page, "banana");
  await page.getByRole("button", { name: "Find score" }).click();

  // 83 is the published Table S5 value for Banana, raw. The number IS the test.
  await expect(page.getByRole("heading", { name: "Banana, raw" })).toBeVisible();
  await expect(page.getByText("83", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Encourage").first()).toBeVisible();
});
