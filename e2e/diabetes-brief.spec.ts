import { expect, test } from "@playwright/test";

// DPL golden path (plan 10 acceptance): load the Brent demo, then the blood-sugar
// page shows time-in-range + the deterministic food<->glucose pattern, and the
// visit Health Brief carries the full diabetes picture. Deterministic fixtures,
// zero env vars, mock provider.
test("diabetes-legible loop: time-in-range, food pattern, and a diabetes-complete brief", async ({ page }) => {
  // Load the Brent demo (blood pressure + diabetes) from the privacy controls.
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Restore retinopathy walkthrough" }).click();

  // Blood-sugar page: the time-in-range band and the food<->glucose pattern card.
  await page.goto("/glucose");
  await expect(page.getByRole("heading", { name: "Time in range" })).toBeVisible();
  await expect(page.getByText("75%")).toBeVisible();
  await expect(page.getByRole("heading", { name: "A pattern in your logs" })).toBeVisible();
  await expect(page.getByText(/after higher-carb meals averaged about 65 mg\/dL higher/)).toBeVisible();
  await expect(
    page.getByText(/After meals with a low-scoring food, your blood sugar ran about 65 mg\/dL higher/)
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Check a meal" })).toHaveAttribute("href", "/food");

  // Visit brief: the diabetes-complete Health Brief.
  await page.goto("/visits");
  await expect(page.getByRole("heading", { name: "Recent blood sugar" })).toBeVisible();
  await expect(page.getByText(/9 of your last 12 blood-sugar readings/)).toBeVisible();
  await expect(page.getByText(/\(75%\)/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Food & blood-sugar pattern" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Taking my medicines" })).toBeVisible();
  await expect(page.getByText(/\d+ of \d+ were marked taken/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eye screening" })).toBeVisible();
});
