import { expect, test, type Page } from "@playwright/test";

const SOUP_BARCODE = "051000012616";

async function stubFoodLens(page: Page) {
  await page.addInitScript((barcode) => {
    if (!window.sessionStorage.getItem("__e2e_cleared")) {
      window.localStorage.clear();
      window.localStorage.setItem("home-health-onboarding-completed", "true");
      window.sessionStorage.setItem("__e2e_cleared", "1");
    }
    class FakeBarcodeDetector {
      static getSupportedFormats() {
        return Promise.resolve(["ean_13", "upc_a"]);
      }
      detect() {
        return Promise.resolve([{ rawValue: barcode, format: "ean_13" }]);
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeBarcodeDetector;
  }, SOUP_BARCODE);

  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "mock", reason: "provider_mock" }) })
  );
}

test("tier-2 diabetes loop: dose-log tags and editable portion scaling", async ({ page }) => {
  await stubFoodLens(page);

  // Spec 29 P2: nothing loads Brent by default. The dose-log tags below need his
  // seeded readings, so ask for the sample patient explicitly.
  await page.goto("/menu");
  await page.getByRole("button", { name: "Load a sample patient (Brent)" }).click();
  await page.waitForURL(/\/screening/);
  // /glucose and /food below are full loads, which rehydrate from storage. Wait for
  // the sample patient to get there, or the reload restores the empty one.
  await page.waitForFunction(() =>
    (window.localStorage.getItem("home-health-ai-ownership-state") ?? "").includes("Brent")
  );

  await page.goto("/glucose");
  await expect(page.getByText(/Tags show what your dose log says/)).toBeVisible();
  await expect(page.getByText("Metformin taken").first()).toBeVisible();
  await expect(page.getByText("Metformin missed").first()).toBeVisible();

  const foodLookupResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/food/lookup") && response.request().method() === "POST" && response.ok()
  );
  await page.goto("/food");
  await page.getByRole("button", { name: "Tap to scan" }).click();
  await foodLookupResponse;
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await page.getByRole("button", { name: "Use this product" }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  await expect(page.getByTestId("food-verdict")).toContainText("Condensed Chicken Noodle Soup");

  // Spec 29 P8: the serving stepper, the nutrient tiles and the flags moved under
  // one disclosure. The score and the verdict stay above it; everything this test
  // measures is behind it.
  await page.getByText("More about this food").click();

  await expect(page.getByText("Set to 1 servings. Tap to change.")).toBeVisible();
  await expect(page.getByText("60")).toBeVisible();

  await page.getByRole("button", { name: "Increase servings" }).click();

  await expect(page.getByText("Set to 2 servings. Tap to change.")).toBeVisible();
  await expect(page.getByText("120")).toBeVisible();
  await expect(page.getByText(/1780 mg sodium/)).toBeVisible();
});
