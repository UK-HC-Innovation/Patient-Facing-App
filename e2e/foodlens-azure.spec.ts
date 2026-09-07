import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * This file is written for the Azure artifact (`playwright.azure.config.ts` serves
 * `.next/standalone` with APP_SURFACE=foodlens), but `e2e/` is also the default config's
 * testDir, so it runs against the ordinary dev build too. The two builds disagree about
 * exactly one thing -- whether anything outside the food lens exists -- so the build is
 * asked rather than assumed. Everything else here is true of the public door on every
 * build, which is the point: Azure was the only build that got the store-free door right
 * in the critique (N9), and it is now the contract everywhere.
 */
async function readSurface(request: APIRequestContext): Promise<string | undefined> {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const body = (await health.json()) as { status?: string; surface?: string };
  expect(body.status).toBe("healthy");
  return body.surface;
}

test("serves the public FoodLens door with nothing of the patient's in it", async ({ page, request }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/food/demo");
  await expect(page).toHaveTitle("1 good choice");
  await expect(page.getByRole("heading", { name: "1 good choice" })).toBeVisible();

  // Spec 29 P3: the way in on a phone that said no to the camera. This build's token route
  // answers mode "mock", so the mic is gone and the ask box is the only control left --
  // which is exactly the state that had no keyboard at all in the critique (F5, G1, H9).
  await expect(page.getByLabel("Ask about this food…")).toBeVisible();

  // Spec 29 P2 item 4 and critique N9: the public door writes nothing. Not the patient
  // record it used to leave in a stranger's browser, and not anything else.
  const patientState = await page.evaluate(() =>
    window.localStorage.getItem("home-health-ai-ownership-state")
  );
  expect(patientState).toBeNull();
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

  const lookup = await request.post("/api/food/lookup", {
    data: { barcode: "051000012616" }
  });
  expect(lookup.status()).toBe(200);
  expect(await lookup.json()).toMatchObject({
    found: true,
    food: { barcode: "051000012616" }
  });

  expect(consoleErrors).toEqual([]);
});

test("keeps everything but the food lens off the FoodLens artifact", async ({ request }) => {
  const surface = await readSurface(request);
  test.skip(surface !== "foodlens", "The full build serves the whole app on purpose.");

  expect((await request.get("/today")).status()).toBe(404);
  expect((await request.post("/api/food/package", { data: {} })).status()).toBe(404);
});
