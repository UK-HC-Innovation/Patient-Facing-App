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

  await page.goto("/privacy");
  await page.getByRole("button", { name: "Restore retinopathy walkthrough" }).click();

  await page.goto("/glucose");
  await expect(page.getByText(/Tags show what your dose log says/)).toBeVisible();
  await expect(page.getByText("Metformin taken").first()).toBeVisible();
  await expect(page.getByText("Metformin missed").first()).toBeVisible();

  const foodLookupResponse = page.waitForResponse(
    (response) => response.url().includes(`/api/food/lookup?barcode=${SOUP_BARCODE}`) && response.ok()
  );
  await page.goto("/food");
  await foodLookupResponse;
  await expect(page.getByTestId("food-verdict")).toContainText("Condensed Chicken Noodle Soup");
  await expect(page.getByText("Set to 1 servings — tap to change.")).toBeVisible();
  await expect(page.getByText("60")).toBeVisible();

  await page.getByRole("button", { name: "Increase servings" }).click();

  await expect(page.getByText("Set to 2 servings — tap to change.")).toBeVisible();
  await expect(page.getByText("120")).toBeVisible();
  await expect(page.getByText(/1780 mg sodium/)).toBeVisible();
});
