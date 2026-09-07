import { expect, test, type Page } from "@playwright/test";

// A cold `next dev` compiles each route on its first request, and one compile
// can spend a whole test's budget before its first assertion. Warm the routes
// this file walks, once per worker, so a failure here means the app is wrong
// rather than the server was busy.
const BASE_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`;
const ROUTES = [
  "/menu",
  "/screening?entry=sms",
  "/screening/result",
  "/today",
  "/glucose",
  "/chat",
  // API routes compile on first hit too. A GET against a POST-only handler
  // answers 405 and compiles it all the same.
  "/api/coach/text",
  "/api/screening/extract",
  "/api/usage"
];

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(180000);
  const request = await playwright.request.newContext();
  await Promise.all(ROUTES.map((route) => request.get(`${BASE_URL}${route}`).catch(() => undefined)));
  await request.dispose();
});

// The default patient is empty (spec 29 P2), so the DR pathway has no screening
// gap to work with until the sample patient is loaded. The menu button is the
// one door that loads him, and it lands on the SMS-nudge entry itself.
async function loadSamplePatient(page: Page): Promise<void> {
  await page.goto("/menu");
  await page.getByRole("button", { name: "Load a sample patient (Brent)" }).click();
  await expect(page).toHaveURL(/\/screening\?entry=sms$/, { timeout: 15000 });
}

// The DR-pathway golden path (plan 09 acceptance demo): nudge → book → snap →
// referral → silence escalation → slot booking → teachable moment → grounded
// coach answer. Deterministic fixtures, zero env vars, mock provider.
test("DR screening golden path: nudge to teachable moment to grounded coach answer", async ({ page }) => {
  // Eleven steps across six routes. Against a cold dev server every first hit
  // pays a compile, which alone can spend the default budget. Nothing here is
  // relaxed except the clock.
  test.slow();

  // 1. SMS-style nudge front door.
  await loadSamplePatient(page);
  await expect(page.getByText(/it's been \d+ months since your last diabetes eye check/)).toBeVisible();
  await page.getByRole("button", { name: /See times near me/ }).click();

  // 2. One recommendation first; book it.
  await expect(page.getByText("Recommended for you")).toBeVisible();
  await expect(page.getByText(/Tuesday 2:40 PM at Perry County FQHC Mobile Camera, 2 mi/)).toBeVisible();
  await page.getByRole("button", { name: "Book it" }).dispatchEvent("click");

  // 3. Booked state: what-to-expect + transportation ask.
  await expect(page.getByText(/Eye screening — Perry County FQHC Mobile Camera, Tuesday 2:40 PM/)).toBeVisible();
  await expect(page.getByText("About 10 minutes. Usually no dilation. No air puff. You'll know before you leave.")).toBeVisible();
  await page.getByRole("button", { name: "Yes, I have a ride" }).dispatchEvent("click");
  await expect(page.getByText(/This site offers ride support/)).toBeVisible();

  // 4. The Today feed carries the appointment.
  await page.goto("/today");
  await expect(page.getByText("Eye screening — Perry County FQHC Mobile Camera, Tuesday 2:40 PM")).toBeVisible();

  // 5. Snap the report: demo picker, moderate NPDR sheet, explicit confirm.
  await page.goto("/screening");
  await page.getByRole("link", { name: /I had my screening — read my report/ }).click();
  await expect(page.getByText("I read the printed report only — I can't check your eyes or give a diagnosis.")).toBeVisible();
  await page.getByRole("button", { name: /Read my report/ }).dispatchEvent("click");
  await page.getByRole("button", { name: /report-moderate-npdr/ }).dispatchEvent("click");
  await expect(page.getByText("Here's what I read from your report:")).toBeVisible();
  await page.getByRole("button", { name: "That's right" }).dispatchEvent("click");

  // 6. Result: locked copy + referral already sent, correct tier and window.
  await expect(
    page.getByText(
      "Your report shows changes that need a closer look by an eye doctor. This is common and treatable when caught early."
    )
  ).toBeVisible();
  await expect(
    page.getByText(/Your referral went to Hazard Optometry Associates \(Optometrist\), 2 mi — expect a call within 5 days\./)
  ).toBeVisible();

  // 7. The packet is viewable, watermarked, and honest.
  await page.getByRole("button", { name: "View referral packet" }).dispatchEvent("click");
  await expect(page.getByText("DEMO PACKET")).toBeVisible();
  await expect(page.getByText(/A real referral would also include/)).toBeVisible();

  // 8. Simulate silence past the routine window: care team pulled in.
  await page.getByRole("button", { name: /simulate 5 days passing/ }).dispatchEvent("click");
  await expect(page.getByText("We're on it — your care team has been notified.")).toBeVisible();
  await expect(page.getByText("Message for your care team")).toBeVisible();
  await expect(page.getByText(/The clinic hasn't called to confirm yet/)).toBeVisible();

  // 9. Pick a slot instead: booked, coverage note, ride re-ask.
  await page.getByRole("button", { name: "Tue Jul 14 · 9:20 AM" }).dispatchEvent("click");
  await expect(page.getByText("Booked: Tue Jul 14 · 9:20 AM")).toBeVisible();
  await expect(page.getByText(/Most Kentucky Medicaid MCO plans cover this visit/)).toBeVisible();
  await expect(page.getByText("Need a ride that day?")).toBeVisible();

  // 10. Teachable moment bridges into daily diabetes care.
  await expect(
    page.getByText("The same blood sugar that affects your eyes responds to daily care. Small steps protect your sight.")
  ).toBeVisible();
  await page.getByRole("link", { name: /My Blood Sugar/ }).dispatchEvent("click");
  await expect(page.getByRole("heading", { name: "My Blood Sugar" })).toBeVisible();

  // 11. The coach answers strictly from the confirmed report.
  await page.goto("/chat");
  await page.getByLabel("Message").fill("what did my eye report say?");
  await page.getByRole("button", { name: "Send" }).dispatchEvent("click");
  await expect(page.getByText(/Your report from .* says/)).toBeVisible();
  await expect(page.getByText(/closer look by an eye doctor/).last()).toBeVisible();
});

test("urgent tier: a PDR+DME report routes to retina with the 2-day window and urgent banner", async ({ page }) => {
  await loadSamplePatient(page);

  await page.goto("/screening");
  await page.getByRole("button", { name: "Book it" }).dispatchEvent("click");
  await page.getByRole("link", { name: /I had my screening — read my report/ }).click();
  await page.getByRole("button", { name: /Read my report/ }).dispatchEvent("click");
  await page.getByRole("button", { name: /report-pdr-dme/ }).dispatchEvent("click");
  await page.getByRole("button", { name: "That's right" }).dispatchEvent("click");

  await expect(page.getByText("Needs care soon")).toBeVisible();
  await expect(
    page.getByText(/Your referral went to UK Retina — Lexington \(Retina specialist\), 112 mi — expect a call within 2 days\./)
  ).toBeVisible();
  await expect(page.getByText("Message for your care team")).toBeVisible();
});

test("normal tier: a no-DR report closes the loop with a 12-month recall", async ({ page }) => {
  await loadSamplePatient(page);

  await page.goto("/screening");
  await page.getByRole("button", { name: "Book it" }).dispatchEvent("click");
  await page.getByRole("link", { name: /I had my screening — read my report/ }).click();
  await page.getByRole("button", { name: /Read my report/ }).dispatchEvent("click");
  await page.getByRole("button", { name: /report-no-dr/ }).dispatchEvent("click");
  await page.getByRole("button", { name: "That's right" }).dispatchEvent("click");

  await expect(page.getByText("Your report says no signs of diabetic eye disease were found.")).toBeVisible();
  await expect(page.getByText(/We'll remind you in .+ 2027\./)).toBeVisible();
});
