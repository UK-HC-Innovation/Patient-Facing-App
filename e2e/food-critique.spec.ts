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
    await mockRealtime(page);
  });

  test("a dosing question is refused, and the box still works afterwards", async ({ page }) => {
    await page.goto("/food");
    await ask(page, "2 slices of pepperoni pizza");
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });

    await ask(page, "how many units for this?");

    // The answer arrives, finished, and the box comes back. It used to stop mid-sentence
    // and hang at "Thinking..." with the submit button disabled (critique H2, G10).
    await expect(page.getByText(/Thinking/)).toHaveCount(0, { timeout: 15_000 });
    await expect(askBox(page)).toBeEnabled();
    await expect(page.getByRole("button", { name: "Ask" })).toBeEnabled();
  });

  test("no answer is left as a half sentence under a permanent Thinking", async ({ page }) => {
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
