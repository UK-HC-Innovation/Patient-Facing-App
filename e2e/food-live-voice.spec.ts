import { expect, test, type Page } from "@playwright/test";

/**
 * GPT-Live-1 on the food doors (docs/handoffs/30-onegoodchoice-gpt-live-1.md).
 *
 * GPT-Live cannot hold a reply for the safety gate, so a typed line never goes near it: a food
 * is a lookup, a dosing question is refused before anything is sent, and a question takes the
 * text path. The mic is the only way into a Live session, and it starts one with the browser's
 * offer at /api/live/session, never with a client secret.
 */

/** The fake-UI flag grants the camera whatever Playwright says, so denial is an override. */
const CAMERA_DENIED = `
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      ...navigator.mediaDevices,
      getUserMedia: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"))
    }
  });
`;

/** Camera refused, microphone left alone: the mic test needs a real (fake-device) track. */
const CAMERA_ONLY_DENIED = `
  (() => {
    const devices = navigator.mediaDevices;
    const original = devices.getUserMedia.bind(devices);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        ...devices,
        getUserMedia: (constraints) =>
          constraints && constraints.video
            ? Promise.reject(new DOMException("Permission denied", "NotAllowedError"))
            : original(constraints)
      }
    });
  })();
`;

function askBox(page: Page) {
  return page.getByRole("textbox").first();
}

async function ask(page: Page, text: string) {
  await askBox(page).fill(text);
  await page.getByRole("button", { name: /^(Ask|Preguntar)$/ }).click();
}

/** Every token answer says this door is on GPT-Live, the probe included. */
async function onTheLiveEngine(page: Page) {
  await page.route("**/api/realtime/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "live", engine: "live", model: "gpt-live-1" })
    })
  );
}

// A fresh dev server compiles the identify route, and its 5 MB table, on the first lookup. Run
// on its own this spec is first in line, and under load that compile outlasted the verdict wait.
test.beforeAll(async ({ request }) => {
  await request.post("/api/food/identify", { data: { text: "banana" }, timeout: 120_000 });
});

for (const door of ["/food", "/food/demo"]) {
  test(`typed lines never open a GPT-Live session on ${door}`, async ({ page }) => {
    await page.addInitScript(CAMERA_DENIED);
    await onTheLiveEngine(page);
    let liveStarts = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/live/session")) liveStarts += 1;
    });

    await page.goto(door);
    await ask(page, "banana");
    await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });

    await ask(page, "how many units for this?");
    await expect(
      page.getByText(/cannot tell you to stop, start, or change a medication dose/)
    ).toBeVisible({ timeout: 10_000 });

    await ask(page, "is this a good choice?");
    await expect(page.getByText(/Thinking/)).toHaveCount(0, { timeout: 15_000 });
    await expect(askBox(page)).toBeEnabled();
    expect(liveStarts).toBe(0);
  });
}

test("the mic starts GPT-Live with the browser's offer and the voice rules, and a failed start leaves typing working", async ({
  page
}) => {
  await page.addInitScript(CAMERA_ONLY_DENIED);
  await onTheLiveEngine(page);
  let sessionBody: { sdp?: string; instructions?: string; language?: string; crisisOpen?: boolean } | null = null;
  await page.route("**/api/live/session", async (route) => {
    sessionBody = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ mode: "error", message: "session_request_failed" })
    });
  });

  await page.goto("/food/demo");
  await page.getByRole("button", { name: "Start", exact: true }).click();

  await expect.poll(() => sessionBody, { timeout: 15_000 }).not.toBeNull();
  expect(sessionBody).toMatchObject({ language: "en", crisisOpen: false });
  expect(sessionBody!.sdp).toMatch(/^v=0/);
  expect(sessionBody!.instructions).toContain("Rules for this live voice session");

  await expect(askBox(page)).toBeEnabled();
  await ask(page, "banana");
  await expect(page.getByTestId("food-verdict")).toBeVisible({ timeout: 10_000 });
});
