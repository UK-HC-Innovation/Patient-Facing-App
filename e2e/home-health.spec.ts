import { expect, test, type Page } from "@playwright/test";

// A cold `next dev` compiles each route on its first request, and one compile
// can spend a whole test's budget before its first assertion. Warm the routes
// this file walks, once per worker, so a failure here means the app is wrong
// rather than the server was busy.
const BASE_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`;
const ROUTES = [
  "/today",
  "/menu",
  "/numbers",
  "/medicines",
  "/chat",
  "/visits",
  "/checkin/phq9",
  "/support",
  "/privacy",
  "/screening?entry=sms",
  // API routes compile on first hit too. A GET against a POST-only handler
  // answers 405 and compiles it all the same.
  "/api/coach/text",
  "/api/route/classify",
  "/api/usage"
];

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(180000);
  const request = await playwright.request.newContext();
  await Promise.all(ROUTES.map((route) => request.get(`${BASE_URL}${route}`).catch(() => undefined)));
  await request.dispose();
});

// The default patient is empty (spec 29 P2): no name, no clinic, no medicines,
// no readings, no history. Anything that needs a record loads the sample
// patient the one way the app offers it, so these tests exercise the same door
// a demoer uses instead of writing a fixture straight into storage.
async function loadSamplePatient(page: Page): Promise<void> {
  await page.goto("/menu");
  await page.getByRole("button", { name: "Load a sample patient (Brent)" }).click();
  await expect(page).toHaveURL(/\/screening\?entry=sms$/, { timeout: 15000 });
}

test("patient logs BP, captures a barrier, asks coach, and views Health Brief", async ({ page }) => {
  // Five routes in one journey; a cold dev server compiles each on first hit.
  test.slow();
  await loadSamplePatient(page);

  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();

  await page.getByRole("link", { name: "All my health" }).click();
  await page.getByRole("link", { name: /^My Numbers/ }).click();
  await expect(page.getByRole("heading", { name: "My Numbers" })).toBeVisible();
  await page.getByLabel("Top number").fill("151");
  await page.getByLabel("Bottom number").fill("92");
  await page.getByLabel("Pulse").fill("72");
  await page.getByLabel("Morning").check();
  await page.getByRole("button", { name: "Save reading" }).click();
  await expect(page.getByText("Rest quietly for 5 minutes")).toBeVisible();

  await page.getByRole("link", { name: "All my health" }).click();
  await page.getByRole("link", { name: /^My Medicines/ }).click();
  await expect(page.getByRole("heading", { name: "My Medicines" })).toBeVisible();
  const lisinoprilCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Lisinopril" }) });
  await lisinoprilCard.getByLabel("It costs too much").check();
  await expect(lisinoprilCard.getByRole("checkbox", { name: "It costs too much" })).toBeChecked();

  await page.getByRole("link", { name: "All my health" }).click();
  await page.getByRole("link", { name: /^Coach/ }).click();
  // Exact: the page also carries a "Talk with the coach" heading.
  await expect(page.getByRole("heading", { name: "Coach", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Why does this matter?" }).click();
  await page.getByLabel("Message").fill("Why am I taking lisinopril?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Lisinopril is in your plan because/i)).toBeVisible();

  await page.getByRole("link", { name: "All my health" }).click();
  await page.getByRole("link", { name: /^My Visits/ }).click();
  await expect(page.getByRole("heading", { name: "My Health Brief" })).toBeVisible();

  const readingsSection = page.getByRole("heading", { name: "Recent home readings" });
  await expect(readingsSection).toBeVisible();
  await expect(readingsSection.locator("..").locator("..").getByText("151/92")).toBeVisible();

  const medicationSection = page.getByRole("heading", { name: "Medicines and barriers" });
  await expect(medicationSection).toBeVisible();
  await expect(
    medicationSection.locator("..").locator("..").getByText(/Lisinopril.*Barriers: cost/i)
  ).toBeVisible();
});

test("the collapsed nav reaches a feature through the All my health menu", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());

  await page.goto("/today");
  await page.getByRole("link", { name: "All my health" }).click();
  await expect(page.getByRole("heading", { name: "All my health" })).toBeVisible();

  await page.getByRole("link", { name: /^My Numbers/ }).click();
  await expect(page.getByRole("heading", { name: "My Numbers" })).toBeVisible();
});

test("the home composer routes a spoken-style command to the right screen", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());

  await page.goto("/today");
  await page.getByPlaceholder("Tell me what you need…").fill("show my medicines");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "My Medicines" })).toBeVisible();
});

test("a typed crisis turn shows 988/911 deep links and locks the composer", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());

  await page.goto("/chat");
  await page.getByLabel("Message").fill("I want to die");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("link", { name: /Call 988/ })).toHaveAttribute("href", "tel:988");
  await expect(page.getByRole("link", { name: /Text 988/ })).toHaveAttribute("href", "sms:988");
  await expect(page.getByRole("link", { name: /Call 911/ })).toHaveAttribute("href", "tel:911");

  await expect(page.getByLabel("Message")).toBeDisabled();
  await page.getByRole("button", { name: /seen this/i }).click();
  await expect(page.getByLabel("Message")).not.toBeDisabled();
});

test("a caregiver crisis from home opens crisis chat instead of feature navigation", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());

  await page.goto("/today");
  await page.getByLabel("Tell me what you need").fill("honestly she's been saying she wants to die");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("link", { name: /Call 988/ })).toHaveAttribute("href", "tel:988");
  await expect(page.getByRole("link", { name: /Call 911/ })).toHaveAttribute("href", "tel:911");
  await expect(page.getByLabel("Message")).toBeDisabled();
});

test("a positive PHQ-9 item 9 routes to the crisis surface", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());

  await page.goto("/checkin/phq9");
  await page.getByRole("button", { name: /start the check-in/i }).click();

  // Scope to the question area: the persistent UrgentHelp disclosure in the
  // header is a <details>, whose implicit role is also "group".
  const groups = page.getByRole("main").getByRole("group");
  const count = await groups.count();
  for (let index = 0; index < count; index += 1) {
    const group = groups.nth(index);
    const optionName = index === count - 1 ? "Several days" : "Not at all";
    await group.getByRole("radio", { name: optionName }).check();
  }

  // The sticky bottom nav overlays the bottom-of-page submit on the mobile
  // viewport; dispatch the click straight to the (real, enabled) submit button.
  await page.getByRole("button", { name: "Submit" }).dispatchEvent("click");
  await expect(page.getByRole("link", { name: /Call 988/ })).toHaveAttribute("href", "tel:988");
});

test("the support screen surfaces county-first local resources", async ({ page }) => {
  await loadSamplePatient(page);

  await page.goto("/support");
  const foodGroup = page.getByRole("group").filter({ hasText: "food would run out" });
  await foodGroup.getByRole("radio", { name: "Yes" }).check();
  await page.getByRole("button", { name: /See support/ }).dispatchEvent("click");

  await expect(page.getByText("Perry County food resources")).toBeVisible();
});

test("the PDC coverage card appears on medicines for the sample patient", async ({ page }) => {
  await loadSamplePatient(page);

  await page.goto("/medicines");
  await expect(page.getByRole("heading", { name: "Diabetes medicine coverage" })).toBeVisible();
  await expect(page.getByText(/estimate from refills you logged/)).toBeVisible();
});

test("a fresh session carries no patient until the menu loads the sample one", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());

  // Blank means blank: nobody is Brent on a phone that just opened the app.
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.getByText(/Brent/)).toHaveCount(0);

  await page.goto("/medicines");
  await expect(page.getByText(/Lisinopril/)).toHaveCount(0);
});

test("loading the sample patient from the menu brings his record with him", async ({ page }) => {
  await loadSamplePatient(page);

  await page.goto("/privacy");
  await expect(page.getByText(/Recorded a skipped metformin dose/i)).toBeVisible();
});
