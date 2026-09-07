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

/**
 * Image identification, stubbed and counted. The number changes only after an explicit tap.
 */
async function stubIdentify(page: Page, body: unknown = { mode: "match", match: bananaMatch }) {
  const counter = { image: 0 };
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "mock", reason: "provider_mock" })
    })
  );
  await page.route("**/api/food/identify", async (route) => {
    const posted = route.request().postDataJSON() as { image?: string; foodId?: string };
    if (posted.foodId && (body as { mode?: string }).mode === "match") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    counter.image += 1;
    const imageBody = (body as { mode?: string; match?: typeof bananaMatch }).mode === "match"
      ? { mode: "candidate", candidate: { food: (body as { match: typeof bananaMatch }).match.food }, candidates: [] }
      : body;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(imageBody) });
  });
  return counter;
}

async function confirmCameraCandidate(page: Page) {
  await page.getByRole("button", { name: "Tap to scan" }).click();
  await page.getByRole("button", { name: "Yes, use this food" }).click();
}

/**
 * Spec 29 P8 (critique N5): a barcode score was ten and a half phone screens. The score,
 * the verdict, one alternative and one button stayed; the chart, the score drivers, the
 * "we heard" block, the flags, the day totals, the nutrient tiles and the meal log went
 * under one disclosure. Anything below that line has to be opened before it can be read.
 */
async function openMoreAboutThisFood(page: Page) {
  await page.getByText("More about this food").click();
}

function strip(page: Page) {
  return page.getByRole("region", { name: "1 good choice status" });
}

async function scrollViewfinderAway(page: Page) {
  // Scroll by the viewfinder's actual position so this stays correct when the
  // branded page header changes height.
  await page.getByRole("region", { name: "Food camera" }).evaluate((viewfinder) => {
    const box = viewfinder.getBoundingClientRect();
    window.scrollTo({ top: Math.ceil(window.scrollY + box.bottom), behavior: "instant" });
  });
  await expect(strip(page)).toHaveAttribute("data-strip-mode", "food");
}

test("sends no more frames after an explicit scan", async ({ page }) => {
  const identifies = await stubIdentify(page);
  await page.goto("/food/demo");
  await expect(strip(page)).toContainText("Ready to scan");
  await page.waitForTimeout(3_000);
  expect(identifies.image).toBe(0);
  await confirmCameraCandidate(page);

  await expect(strip(page)).toContainText("Ready to scan", { timeout: 10_000 });
  const before = identifies.image;
  expect(before).toBeGreaterThan(0);

  await scrollViewfinderAway(page);
  const paused = identifies.image;

  // Waiting and scrolling are both free. Only another tap can send another picture.
  await page.waitForTimeout(3_000);
  expect(identifies.image).toBe(paused);
});

test("shows an OpenAI quota problem after one tap and does not retry", async ({ page }) => {
  const identifies = await stubIdentify(page, { mode: "error", reason: "provider_quota" });
  await page.goto("/food/demo");

  await page.getByRole("button", { name: "Tap to scan" }).click();
  await expect(page.getByText("Scanning needs service billing or credits attention.", { exact: true })).toBeVisible();
  expect(identifies.image).toBe(1);

  await page.waitForTimeout(3_000);
  expect(identifies.image).toBe(1);
});

test("scrolling back re-shows the match without a Scan again chip", async ({ page }) => {
  const identifies = await stubIdentify(page);
  await page.goto("/food/demo");
  await confirmCameraCandidate(page);

  await expect(strip(page)).toContainText("Ready to scan", { timeout: 10_000 });
  await scrollViewfinderAway(page);
  await expect(strip(page)).toContainText("Banana, raw · 83");
  const paused = identifies.image;

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  await expect(strip(page)).toHaveAttribute("data-strip-mode", "loop");
  // The result stays put when the viewfinder returns.
  await expect(page.getByTestId("food-verdict")).toContainText("Banana, raw");
  await expect(page.getByRole("button", { name: "Tap to scan again" })).toBeVisible();
  expect(identifies.image).toBe(paused);
});

test("switches the strip between its two modes at one fixed height", async ({ page }) => {
  await stubIdentify(page);
  await page.goto("/food/demo");
  await confirmCameraCandidate(page);

  await expect(strip(page)).toContainText("Ready to scan", { timeout: 10_000 });
  const loopBox = await strip(page).boundingBox();
  expect(loopBox?.height).toBe(44);
  // While the camera is up the viewfinder names the food, so the strip does not.
  await expect(strip(page)).not.toContainText("Banana, raw");

  await scrollViewfinderAway(page);
  const foodBox = await strip(page).boundingBox();
  expect(foodBox?.height).toBe(44);
  await expect(strip(page)).toContainText("Banana, raw · 83");

  // The food is labeled exactly once on the screenful: in the strip, not also in the
  // verdict beneath it.
  //
  // The conversation is excluded, and that exclusion is new. It is not a label, it is a
  // sentence someone said, and it only shares this screenful because spec 29 P8 folded the
  // chart, the tiles and the drivers away (critique N5) -- a barcode result went from ten
  // and a half phone screens to under four. Counting an assistant turn as a duplicate
  // label would make the page shrinking look like a regression.
  const onScreen = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("p, span, div, h1, h2, h3"));
    return nodes.filter((node) => {
      if (!node.textContent?.includes("Banana, raw")) {
        return false;
      }
      if (node.closest('[role="log"]')) {
        return false;
      }
      if (Array.from(node.children).some((child) => child.textContent?.includes("Banana, raw"))) {
        return false;
      }
      const box = node.getBoundingClientRect();
      return box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
    }).length;
  });
  expect(onScreen).toBe(1);
});

test("keeps the public mount store-free and gives it an ask box", async ({ page }) => {
  await stubIdentify(page);
  await page.goto("/food/demo");
  await confirmCameraCandidate(page);

  await expect(strip(page)).toContainText("Ready to scan", { timeout: 10_000 });
  await scrollViewfinderAway(page);

  // Store-free is the load-bearing half of decision 5 and it does not move: this door
  // wrote a stranger's browser a whole patient record it never showed them (critique N9).
  // Nothing here, not the scan, not the mic, may leave a key behind.
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

  // The other half inverted in spec 29 P3. The text box used to be the thing that was
  // never rendered; with the camera off that left the door with one control, a mic that
  // failed, and no way in (critique F5, G1). The strip still has nowhere else to send you,
  // so it still carries no camera button.
  await expect(page.getByLabel("Ask about this food…")).toBeVisible();
  await expect(strip(page).getByRole("button")).toHaveCount(0);

  // Spec 29 P3 item 6: the token route answers mode "mock" in this suite, so there is no
  // mic at all. A button that says "Listening. Just talk." to nobody is worse than no
  // button (critique H8, H9), and the project rule is that a key-dependent feature fails
  // visibly. The typed row is what is left, and it says so.
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Voice" })).toContainText(
    "Typed questions only on this build."
  );
});

test("turns an image-only carve-out into a safe no-match with no score or log action", async ({ page }) => {
  await stubIdentify(page, { mode: "carve_out", reason: "zero_calorie" });
  await page.goto("/food");
  await page.getByRole("button", { name: "Tap to scan" }).click();

  await expect(page.getByRole("region", { name: "No match" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("region", { name: "Food camera" })).toBeVisible();
  await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  await expect(page.getByTestId("nutrition-compass-marker")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log it anyway" })).toHaveCount(0);
});

test("opens the domain breakdown from the chart marker and hands focus back on close", async ({ page }) => {
  await stubIdentify(page, {
    mode: "match",
    match: {
      ...bananaMatch,
      estimatedDomains: {
        domains: [
          { key: "D1", value: 4.2 },
          { key: "D2", value: -1.5 }
        ],
        coverage: { included: ["D1", "D2"], missing: ["D8"], partial: [] }
      }
    }
  });
  await page.goto("/food/demo");
  await confirmCameraCandidate(page);

  // Spec 29 P8: the chart is under the fold now, so the marker is reached through it.
  await expect(page.getByTestId("food-verdict")).toContainText("Banana, raw", { timeout: 10_000 });
  await openMoreAboutThisFood(page);

  const marker = page.getByTestId("nutrition-compass-marker");
  await expect(marker).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("why-score")).toHaveCount(0);

  await marker.click();
  const panel = page.getByTestId("why-score");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Why this score?" })).toBeFocused();

  await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("why-score")).toHaveCount(0);
  await expect(marker).toBeFocused();
});

test("names the quadrants in a legend beneath the plot, never in its corners", async ({ page }) => {
  await stubIdentify(page);
  await page.goto("/food/demo");
  await confirmCameraCandidate(page);

  await expect(page.getByTestId("food-verdict")).toContainText("Banana, raw", { timeout: 10_000 });
  await openMoreAboutThisFood(page);

  const chart = page.getByRole("region", { name: "Score and calories" });
  await expect(chart).toBeVisible({ timeout: 10_000 });

  const legend = page.getByRole("group", { name: "What the colors mean" });
  await expect(legend).toContainText("Choose often");
  // Spec 29 P8 item 2: the legend used to append "Your food is here" to the quadrant this
  // food is in, in words, with an em dash, after the ring and the marker had already said
  // it twice (critique N6). The swatch carries the state now, and nothing says it in prose.
  await expect(legend.locator('[data-quadrant="choose_often"]')).toHaveAttribute("aria-current", "true");
  await expect(legend.locator('[data-quadrant="choose_often"]')).toHaveAttribute("data-current", "true");
  await expect(legend.locator("[data-current]")).toHaveCount(1);
  await expect(legend).not.toContainText("Your food is here");
  await expect(chart).toContainText("Down and to the right is better");

  const plot = page.getByTestId("nutrition-compass-plot");
  const plotBox = await plot.boundingBox();
  const legendBox = await legend.boundingBox();
  expect(legendBox!.y).toBeGreaterThan(plotBox!.y + plotBox!.height - 1);
});

test("never lets the shell widen the page, at either end of the viewport range", async ({ page }) => {
  await stubIdentify(page);
  await page.goto("/food/demo");
  await confirmCameraCandidate(page);
  await expect(strip(page)).toContainText("Ready to scan", { timeout: 10_000 });

  // A single unbreakable line inside the pinned bar once widened the document to four
  // times the screen, and the phone answered by shrinking the whole page to fit.
  const noOverflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(await noOverflow()).toBe(true);

  // §13: desktop arrivals on the public mount are certain, and one clamped column is the
  // whole answer -- nothing may stretch full-bleed at 1440px.
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await noOverflow()).toBe(true);
  const column = await page.getByRole("region", { name: "About this food" }).boundingBox();
  expect(column!.width).toBeLessThanOrEqual(480);
});
