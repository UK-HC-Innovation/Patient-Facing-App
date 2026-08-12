import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const DESCRIPTION =
  "We live in Scott County and my three-year-old is not talking yet. I want help finding speech support and learning who to call first.";

async function useFreshStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function expectNoSeriousAxeViolations(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const actionable = result.violations.filter(({ impact }) => impact === "critical" || impact === "serious");
  expect(
    actionable.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) }))
  ).toEqual([]);
}

function collectBrowserFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const resource = request.resourceType();
    const failure = request.failure()?.errorText ?? "unknown";
    if (
      url.origin === new URL(page.url() || "http://127.0.0.1").origin &&
      ["document", "script", "stylesheet", "font"].includes(resource) &&
      !failure.includes("ERR_ABORTED")
    ) {
      failures.push(`requestfailed: ${resource} ${url.pathname} (${failure})`);
    }
  });
  return failures;
}

async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.position === "fixed" || style.display === "none") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
      })
      .map((element) =>
        `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
          element.dataset.testid ? `[data-testid='${element.dataset.testid}']` : ""
        }${element.className ? `.${String(element.className).split(/\s+/).slice(0, 3).join(".")}` : ""}:${(
          element.getAttribute("aria-label") ?? element.textContent ?? ""
        ).trim().slice(0, 60)}:${Math.round(element.getBoundingClientRect().left)}-${Math.round(
          element.getBoundingClientRect().right
        )}`
      )
      .slice(0, 10)
  );
}

async function createScottProfile(page: Page): Promise<void> {
  const disclosure = page.getByRole("button", { name: /Add or change your child's details/i });
  await disclosure.click();
  const panel = page.locator("#family-basics-panel");
  await panel.getByLabel("Kentucky county").selectOption("Scott");
  await panel.getByLabel("Birth year").fill(`${new Date().getFullYear() - 3}`);
  await panel.getByLabel("School stage").selectOption("not_school_age");
  await panel.getByRole("button", { name: "Save these details" }).click();
}

test.beforeEach(async ({ page }) => {
  await useFreshStorage(page);
});

test("first-run shell reflows at 320px and has no serious automated accessibility findings", async ({
  page
}) => {
  const failures = collectBrowserFailures(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/ladder");

  await expect(page.getByRole("heading", { name: "Ladder", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "EN", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Español/i })).toBeVisible();
  await expect(page.getByLabel("What would you like help with?")).toBeVisible();
  expect(await overflowingElements(page)).toEqual([]);
  await expectNoSeriousAxeViolations(page);

  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect(page.getByRole("button", { name: "EN", exact: true })).toBeVisible();
  await expect(page.getByLabel("What would you like help with?")).toBeVisible();
  expect(await overflowingElements(page)).toEqual([]);
  expect(failures).toEqual([]);
});

test("typed journey preserves draft, URL history, focus, and accessible unlocked surfaces", async ({
  page
}) => {
  const failures = collectBrowserFailures(page);
  await page.goto("/ladder");
  await createScottProfile(page);

  const description = page.getByLabel("What would you like help with?");
  await description.fill(DESCRIPTION);
  const notesTab = page.getByTestId("ladder-tabs").getByRole("button", { name: "Notes" });
  await notesTab.click();
  await expect(notesTab).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-ladder-panel='home']")).toBeHidden();
  await expectNoSeriousAxeViolations(page);

  const homeTab = page.getByTestId("ladder-tabs").getByRole("button", { name: "Home" });
  await homeTab.click();
  await expect(description).toHaveValue(DESCRIPTION);
  await expect(description).toBeVisible();
  await description.focus();
  await expect(description).toBeFocused();
  await page.getByRole("button", { name: "Find help" }).click();

  await expect(page.getByTestId("family-heard-strip")).toBeVisible();
  const programsTab = page.getByTestId("ladder-tabs").getByRole("button", { name: "Programs" });
  await programsTab.click();
  await expect(programsTab).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/surface=programs/);
  await expect(page.getByTestId("matched-family-resources")).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await homeTab.click();
  await expect(page).toHaveURL(/surface=home/);
  await page.goBack();
  await expect(programsTab).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("matched-family-resources")).toBeVisible();
  await page.goForward();
  await expect(homeTab).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("family-heard-strip")).toBeVisible();

  const focusedInsideHiddenPanel = await page.evaluate(() => {
    const focused = document.activeElement;
    return focused instanceof Element && focused.closest("[data-ladder-panel][hidden]") !== null;
  });
  expect(focusedInsideHiddenPanel).toBe(false);
  expect(failures).toEqual([]);
});
