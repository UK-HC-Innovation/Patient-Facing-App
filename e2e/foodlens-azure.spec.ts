import { expect, test } from "@playwright/test";

test("the Azure artifact exposes only a stateless FoodLens preview", async ({ page, request }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/food/demo");
  await expect(page).toHaveTitle("1 good choice");
  await expect(page.getByRole("heading", { name: "1 good choice" })).toBeVisible();
  await expect(page.getByText("General nutrition advice — not based on your readings or health history.").first()).toBeVisible();

  const patientState = await page.evaluate(() =>
    window.localStorage.getItem("home-health-ai-ownership-state")
  );
  expect(patientState).toBeNull();
  expect(consoleErrors).toEqual([]);

  expect((await request.get("/today")).status()).toBe(404);
  expect((await request.post("/api/food/package", { data: {} })).status()).toBe(404);

  const lookup = await request.post("/api/food/lookup", {
    data: { barcode: "051000012616" }
  });
  expect(lookup.status()).toBe(200);
  expect(await lookup.json()).toMatchObject({
    found: true,
    food: { barcode: "051000012616" }
  });
});
