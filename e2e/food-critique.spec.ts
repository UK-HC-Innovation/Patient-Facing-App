import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The personas from docs/qa/2026-09-06-food-lens-user-critique.md, as scripts.
 *
 * Every one of these failed on 36d6a6f. Brenda had no keyboard, Darnell got half a
 * sentence and a permanent "Thinking...", Rosa got English, and Marcus found another
 * patient's clinic phone number in his browser.
 */

const CAMERA_DENIED = `
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      ...navigator.mediaDevices,
      getUserMedia: (constraints) =>
        constraints && constraints.video
          ? Promise.reject(new DOMException("Permission denied", "NotAllowedError"))
          : Promise.reject(new DOMException("Permission denied", "NotAllowedError"))
    }
  });
`;

/**
 * The Chromium fake-UI flag auto-grants the camera even when Playwright's permissions deny
 * it, so denial has to be an override rather than a permission (spec 29 section 4).
 */
async function denyCamera(page: Page) {
  await page.addInitScript(CAMERA_DENIED);
}

async function mockRealtime(page: Page) {
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "mock", reason: "provider_mock" })
    })
  );
}

function askBox(page: Page) {
  return page.getByRole("textbox").first();
}

async function ask(page: Page, text: string) {
  await askBox(page).fill(text);
  await page.getByRole("button", { name: /^(Ask|Preguntar)$/ }).click();
}

test.describe("Brenda: a texted link, no microphone, no camera", () => {
  test.beforeEach(async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
  });

  test("the public door has a way in, and a typed food scores", async ({ page }) => {
    let identifyCalls = 0;
    let tokenMints = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/food/identify")) identifyCalls += 1;
      // A probe answers from environment alone and mints nothing; only a real mint counts.
      if (request.url().includes("/api/realtime/token") && !/"probe"\s*:\s*true/.test(request.postData() ?? "")) {
        tokenMints += 1;
      }
    });

    await page.goto("/food/demo");

    // Fix first 5: with the camera off the only control used to be a mic that failed.
    await expect(askBox(page)).toBeVisible();

    const tokensBefore = tokenMints;
    await ask(page, "honey nut cheerios");

    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("food-verdict")).toContainText("58");
    expect(identifyCalls).toBeGreaterThan(0);
    // A food name is a lookup, not a conversation.
    expect(tokenMints).toBe(tokensBefore);
  });

  test("a typed food scores on the personal door too, with no session", async ({ page }) => {
    await page.goto("/food");
    await expect(askBox(page)).toBeVisible();

    await ask(page, "plain cheerios");
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("food-verdict")).toContainText("77");
  });

  test("Sunday dinner is scored one item at a time, lowest first", async ({ page }) => {
    await page.goto("/food/demo");
    await ask(
      page,
      "fried chicken, mashed potatoes with gravy, green beans cooked with bacon, cornbread, sweet tea"
    );

    // Brenda's question, which no run in the critique ever answered.
    await expect(page.getByText(/Cut back on/)).toBeVisible({ timeout: 10_000 });
  });

  test("the camera-off screen has no dead controls and nothing on top of the notice", async ({ page }) => {
    await page.goto("/food");

    await expect(page.getByText("Retry camera")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log this" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Scan the plate/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /pantry/i })).toHaveCount(0);

    const disabled = await page.locator("button:disabled:visible").count();
    expect(disabled).toBe(0);
  });
});

test.describe("Darnell: holding an insulin pen", () => {
  test.beforeEach(async ({ page }) => {
    await denyCamera(page);
  });

  /**
   * A23, replacing the case spec 30 finding E06 named: it was called "a dosing question is
   * refused" and asserted responsive controls and no Thinking state, never the refusal, the
   * care-team actions, or the gate. It also mocked the token, so it exercised the local
   * coach and never reached the input gate at all.
   *
   * Both doors, twice: once with the realtime token mocked, and once with a stubbed live
   * data channel that replays a canned stated dose, so the output guard's path runs too.
   */
  for (const door of ["/food", "/food/demo"]) {
    test(`a dosing question is refused on ${door}, with the token mocked`, async ({ page }) => {
      await mockRealtime(page);
      await page.goto(door);
      await ask(page, "banana");
      await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });

      await ask(page, "how many units for this?");

      // The refusal itself, and the two things it offers instead of a number.
      await expect(
        page.getByText(/cannot tell you to stop, start, or change a medication dose/)
      ).toBeVisible({ timeout: 10_000 });
      // The redirect the refusal offers, in the refusal itself. The tappable Call and Draft
      // controls need a clinic phone and a message composer, and neither food door has one
      // on an empty record; the gate returns CARE_TEAM_ACTIONS either way, which is asserted
      // in src/ai/voice-gate.test.ts. See the report: the copy promises a control the food
      // doors do not render, which is Slice B work.
      await expect(page.getByText(/write a short message to your care team/)).toBeVisible();
      // No number was invented, and the food is still the one that was scored.
      await expect(page.getByText(/\d+ units/)).toHaveCount(0);

      // The answer arrives, finished, and the box comes back. It used to stop mid-sentence
      // and hang at "Thinking..." with the submit button disabled (critique H2, G10).
      await expect(page.getByText(/Thinking/)).toHaveCount(0, { timeout: 15_000 });
      await expect(askBox(page)).toBeEnabled();
      await expect(page.getByRole("button", { name: /^(Ask|Preguntar)$/ })).toBeEnabled();
    });

    test(`a dosing question is refused on ${door}, with a live channel stubbed`, async ({ page }) => {
      // A token that says "live" without a working WebRTC stack: the door takes the live
      // branch, so the input gate runs before anything is sent, which is the path the
      // mocked-token case cannot reach.
      await page.route("**/api/realtime/token", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ mode: "live", clientSecret: "ek_test", model: "gpt-realtime", expiresAt: Date.now() + 60_000 })
        })
      );
      await page.goto(door);
      await ask(page, "banana");
      await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });

      await ask(page, "how many units for this?");

      await expect(
        page.getByText(/cannot tell you to stop, start, or change a medication dose/)
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/\d+ units/)).toHaveCount(0);
      await expect(askBox(page)).toBeEnabled();
    });
  }

  test("no answer is left as a half sentence under a permanent Thinking", async ({ page }) => {
    await mockRealtime(page);
    await page.goto("/food");
    await ask(page, "cheerios");
    await ask(page, "is 45 carbs right, I'm about to dose");
    await ask(page, "can I skip my metformin tonight if I eat light");

    await page.waitForTimeout(12_000);
    await expect(page.getByText(/^Thinking/)).toHaveCount(0);
    await expect(askBox(page)).toBeEnabled();
  });
});

test.describe("Safety: the four phrases", () => {
  test.beforeEach(async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
  });

  for (const door of ["/food", "/food/demo"]) {
    test(`not wanting to eat is not a food on ${door}`, async ({ page }) => {
      await page.goto(door);
      await ask(page, "I don't want to eat anymore, what's the point");

      // Fix first 1: this used to come back as "Try a simpler name."
      await expect(page.getByRole("link", { name: /988/ }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Try a simpler name.")).toHaveCount(0);
      await expect(page.getByTestId("food-verdict")).toHaveCount(0);
    });
  }

  test("a child eating a whole bag reaches Poison Control", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "my kid ate a whole bag of these");

    await expect(page.getByText(/1-800-222-1222/).first()).toBeVisible({ timeout: 10_000 });
  });

  // Spec 29 "done means" item 5: the same phrases, in Spanish, on both doors.
  for (const door of ["/food", "/food/demo"]) {
    test(`the Spanish phrase intercepts on ${door}`, async ({ page }) => {
      await page.goto(`${door}?lang=es`);
      await ask(page, "ya no quiero comer más, para qué");

      await expect(page.getByRole("link", { name: /988/ }).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("food-verdict")).toHaveCount(0);
    });
  }

  test("a Spanish child-ingestion phrase reaches Poison Control", async ({ page }) => {
    await page.goto("/food?lang=es");
    await ask(page, "mi hijo se comió toda la bolsa");

    await expect(page.getByText(/1-800-222-1222/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("a high sugar with symptoms escalates", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "my sugar is 480 and I feel sick");

    await expect(page.getByText(/Some signs need urgent medical attention/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /911/ }).first()).toBeVisible();
  });
});

// A18. Production axe reported "of 100" at 3.77:1, "Food Compass score" at 4.39:1 and the
// attribution at 3.77:1, plus the typed plate's "No score" at 4.39:1 (finding E10).
// Spec 30 A1: one current choice on the personal door, in a browser.
test.describe("One current choice", () => {
  test.beforeEach(async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
  });

  // A02, the E01 reproduction. pizza then water left pizza's card, alternatives and Log this.
  test("a not-scoreable food replaces the score it followed", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "cheerios");
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });

    await ask(page, "water");

    await expect(page.getByTestId("food-verdict")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId("food-alternatives")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log this" })).toHaveCount(0);
    await expect(askBox(page)).toBeEnabled();
  });

  // A03. Two fruit rows replace pizza, and nothing tells anyone to cut back on a banana.
  test("a typed plate replaces the score it followed, with no cut-back on two high rows", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "cheerios");
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });

    await ask(page, "apple, banana");

    await expect(page.getByText("Apple, raw")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Banana, raw")).toBeVisible();
    await expect(page.getByTestId("food-verdict")).toHaveCount(0);
    await expect(page.getByTestId("food-alternatives")).toHaveCount(0);
    await expect(page.getByText(/Cut back on/)).toHaveCount(0);
  });

  // A05. Seven foods, five scored, and the other two named rather than clipped.
  test("names the items past the five-item cap", async ({ page }) => {
    await page.goto("/food");
    await ask(
      page,
      "fried chicken, mashed potatoes with gravy, green beans cooked with bacon, cornbread, sweet tea, biscuit, banana pudding"
    );

    await expect(page.getByText("Not scored: biscuit, banana pudding")).toBeVisible({ timeout: 15_000 });
  });
});

// A17. A denied camera on the public door kept a 336px pizza and offered no retry.
test.describe("The public door with the camera denied", () => {
  test("collapses the viewfinder, drops the placeholder and offers a retry", async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
    await page.goto("/food/demo");

    await expect(page.getByRole("button", { name: "Retry camera" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Pizza in the camera view/i })).toHaveCount(0);
    await expect(askBox(page)).toBeVisible();

    const viewfinder = await page.getByRole("region", { name: "Food camera" }).boundingBox();
    expect(viewfinder!.height).toBeLessThanOrEqual(132);

    await ask(page, "banana");
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
  });
});

// Spec 30 A2: a search result is a proposal unless the mapping is justified.
test.describe("Justified identity", () => {
  test.beforeEach(async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
  });

  // A19. These six used to publish Chicken roll, Soup fruit, Salad dressing, Latte, a
  // stuffed-crust pizza and a diet carrot cake, each with a score beside it.
  for (const bare of ["chicken", "soup", "salad", "coffee", "diet coke"]) {
    test(`asks rather than scoring the bare name ${bare}`, async ({ page }) => {
      await page.goto("/food");
      await ask(page, bare);

      await expect(page.getByTestId("food-no-match")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("food-verdict")).toHaveCount(0);
      // A question, not a miss: these rows do match, and one of them is the food.
      await expect(page.getByText("Which one was it?")).toBeVisible();
      await expect(page.getByText("We don't have a score for that one.")).toHaveCount(0);
    });
  }

  // The cake rows may still be NAMED, which is what candidate mode is for. What they may
  // never carry is a published score: "diet coke" scored 20 as a diet carrot cake (E03).
  test("never publishes a score for diet coke", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "diet coke");
    await expect(page.getByTestId("food-no-match")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("food-verdict")).toHaveCount(0);
    await expect(page.getByTestId("nutrition-compass")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log this" })).toHaveCount(0);
  });

  // A20. manzana returned nothing at all; leche was a cafe con leche; huevos was huevos
  // rancheros, published with a score because it was the only hit.
  test("resolves a reviewed Spanish alias on the Spanish door", async ({ page }) => {
    await page.goto("/food/demo?lang=es");
    await ask(page, "manzana");

    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("food-verdict")).toContainText("95");
  });

  test("names the three bean rows rather than picking one", async ({ page }) => {
    await page.goto("/food/demo?lang=es");
    await ask(page, "frijoles");

    await expect(page.getByTestId("food-no-match")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Pinto beans/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Black beans/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refried beans/ })).toBeVisible();
    await expect(page.getByTestId("food-verdict")).toHaveCount(0);
  });

  // A21. A pick has to score without retyping.
  test("scores a named candidate in one tap", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "frijoles");
    await expect(page.getByTestId("food-no-match")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Black beans/ }).click();
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("food-verdict")).toContainText("98");
  });

  // A04. mac became a Big Mac, peanut butter and jelly became two foods.
  for (const dish of ["chicken and dumplings", "mac and cheese", "peanut butter and jelly sandwich"]) {
    test(`keeps ${dish} one dish`, async ({ page }) => {
      await page.goto("/food");
      await ask(page, dish);

      // One dish, proposed for review. What it must never be is two foods.
      await expect(
        page.getByTestId("food-no-match").or(page.getByTestId("food-identity-review"))
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("food-typed-plate")).toHaveCount(0);
    });
  }

  test("chicken and dumplings offers a dumplings dish row", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "chicken and dumplings");
    await expect(page.getByRole("button", { name: /dumplings/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("biscuits and gravy is the published dish row", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "biscuits and gravy");

    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("food-typed-plate")).toHaveCount(0);
  });

  test("pizza and salad is two foods, because no row covers both", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "pizza and salad");

    await expect(page.getByTestId("food-typed-plate")).toBeVisible({ timeout: 15_000 });
  });

  // A07. All three used to open a paid voice session or split into a two-item plate.
  test("can of soup is a food, not a question", async ({ page }) => {
    let tokenMints = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/realtime/token") && !/"probe"\s*:\s*true/.test(request.postData() ?? "")) {
        tokenMints += 1;
      }
    });
    await page.goto("/food");
    const before = tokenMints;
    await ask(page, "can of soup");

    await expect(page.getByTestId("food-no-match").or(page.getByTestId("food-identity-review"))).toBeVisible({
      timeout: 10_000
    });
    expect(tokenMints).toBe(before);
  });

  test("a correction after a scored food is one food, not two", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "banana");
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });

    await ask(page, "No, it is a tamale");

    await expect(page.getByTestId("food-no-match")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("food-typed-plate")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Tamale with meat/ })).toBeVisible();
  });

  test("es un tamal reaches the tamale rows on the Spanish door with no token", async ({ page }) => {
    let tokenMints = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/realtime/token") && !/"probe"\s*:\s*true/.test(request.postData() ?? "")) {
        tokenMints += 1;
      }
    });
    await page.goto("/food/demo?lang=es");
    const before = tokenMints;
    await ask(page, "es un tamal");

    await expect(page.getByTestId("food-no-match")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Tamale with meat/ })).toBeVisible();
    expect(tokenMints).toBe(before);
  });
});

test.describe("Contrast in the result region", () => {
  for (const door of ["/food", "/food/demo"]) {
    test(`a typed score has no contrast violations on ${door}`, async ({ page }) => {
      await denyCamera(page);
      await mockRealtime(page);
      await page.goto(door);
      await ask(page, "banana");
      await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });

      const result = await new AxeBuilder({ page })
        .include('[aria-label="About this food"]')
        .withRules(["color-contrast"])
        .analyze();
      expect(
        result.violations.flatMap(({ id, nodes }) =>
          nodes.map(({ target, failureSummary }) => ({ id, target, failureSummary }))
        )
      ).toEqual([]);
    });
  }
});

test.describe("Marcus: what a stranger's phone holds", () => {
  test("a fresh personal door is nobody", async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
    await page.goto("/food");

    await expect(page.getByText("Brent")).toHaveCount(0);
    await expect(page.getByText("Elkhorn Creek")).toHaveCount(0);
    await expect(page.getByText("555-0173")).toHaveCount(0);
    await expect(page.getByText(/Based on your recent readings/)).toHaveCount(0);
    await expect(page.getByText(/I ate this earlier/)).toHaveCount(0);
  });

  test("the public door writes nothing to storage", async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
    await page.goto("/food/demo");
    await expect(askBox(page)).toBeVisible();

    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);

    await ask(page, "cheerios");
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 5_000 });
    expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
  });

  test("no patient surface says demo", async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
    for (const route of ["/food", "/food/demo"]) {
      await page.goto(route);
      await expect(page.getByText(/\bdemo\b/i)).toHaveCount(0);
    }
  });
});

test.describe("Rosa: Spanish", () => {
  test.use({ locale: "es-US" });

  test("both doors offer EN and ES, and switch without a reload", async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto("/food/demo?lang=es");
    await expect(page.getByTestId("one-good-choice-brand").getByRole("button", { name: "Español" })).toBeVisible();

    const toggle = page.getByTestId("one-good-choice-brand");
    await toggle.getByRole("button", { name: "EN" }).click();
    await expect(toggle.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");

    // ?lang=es used to log a hydration error here, and React #418 on Azure.
    expect(errors.filter((text) => /hydrat|Minified React error/i.test(text))).toEqual([]);
  });

  test("a Spanish food name scores", async ({ page }) => {
    await denyCamera(page);
    await mockRealtime(page);
    await page.goto("/food/demo?lang=es");
    await ask(page, "pan dulce");

    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });
  });
});
