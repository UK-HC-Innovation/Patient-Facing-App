import { expect, test } from "@playwright/test";

test.describe("Ladder clinic impact demo", () => {
  test("renders the frozen measures without overlays, console errors, or horizontal clipping", async ({
    page
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/ladder/impact");

    await expect(page).toHaveTitle("Ladder clinic impact dashboard — demo");
    await expect(page.getByRole("heading", { level: 1, name: "Clinic impact dashboard" })).toBeVisible();
    await expect(page.getByText("Demo only · synthetic · on-device")).toBeVisible();
    await expect(page.getByTestId("impact-engagement-card")).toContainText("7 of 12");
    await expect(page.getByTestId("impact-visits-card")).toContainText("6 completed of 8");
    await expect(page.getByTestId("impact-experience-card")).toContainText("8 of 10");
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);

    await page.getByRole("link", { name: "Stakeholder demos" }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByRole("link", { name: "Open Ladder clinic impact demo" })).toBeVisible();
    await expect(
      page.frameLocator('iframe[title="Patient Centered demo"]').getByRole("heading", { name: /eye check/i })
    ).toBeVisible();
  });
});
