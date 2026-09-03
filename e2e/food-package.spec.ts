import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.skip(process.env.PACKAGE_E2E_FLAG_ON !== "1", "runs only against the package flag-on server");

const labelDraft = {
  servingSize: "1 oz (28 g)",
  servingGrams: 28,
  servingsPerContainer: "4",
  selectedColumnHeading: "Amount per serving",
  nutrition: {
    servingSize: "1 oz (28 g)", servingGrams: 28, basis: "per_serving", calories: 130,
    sodiumMg: 180, potassiumMg: null, totalSugarsG: 2, addedSugarsG: 0,
    saturatedFatG: 1, fiberG: 5, proteinG: 13, carbsG: 11, totalFatG: 5,
    monoFatG: null, polyFatG: null, transFatG: 0, cholesterolMg: 0, calciumMg: null, ironMg: null
  },
  rows: [
    { field: "calories", printedLabel: "Calories", printedAmount: "130", printedUnit: null, value: 130, normalizedUnit: "kcal", precision: "exact" },
    { field: "sodium", printedLabel: "Sodium", printedAmount: "180", printedUnit: "mg", value: 180, normalizedUnit: "mg", precision: "exact" },
    { field: "total_fat", printedLabel: "Total Fat", printedAmount: "5", printedUnit: "g", value: 5, normalizedUnit: "g", precision: "exact" },
    { field: "fiber", printedLabel: "Dietary Fiber", printedAmount: "5", printedUnit: "g", value: 5, normalizedUnit: "g", precision: "exact" },
    { field: "protein", printedLabel: "Protein", printedAmount: "13", printedUnit: "g", value: 13, normalizedUnit: "g", precision: "exact" }
  ],
  unusableRows: [],
  omittedFields: ["potassium"],
  ingredientText: "soybeans, sunflower oil, ranch seasoning",
  warnings: [],
  includedDomains: ["D1", "D3", "D8"],
  carveOut: null,
  confidence: 0.96
};

async function commonStubs(page: Page) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "mock" }) })
  );
}

async function expectNoSeriousAxeViolations(page: Page, include: string) {
  const result = await new AxeBuilder({ page })
    .include(include)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const actionable = result.violations.filter(({ impact }) => impact === "critical" || impact === "serious");
  expect(
    actionable.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map(({ target }) => target)
    }))
  ).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("front identity and Nutrition Facts stay unscored until both confirmations", async ({ page }) => {
  await commonStubs(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  let packageCalls = 0;
  await page.route("**/api/food/identify", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "package" }) })
  );
  await page.route("**/api/food/package/session", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authorized: true, expiresAt: Date.now() + 60_000 }) })
  );
  await page.route("**/api/food/package", (route) => {
    packageCalls += 1;
    const body = route.request().postDataJSON() as { kind: string; image?: string };
    expect(body.image).toMatch(/^data:image\/jpeg;base64,/);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body.kind === "front" ? {
        mode: "front",
        candidate: {
          brand: "The Only Bean", product: "Crunchy Edamame", flavor: "Ranch",
          displayName: "The Only Bean Crunchy Edamame Ranch",
          visibleText: ["The Only Bean", "Crunchy Edamame", "Ranch", "X".repeat(180)],
          confidence: 0.96, quality: "good"
        }
      } : { mode: "nutrition", draft: labelDraft })
    });
  });

  await page.goto("/food");
  await page.getByRole("button", { name: "Tap to scan" }).click();
  await expect(page.getByText("This looks packaged")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Scan the plate" })).toBeDisabled();
  await page.getByRole("button", { name: "Scan a package" }).click();
  await expect(page.getByText(/current package photo will be sent to OpenAI/i)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Read Nutrition Facts" }).click();
  const readback = page.getByTestId("package-nutrition-readback");
  await expect(readback).toContainText("Calories");
  await expect(readback).toContainText("130");
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await page.getByRole("button", { name: "Use these numbers" }).click();
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);

  await page.getByRole("button", { name: "Read package front" }).click();
  await expect(page.getByText(/I read: The Only Bean Crunchy Edamame Ranch/)).toBeVisible();
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log this" })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAxeViolations(page, '[data-testid="food-package-scan"]');
  await page.getByRole("button", { name: "Looks right" }).click();

  await expect(page.getByTestId("food-verdict")).toContainText("Food Compass score");
  await expect(page.getByTestId("food-verdict")).toContainText("Estimate from label");
  await expect(page.getByRole("heading", { name: "Confirmed package: The Only Bean Crunchy Edamame Ranch" })).toBeVisible();
  expect(packageCalls).toBe(2);
  const stored = await page.evaluate(() => Object.values(window.localStorage).join("\n"));
  expect(stored).not.toContain("data:image");
  expect(stored).not.toContain("visibleText");
});

test("the public demo abstains on packages without exposing the detailed cloud flow", async ({ page }) => {
  await commonStubs(page);
  await page.route("**/api/food/identify", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "package" }) })
  );

  await page.goto("/food/demo");
  await page.getByRole("button", { name: "Tap to scan" }).click();

  await expect(page.getByRole("region", { name: "This looks packaged" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Scan a package" })).toHaveCount(0);
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await expect(page.getByTestId("nutrition-compass-marker")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousAxeViolations(page, '[data-testid="food-package-abstention"]');
});

test("a barcode candidate survives turning the package and remains unscored until confirmation", async ({ page }) => {
  await commonStubs(page);
  await page.addInitScript(() => {
    let scans = 0;
    class FakeBarcodeDetector {
      detect() {
        scans += 1;
        return Promise.resolve(scans <= 3 ? [{ rawValue: "123456789012" }] : []);
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeBarcodeDetector;
  });
  await page.route("**/api/food/lookup?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      found: true,
      food: {
        id: "barcode:123456789012", barcode: "123456789012", name: "Crunchy Edamame Ranch",
        brand: "The Only Bean", category: "Bean snacks", source: "barcode_off",
        ingredientText: labelDraft.ingredientText, nutrition: labelDraft.nutrition
      }
    })
  }));
  await page.route("**/api/food/identify", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mode: "none", candidates: [] }) }));

  await page.goto("/food");
  await page.getByRole("button", { name: "Tap to scan" }).click();
  const useProduct = page.getByRole("button", { name: "Use this product" });
  await expect(useProduct).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await page.waitForTimeout(6_000);
  await expect(useProduct).toBeVisible();
  await useProduct.click();
  await expect(page.getByTestId("food-verdict")).toContainText("Food Compass score");
});

test("a package transition aborts a late plate result and cannot rearm hidden live work", async ({ page }) => {
  await commonStubs(page);
  let liveImageCalls = 0;
  await page.route("**/api/food/identify", (route) => {
    const body = route.request().postDataJSON() as { image?: string; foodId?: string };
    if (body.image) {
      liveImageCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "candidate",
          candidate: { food: { code: "63107010", description: "Banana, raw", group: "2000_Fruit" } }
        })
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "match",
        match: {
          food: { code: body.foodId ?? "63107010", description: "Banana, raw", group: "2000_Fruit" },
          tier: "T1",
          score: {
            fcs: 83, band: "encourage", tier: "T1", ambiguous: false, range: null,
            calorieDensity: { kcalPer100g: 89, band: "low" }, domains: null, coverage: null
          },
          alternatives: [],
          nutrients: null
        },
        candidates: []
      })
    });
  });
  await page.route("**/api/food/plate", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "plate",
          items: [{
            kind: "match",
            match: {
              food: { code: "58106220", description: "Cool Ranch tortilla chips", group: "4000_Savory snacks" },
              tier: "T1",
              score: {
                fcs: 12, band: "minimize", tier: "T1", ambiguous: false, range: null,
                calorieDensity: { kcalPer100g: 500, band: "high" }, domains: null, coverage: null
              },
              nutrients: null
            },
            candidates: [{ code: "58106220", description: "Cool Ranch tortilla chips", fcs: 12 }],
            proposedServings: 1,
            basis: "one package"
          }]
        })
      });
    } catch {
      // The expected client abort can close the intercepted request before fulfillment.
    }
  });

  await page.goto("/food");
  await page.getByRole("button", { name: "Tap to scan" }).click();
  await page.getByRole("button", { name: "Yes, use this food" }).click();
  await expect(page.getByTestId("food-verdict")).toContainText("Food Compass score", { timeout: 15_000 });
  await page.getByRole("button", { name: "Scan the plate" }).click();
  await page.getByRole("button", { name: "Scan a package" }).click();
  await expect(page.getByRole("heading", { name: "Before you take a package photo" })).toBeVisible();
  const callsAtPackageStart = liveImageCalls;

  await page.waitForTimeout(1_600);
  await expect(page.getByText("Cool Ranch tortilla chips")).toHaveCount(0);
  await expect(page.getByTestId("plate-card")).toHaveCount(0);
  expect(liveImageCalls).toBe(callsAtPackageStart);
});
