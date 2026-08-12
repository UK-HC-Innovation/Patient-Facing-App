import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "home-health-ai-ownership-state";
const ORDINARY_DESCRIPTION =
  "We live in Scott County and my three-year-old is not talking yet. I want help finding speech support and learning who to call first.";
const CRISIS_DESCRIPTION = "honestly she's been saying she wants to die";

async function useFreshStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("__ladder_offline_cleared") !== "true") {
      window.localStorage.clear();
      window.sessionStorage.setItem("__ladder_offline_cleared", "true");
    }
  });
}

async function warmRepeatVisit(page: Page): Promise<void> {
  await page.goto("/ladder");
  await expect(page.getByRole("heading", { name: "Ladder", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
    });
  });

  // The controlled online reload is what fills the query-free HTML shell and
  // the exact immutable chunks used by this deployment.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ladder", exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const requests = await Promise.all(
          keys
            .filter((key) => key.startsWith("ladder-shell-"))
            .map(async (key) => (await caches.open(key)).keys())
        );
        return requests.flat().map(({ url }) => new URL(url).pathname);
      })
    )
    .toEqual(expect.arrayContaining(["/ladder"]));
}

async function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = await Promise.all(
      keys
        .filter((key) => key.startsWith("ladder-shell-"))
        .map(async (key) => (await caches.open(key)).keys())
    );
    return requests.flat().map(({ url }) => url);
  });
}

test.beforeEach(async ({ page }) => {
  await useFreshStorage(page);
});

test("a warmed Ladder visit works offline and caches only its public shell", async ({
  page,
  context
}) => {
  const familyApiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/family/")) {
      familyApiRequests.push(request.url());
    }
  });

  await warmRepeatVisit(page);
  familyApiRequests.length = 0;
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Ladder", exact: true })).toBeVisible();
  await expect(page.getByLabel("What would you like help with?")).toBeVisible();
  await page.getByLabel("What would you like help with?").fill(ORDINARY_DESCRIPTION);
  await page.getByRole("button", { name: "Find help" }).click();
  await expect(page.getByTestId("family-heard-strip")).toBeVisible();
  await expect(page.getByTestId("thread-family-resources")).toBeVisible();
  expect(familyApiRequests).toEqual([]);

  const urls = await cachedUrls(page);
  expect(urls.length).toBeGreaterThan(1);
  for (const rawUrl of urls) {
    const url = new URL(rawUrl);
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(
      url.pathname === "/ladder" ||
        url.pathname === "/ladder.webmanifest" ||
        url.pathname === "/ladder-icon.svg" ||
        url.pathname.startsWith("/_next/static/")
    ).toBe(true);
    expect(url.pathname.startsWith("/api/")).toBe(false);
  }

  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key) !== null, STORAGE_KEY))
    .toBe(true);
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome back. Here's what's waiting." })).toBeVisible();
  await expect(page.getByText(/Last note:/)).toBeVisible();
  await expect(page.getByTestId("ladder-tabs").getByRole("button", { name: "Programs" })).toBeVisible();
});

test("crisis routing and 988/911 actions remain available offline without a recap send", async ({
  page,
  context
}) => {
  const familyApiRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/family/")) {
      familyApiRequests.push(request.url());
    }
  });

  await warmRepeatVisit(page);
  familyApiRequests.length = 0;
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel("What would you like help with?").fill(CRISIS_DESCRIPTION);
  await page.getByRole("button", { name: "Find help" }).click();

  const banner = page.getByTestId("family-crisis-banner");
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("link", { name: /Call 988/ })).toHaveAttribute("href", "tel:988");
  await expect(banner.getByRole("link", { name: /Text 988/ })).toHaveAttribute("href", "sms:988");
  await expect(banner.getByRole("link", { name: /Call 911/ })).toHaveAttribute("href", "tel:911");
  await expect(page.getByTestId("family-heard-strip")).toHaveCount(0);
  expect(familyApiRequests).toEqual([]);

  const persisted = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { family?: { interviews?: unknown[]; facts?: unknown[] } }) : null;
  }, STORAGE_KEY);
  expect(persisted?.family?.interviews ?? []).toHaveLength(0);
  expect(persisted?.family?.facts ?? []).toHaveLength(0);
});
