import { expect, test } from "@playwright/test";

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

test("scores a typed food from the published table and offers better options", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await expect(page.getByRole("heading", { name: "One Good Choice — preview" })).toBeVisible();

  await page.getByLabel("Type a food").fill("pizza");
  await page.getByRole("button", { name: "Score it" }).click();

  await expect(page.getByRole("heading", { name: /^Pizza,/ })).toBeVisible();
  await expect(page.getByText("Food Compass score")).toBeVisible();
  // A published score is not an estimate, so the label badge must not appear.
  await expect(page.getByText("Estimate from label")).toHaveCount(0);

  const alternatives = page.getByRole("listitem").filter({ hasText: "Recipe ideas" });
  await expect(alternatives).toHaveCount(3);
  await expect(alternatives.first()).toContainText(/Pizza/i);

  const recipeLink = alternatives.first().getByRole("link", { name: "Recipe ideas" });
  await expect(recipeLink).toHaveAttribute("href", /google\.com\/search/);
});

test("the sort toggles reorder the alternatives", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await page.getByLabel("Type a food").fill("latte");
  await page.getByRole("button", { name: "Score it" }).click();
  await expect(page.getByRole("heading", { name: /Latte/i })).toBeVisible();

  const firstAlternative = () => page.getByRole("listitem").filter({ hasText: "Recipe ideas" }).first();
  const before = await firstAlternative().textContent();

  await page.getByLabel("Lowest calorie density first").check();
  await expect(page.getByRole("listitem").filter({ hasText: "Recipe ideas" }).first()).not.toHaveText(before ?? "");
});

test("water gets the carve-out copy and no number at all", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  await page.getByLabel("Type a food").fill("water");
  await page.getByRole("button", { name: "Score it" }).click();

  // Shown twice on purpose: the viewfinder badge and the result card.
  await expect(page.getByText(/Water is the best choice there is/)).toHaveCount(2);
  await expect(page.getByText("Food Compass score")).toHaveCount(0);
});

test("hides the voice button without a live provider, and carries no patient data", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass");

  // The on-device coach speaks in a patient-care-plan voice, wrong for this surface.
  await expect(page.getByRole("button", { name: /Talk about this food/ })).toHaveCount(0);

  // The root layout seeds a demo patient into every other route; none of it reaches here.
  await expect(page.getByText(/Maria|Brent|blood pressure|lisinopril/i)).toHaveCount(0);

  await expect(page.getByText(/Food Compass 2\.0 \(Tufts University, used with permission\)/)).toBeVisible();
  await expect(page.getByText(/Not medical advice/)).toBeVisible();
});

test("typed scoring still works with a passcode in the URL", async ({ page }) => {
  await stubRealtime(page);
  await page.goto("/compass?k=anything");

  await page.getByLabel("Type a food").fill("banana");
  await page.getByRole("button", { name: "Score it" }).click();

  // 83 is the published Table S5 value for Banana, raw. The number IS the test.
  await expect(page.getByRole("heading", { name: "Banana, raw" })).toBeVisible();
  await expect(page.getByText("83", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Encourage").first()).toBeVisible();
});
