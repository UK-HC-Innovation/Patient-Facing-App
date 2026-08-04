import { expect, test, type Locator, type Page } from "@playwright/test";

const STORAGE_KEY = "home-health-ai-ownership-state";
const FROZEN_NOW = new Date("2026-07-17T12:00:00.000Z");
// Ordinary caregiver wording — not a scripted demo persona. The navigator has to
// work on whatever a parent actually types.
const PARENT_DESCRIPTION =
  "My son is in second grade and reading is really hard for him. He was just diagnosed with dyslexia. I don't know what to ask the school for, and money is tight so I keep hearing about waivers but have no idea where to start.";
const SPANISH_PARENT_DESCRIPTION =
  "Mi hijo está en segundo grado y le cuesta mucho leer. A mi hijo le diagnosticaron dislexia. No sé qué pedirle a la escuela y el dinero está escaso, sigo escuchando sobre exenciones pero no tengo idea de por dónde empezar.";
const SAFETY_PHRASE = "honestly she's been saying she wants to die";
const SPANISH_SAFETY_PHRASE = "mi hija dice que quiere morir";
// A toddler on the First Steps clock — the companion journeys start here.
const TODDLER_DESCRIPTION =
  "My son is two and barely talking. Someone said to ask about First Steps but I do not know who to call.";
// Loss of an acquired skill, in a caregiver's own plain words.
const REGRESSION_NOTE = "He stopped saying more at dinner.";
// One paragraph that already carries county and age — the resources-first path.
const RESOURCES_FIRST_DESCRIPTION =
  "We live in Scott County and my son just turned three. He isn't talking yet and I'm worried about his speech.";
const SCOTT_SOURCE_URL =
  "https://www.scott.kyschools.us/departments/student-learning/exceptional-child-services/special-education";

async function useFreshStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("__family_e2e_cleared") !== "true") {
      window.localStorage.clear();
      window.sessionStorage.setItem("__family_e2e_cleared", "true");
    }
  });
}

type CapturedFamilyRequest = {
  method: string;
  url: string;
  body: unknown;
};

async function stubUnconfiguredFamilyInterview(
  page: Page,
  onRequest?: (request: CapturedFamilyRequest) => void
): Promise<void> {
  await page.route("**/api/family/interview", async (route) => {
    const request = route.request();
    const method = request.method();
    const rawBody = request.postData();
    let body: unknown = null;
    if (method === "POST" && rawBody) {
      try {
        body = JSON.parse(rawBody) as unknown;
      } catch {
        body = rawBody;
      }
    }
    onRequest?.({ method, url: request.url(), body });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "unconfigured", data: null })
    });
  });
}

// The zero-key demo path. With ranking unconfigured the strip keeps its
// deterministic sentence instead of swapping in a model's, and the card order is
// the deterministic one — so an ordering assertion means what it says.
async function stubUnconfiguredFamilyRecommend(page: Page): Promise<void> {
  await page.route("**/api/family/recommend", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "unconfigured", data: null })
    });
  });
}

type BasicsInput = {
  county: string;
  birthYear: string;
  birthMonth?: string;
  schoolStage?: string;
  childFirstName?: string;
  diagnoses?: Array<{ name: string; month?: string }>;
  language?: "en" | "es";
};

// The navigator no longer ships fictional example shortcuts, so each journey
// builds its profile through the same basics form a caregiver would use.
// Returns the setup panel: the "here is what we heard" strip can mount a second
// copy of this same form behind its disclosure, so every field query below is
// scoped to the panel rather than to the page.
async function openBasics(page: Page, language: "en" | "es" = "en"): Promise<Locator> {
  const disclosure = page.getByRole("button", {
    name: language === "es" ? /Agrega o cambia los datos/ : /Add or change your child's details/
  });
  if ((await disclosure.getAttribute("aria-expanded")) === "false") {
    await disclosure.click();
  }
  return page.locator("#family-basics-panel");
}

async function fillBasics(page: Page, basics: BasicsInput): Promise<void> {
  const spanish = basics.language === "es";
  const setup = await openBasics(page, spanish ? "es" : "en");
  await setup.getByLabel(spanish ? "Condado de Kentucky" : "Kentucky county").selectOption(basics.county);
  await setup.getByLabel(spanish ? "Año de nacimiento" : "Birth year").fill(basics.birthYear);
  if (basics.birthMonth) {
    await setup.getByLabel(spanish ? "Mes de nacimiento" : "Birth month").selectOption(basics.birthMonth);
  }
  if (basics.schoolStage) {
    await setup.getByLabel(spanish ? "Etapa escolar" : "School stage").selectOption(basics.schoolStage);
  }
  if (basics.childFirstName) {
    await setup
      .getByLabel(spanish ? "Primer nombre del niño o niña (opcional)" : "Child's first name (optional)")
      .fill(basics.childFirstName);
  }
  for (const { name, month } of basics.diagnoses ?? []) {
    await setup.getByRole("checkbox", { name }).check();
    if (month) {
      await setup.getByLabel(`${name} diagnosis month (optional)`).fill(month);
    }
  }
  await setup.getByRole("button", { name: spanish ? "Guardar estos datos" : "Save these details" }).click();
}

// Everything the caregiver told us now lives one tap in, behind the strip's
// disclosure. Content inside a closed <details> is not actionable, so a journey
// that asserts on a relocated fact card has to open it first.
async function openHeardDisclosure(strip: Locator): Promise<void> {
  await strip.locator("summary").click();
}

async function waitForPersistedState(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate((key) => window.localStorage.getItem(key) !== null, STORAGE_KEY))
    .toBe(true);
}

async function setPersistedLanguage(page: Page, language: "en" | "es"): Promise<void> {
  await waitForPersistedState(page);
  await page.evaluate(
    ({ key, nextLanguage }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error("Expected persisted app state before changing language.");
      const state = JSON.parse(raw) as { patient?: { language?: string } };
      if (!state.patient) throw new Error("Expected a patient profile in persisted app state.");
      state.patient.language = nextLanguage;
      window.localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, nextLanguage: language }
  );
  await page.reload();
}

async function installRepeatedFinalSpeechShim(page: Page, transcript: string): Promise<void> {
  await page.addInitScript((finalTranscript) => {
    class FakeSpeechRecognition {
      lang = "";
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;

      start(): void {
        const result = Object.assign([{ transcript: finalTranscript }], { isFinal: true });
        const event = { results: [result], resultIndex: 0 };
        window.setTimeout(() => {
          this.onresult?.(event);
          this.onresult?.(event);
        }, 0);
      }

      stop(): void {}
    }

    for (const name of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      Object.defineProperty(window, name, {
        configurable: true,
        value: FakeSpeechRecognition
      });
    }
  }, transcript);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await useFreshStorage(page);
});

test("family URL redirects to ladder and keeps the query string", async ({ page }) => {
  await page.goto("/family?k=demo-passcode");
  await expect(page).toHaveURL(/\/ladder\?k=demo-passcode$/);
});

test(`golden path works on ordinary caregiver wording: ${PARENT_DESCRIPTION}`, async ({ page }) => {
  const capturedRequests: CapturedFamilyRequest[] = [];
  await stubUnconfiguredFamilyInterview(page, (request) => {
    capturedRequests.push(request);
  });
  await page.goto("/ladder?k=demo-passcode");

  await expect(page.getByRole("heading", { name: "Ladder — your child's development", level: 1 })).toBeVisible();
  await expect(page.getByText("UKHCI Ladder · concept demo — not an official service")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tell us about your child and their needs" })).toBeVisible();
  await fillBasics(page, {
    county: "Scott",
    birthYear: "2017",
    schoolStage: "elementary",
    childFirstName: "Riley",
    diagnoses: [
      { name: "Dyslexia", month: "2026-05" },
      { name: "ADHD", month: "2026-05" }
    ]
  });
  const interview = page.getByLabel("What would you like help with?");
  await interview.fill(PARENT_DESCRIPTION);
  await page.getByRole("button", { name: "Find help" }).click();

  expect(capturedRequests).toHaveLength(1);
  expect(capturedRequests[0].method).toBe("POST");
  expect(new URL(capturedRequests[0].url).search).toBe("");
  expect(capturedRequests[0].body).toMatchObject({
    text: PARENT_DESCRIPTION,
    passcode: "demo-passcode",
    language: "en"
  });

  const review = page.getByRole("region", { name: "Here is what we heard" });
  await expect(review).toBeVisible();
  await expect(review).toBeFocused();
  // The verification is one line now, and the wall of fact cards is one tap in.
  await expect(review.getByTestId("family-heard")).toContainText("Scott County");
  await openHeardDisclosure(review);
  const gradeFact = review.getByRole("article", { name: "Grade" });
  await expect(gradeFact).toBeVisible();
  await expect(gradeFact.getByRole("paragraph").filter({ hasText: /^second grade$/ })).toBeVisible();
  const diagnosisFact = review.getByRole("article", { name: "Reported diagnosis" });
  await expect(diagnosisFact).toBeVisible();
  await expect(diagnosisFact.getByRole("paragraph").filter({ hasText: /^dyslexia$/i })).toBeVisible();
  const schoolConcern = review.getByRole("article", { name: "About school and learning" });
  await expect(schoolConcern).toContainText("School and learning may need support");
  // The quote must be the caregiver's own sentence, which is what earns "From your words".
  await expect(schoolConcern).toContainText("My son is in second grade and reading is really hard for him.");
  await expect(schoolConcern).toContainText("From your words");
  await expect(review.getByText("School and IEP", { exact: true })).toBeVisible();
  await expect(review.getByText("Waivers and financial support", { exact: true })).toBeVisible();
  await expect(review.getByText("Parent support", { exact: true })).toBeVisible();
  await review.getByRole("button", { name: /Yes, that is right/ }).first().click();
  await expect(review.getByText("You said this is right")).toBeVisible();

  const matched = page.getByTestId("matched-family-resources");
  const thread = page.getByTestId("thread-family-resources");
  const cards = matched.locator("[data-family-resource-card]");
  await expect(cards.first()).toHaveAttribute("data-resource-id", "scott_county_exceptional_child_services");
  // The thread carries the head of the same list, so the lead card answers first.
  await expect(thread.locator("[data-family-resource-card]").first()).toHaveAttribute(
    "data-resource-id",
    "scott_county_exceptional_child_services"
  );
  const scottCard = matched.locator('[data-resource-id="scott_county_exceptional_child_services"]');
  await scottCard.locator("summary").click();
  const sourceLink = scottCard.getByRole("link", { name: /See their official page.*Scott County Schools/i });
  await expect(sourceLink).toHaveAttribute("href", SCOTT_SOURCE_URL);
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(matched.locator('[data-resource-id="child_waiver"]')).toBeVisible();
  await expect(matched.locator('[data-resource-id="central_kentucky_riding_for_hope"]')).toHaveCount(0);
  const nearbyRecreation = page.getByRole("region", { name: "Something else nearby" });
  await expect(
    nearbyRecreation.locator('[data-resource-id="central_kentucky_riding_for_hope"]')
  ).toBeVisible();
  await expect(page.locator('[data-resource-id="central_kentucky_riding_for_hope"]')).toHaveCount(1);

  await scottCard.getByRole("button", { name: /Save.*Scott County Schools/i }).click();
  const savedRegion = page.getByRole("region", { name: "Saved for later" });
  await expect(savedRegion.getByRole("heading", { name: "Scott County Schools Exceptional Child Services" })).toBeVisible();
  // The top three answer twice on purpose — once in the thread, once in the
  // library below. Saving adds a summary line, never a third card or a third
  // copy of any control.
  await expect(thread.locator('[data-resource-id="scott_county_exceptional_child_services"]')).toHaveCount(1);
  await expect(matched.locator('[data-resource-id="scott_county_exceptional_child_services"]')).toHaveCount(1);
  await expect(page.locator('[data-resource-id="scott_county_exceptional_child_services"]')).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Saved.*Scott County Schools/i })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Share.*Scott County Schools/i })).toHaveCount(2);
  await expect(
    page.getByRole("checkbox", { name: /I agree to share this resource now.*Scott County Schools/i })
  ).toHaveCount(2);
  await expect(savedRegion.locator("[data-family-resource-card]")).toHaveCount(0);
  await expect(savedRegion.getByRole("button", { name: /Share.*Scott County Schools/i })).toHaveCount(0);
  await expect(savedRegion.getByRole("checkbox")).toHaveCount(0);
  await expect(savedRegion.getByRole("button", { name: /we already have this/i })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        const state = raw
          ? (JSON.parse(raw) as { family?: { saved?: Array<{ resourceId?: string }> } })
          : null;
        return (
          state?.family?.saved?.some(
            ({ resourceId }) => resourceId === "scott_county_exceptional_child_services"
          ) ?? false
        );
      }, STORAGE_KEY)
    )
    .toBe(true);
  await page.reload();
  await expect(savedRegion.getByRole("heading", { name: "Scott County Schools Exceptional Child Services" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Here is what we heard" })).not.toBeFocused();

  const reloadedMatched = page.getByTestId("matched-family-resources");
  const reloadedScott = reloadedMatched.locator('[data-resource-id="scott_county_exceptional_child_services"]');
  await expect(reloadedScott.getByRole("status")).toBeEmpty();
  await reloadedScott.getByRole("checkbox", { name: /I agree to share this resource now.*Scott County Schools/i }).check();
  await reloadedScott.getByRole("button", { name: /Share.*Scott County Schools/i }).click();
  await expect(reloadedScott.getByText("Share recorded with your consent.")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        const state = raw
          ? (JSON.parse(raw) as { auditEvents?: Array<{ action?: string; label?: string }> })
          : null;
        return (
          state?.auditEvents?.filter(
            ({ action, label }) => action === "shared" && label?.includes("Scott County Schools")
          ).length ?? 0
        );
      }, STORAGE_KEY)
    )
    .toBe(1);

  const michelle = reloadedMatched.locator('[data-resource-id="michelle_p_waiver"]');
  await expect(michelle.getByText("Why it helps to start now")).toBeVisible();
  await michelle.getByRole("button", { name: /We already have this.*Michelle P/i }).click();
  await expect(michelle.getByText("You already have this")).toBeVisible();
  await expect(michelle.getByText("Why it helps to start now")).toHaveCount(0);
  await expect(michelle.getByText(/waiting list is date ordered/i)).toHaveCount(0);
  const resourceIds = await reloadedMatched.locator("[data-family-resource-card]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-resource-id"))
  );
  expect(resourceIds.at(-1)).toBe("michelle_p_waiver");

  // Exact match: several card headings end in "now", so a substring name would
  // resolve to more than the timeline's own rung.
  await expect(page.getByRole("heading", { name: "Now", level: 3, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next", level: 3, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Later", level: 3, exact: true })).toBeVisible();
});

test("a two-year-old in Perry County gets the local First Steps POE before statewide options", async ({ page }) => {
  await stubUnconfiguredFamilyInterview(page);
  await page.goto("/ladder");

  await fillBasics(page, { county: "Perry", birthYear: "2024", birthMonth: "3" });
  await page
    .getByLabel("What would you like help with?")
    .fill("My son is two and barely talking. Someone said to ask about First Steps but I do not know who to call.");
  await page.getByRole("button", { name: "Find help" }).click();

  const cards = page.getByTestId("matched-family-resources").locator("[data-family-resource-card]");
  await expect(cards.nth(0)).toHaveAttribute("data-resource-id", "first_steps_kentucky_river");
  await expect(cards.nth(1)).toHaveAttribute("data-resource-id", "first_steps_statewide");
  await expect(page.getByRole("heading", { name: "Contact First Steps now" })).toBeVisible();
});

test("conversational path: describe first, then county, year, and school stage are asked as turns", async ({
  page
}) => {
  await stubUnconfiguredFamilyInterview(page);
  await page.goto("/ladder");

  await expect(page.getByRole("heading", { name: "Tell us about your child and their needs" })).toBeVisible();
  await page
    .getByLabel("What would you like help with?")
    .fill("Reading is really hard for him at school and I keep hearing about waivers.");
  await page.getByRole("button", { name: "Find help" }).click();

  await expect(page.getByRole("region", { name: "Here is what we heard" })).toBeVisible();
  await expect(page.getByTestId("matched-family-resources")).toHaveCount(0);

  const turns = page.getByTestId("family-basics-turns");
  await expect(page.getByRole("heading", { name: "What has the school offered so far?" })).toHaveCount(0);
  await turns.getByLabel(/which Kentucky county do you live in/i).selectOption("Scott");
  await turns.getByRole("button", { name: "Next" }).click();
  await turns.getByLabel(/What year was your child born/i).fill("2017");
  await turns.getByRole("button", { name: "Next" }).click();
  await turns.getByRole("button", { name: "Elementary school" }).click();

  await expect(page.getByRole("heading", { name: "What has the school offered so far?" })).toBeVisible();
  // The pointer paragraph is gone: the thread now carries the real top-three
  // cards, and only the link points down at the rest.
  await expect(page.getByText(/places that can help — they're just below/i)).toHaveCount(0);
  const thread = page.getByTestId("thread-family-resources");
  await expect(thread.locator("[data-family-resource-card]")).toHaveCount(3);
  await expect(thread.getByRole("link", { name: /See all \d+ places below/ })).toHaveAttribute(
    "href",
    "#family-resources"
  );
  await expect(
    page
      .getByTestId("matched-family-resources")
      .locator('[data-resource-id="scott_county_exceptional_child_services"]')
  ).toBeVisible();
});

test("demo timeline control backdates diagnosis data and advances staged nudges without faking the clock", async ({
  page
}) => {
  await page.goto("/ladder");
  await fillBasics(page, {
    county: "Scott",
    birthYear: "2017",
    schoolStage: "elementary",
    diagnoses: [
      { name: "Dyslexia", month: "2026-05" },
      { name: "ADHD", month: "2026-05" }
    ]
  });
  await page
    .getByLabel("What would you like help with?")
    .fill("Reading is really hard for him at school and my other kids need attention too. I am exhausted.");
  await page.getByRole("button", { name: "Find help" }).click();

  const timeline = page.getByRole("region", { name: "What to do, and when" });
  await expect(
    timeline.getByRole("region", { name: "Now" }).getByRole("heading", { name: "Talk to another parent" })
  ).toBeVisible();
  await expect(
    timeline
      .getByRole("region", { name: "Next" })
      .getByRole("heading", { name: "Look into help for siblings and a break for you" })
  ).toBeVisible();

  await timeline.getByRole("button", { name: "Demo timeline control" }).click();
  await timeline.getByRole("button", { name: "Set diagnosis dates to this month" }).click();
  await expect(
    timeline.getByRole("region", { name: "Next" }).getByRole("heading", { name: "Talk to another parent" })
  ).toBeVisible();
  await expect(
    timeline
      .getByRole("region", { name: "Later" })
      .getByRole("heading", { name: "Look into help for siblings and a break for you" })
  ).toBeVisible();

  await timeline.getByRole("button", { name: "Set diagnosis dates to 6 months ago" }).click();
  const current = timeline.getByRole("region", { name: "Now" });
  await expect(current.getByRole("heading", { name: "Talk to another parent" })).toBeVisible();
  await expect(current.getByRole("heading", { name: "Look into help for siblings and a break for you" })).toBeVisible();
  const setup = await openBasics(page);
  await expect(setup.getByLabel("Dyslexia diagnosis month (optional)")).toHaveValue("2026-01");
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        const state = raw
          ? (JSON.parse(raw) as { family?: { profile?: { diagnoses?: Array<{ diagnosedAt?: string }> } } })
          : null;
        return state?.family?.profile?.diagnoses?.map(({ diagnosedAt }) => diagnosedAt) ?? [];
      }, STORAGE_KEY)
    )
    .toEqual(["2026-01", "2026-01"]);
  expect(await page.evaluate(() => Date.now())).toBe(FROZEN_NOW.valueOf());
});

test("Ladder is reachable from both Menu and the home composer", async ({ page }) => {
  await page.goto("/menu");

  await page.getByRole("link", { name: /^Ladder — your child's development/ }).click();
  await expect(page.getByRole("heading", { name: "Ladder — your child's development", level: 1 })).toBeVisible();

  await page.goto("/today");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Tell me what you need").fill("help for my daughter");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Ladder — your child's development", level: 1 })).toBeVisible();
});

test(`Safety phrase raises the banner in-thread and never reaches the network: ${SAFETY_PHRASE}`, async ({
  page
}) => {
  let familyApiRequests = 0;
  await stubUnconfiguredFamilyInterview(page, () => {
    familyApiRequests += 1;
  });
  await page.goto("/ladder");

  await page.getByLabel("What would you like help with?").fill(SAFETY_PHRASE);
  await page.getByRole("button", { name: "Find help" }).click();

  const banner = page.getByTestId("family-crisis-banner");
  await expect(banner).toBeVisible();
  await expect(banner.getByRole("link", { name: /Call 988/ })).toHaveAttribute("href", "tel:988");
  await expect(banner.getByRole("link", { name: /Text 988/ })).toHaveAttribute("href", "sms:988");
  await expect(banner.getByRole("link", { name: /Call 911/ })).toHaveAttribute("href", "tel:911");
  // The navigator stays put and keeps helping instead of redirecting away.
  await expect(page).toHaveURL(/\/ladder$/);
  // The strip labels itself with the same heading, which now sits inside its
  // collapsed disclosure — the region is the on-screen proof it survived.
  await expect(page.getByRole("region", { name: "Here is what we heard" })).toBeVisible();
  expect(familyApiRequests).toBe(0);

  await banner.getByRole("button", { name: /I've seen this/i }).click();
  await expect(banner.getByRole("button", { name: /I've seen this/i })).toHaveCount(0);
  await expect(banner).toBeVisible();
});

test("Spanish mobile mock path is substantive, language-correct, and horizontally contained", async ({
  page
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-specific Spanish acceptance coverage.");
  const capturedRequests: CapturedFamilyRequest[] = [];
  await stubUnconfiguredFamilyInterview(page, (request) => {
    capturedRequests.push(request);
  });
  await page.goto("/ladder");
  await setPersistedLanguage(page, "es");

  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await fillBasics(page, {
    county: "Scott",
    birthYear: "2017",
    schoolStage: "elementary",
    language: "es"
  });
  const interview = page.getByLabel("¿Con qué te gustaría recibir ayuda?");
  await interview.fill(SPANISH_PARENT_DESCRIPTION);
  await page.getByRole("button", { name: "Buscar ayuda" }).click();

  expect(capturedRequests).toHaveLength(1);
  expect(capturedRequests[0].method).toBe("POST");
  expect(capturedRequests[0].body).toMatchObject({
    text: SPANISH_PARENT_DESCRIPTION,
    language: "es"
  });
  const review = page.getByRole("region", { name: "Esto fue lo que entendimos" });
  await expect(review).toBeVisible();
  await expect(review.getByTestId("family-heard")).toContainText("condado de Scott");
  await expect(review.getByText("Revisa o cambia esto")).toBeVisible();
  await openHeardDisclosure(review);
  await expect(review.getByRole("article", { name: "Grado" })).toContainText("segundo grado");
  await expect(review.getByRole("article", { name: "Diagnóstico informado" })).toContainText("dislexia");
  await expect(review.getByRole("article", { name: "Sobre la escuela y el aprendizaje" })).toBeVisible();
  await expect(
    review.getByText(/Mencionaste la escuela/)
  ).toBeVisible();
  await expect(
    page.getByText(/vienen directo de las organizaciones.*en inglés/i)
  ).toBeVisible();
  // The catalog card renders twice by design now, so the Spanish assertions name
  // the section they belong to.
  const matched = page.getByTestId("matched-family-resources");
  await expect(
    matched.getByRole("heading", { name: "Scott County Schools Exceptional Child Services" })
  ).toBeVisible();
  await expect(
    matched.getByText(/district special-education office and named contacts/i)
  ).toBeVisible();
  await expect(
    page.getByTestId("thread-family-resources").getByRole("heading", {
      name: "Scott County Schools Exceptional Child Services"
    })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
});

test(`Spanish safety raises the banner without any family API request: ${SPANISH_SAFETY_PHRASE}`, async ({
  page
}) => {
  let familyApiRequests = 0;
  await stubUnconfiguredFamilyInterview(page, () => {
    familyApiRequests += 1;
  });
  await page.goto("/ladder");
  await setPersistedLanguage(page, "es");

  await page.getByLabel("¿Con qué te gustaría recibir ayuda?").fill(SPANISH_SAFETY_PHRASE);
  await page.getByRole("button", { name: "Buscar ayuda" }).click();

  const banner = page.getByTestId("family-crisis-banner");
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/mereces apoyo real de una persona/i)).toBeVisible();
  await expect(banner.locator('a[href="tel:988"]')).toBeVisible();
  await expect(banner.locator('a[href="sms:988"]')).toBeVisible();
  await expect(banner.locator('a[href="tel:911"]')).toBeVisible();
  await expect(banner.getByRole("button", { name: /Ya lo vi.*continuar/i })).toBeVisible();
  await expect(page).toHaveURL(/\/ladder$/);
  expect(familyApiRequests).toBe(0);
});

test("the Breathitt case leads with school procedure and keeps the banner in-thread", async ({ page }) => {
  let familyApiRequests = 0;
  await stubUnconfiguredFamilyInterview(page, () => {
    familyApiRequests += 1;
  });
  await page.goto("/ladder");

  await page
    .getByLabel("What would you like help with?")
    .fill(
      "I have a seven-year-old who has behavioral issues. He has seemingly explosive anger. " +
        "He has been kicked out of school several times for violence and acting out. " +
        "He has been harmful towards animals. We live in Breathitt County and we need help."
    );
  await page.getByRole("button", { name: "Find help" }).click();

  // Safety first, and the conversation survives it.
  const banner = page.getByTestId("family-crisis-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("data-safety-domain", "harm_to_others");
  await expect(banner.getByText(/emergency department/i)).toBeVisible();
  await banner.getByRole("button", { name: /I've seen this/i }).click();

  // Basics came out of the caregiver's own words — applied on sight, with no
  // confirm card and no turns, and marked as read-not-stated until someone checks.
  await expect(page.getByTestId("family-basics-prefill")).toHaveCount(0);
  await expect(page.getByTestId("family-basics-turns")).toHaveCount(0);
  const strip = page.getByTestId("family-heard-strip");
  await expect(strip.getByTestId("family-heard")).toContainText("Breathitt County");
  await expect(strip.getByTestId("family-heard-guess-chip")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        const state = raw
          ? (JSON.parse(raw) as {
              family?: { profile?: { county?: string }; profileProvenance?: string };
            })
          : null;
        return [state?.family?.profile?.county ?? null, state?.family?.profileProvenance ?? null];
      }, STORAGE_KEY)
    )
    .toEqual(["Breathitt", "extracted"]);

  // The lead is school procedure, not help-with-reading.
  const cards = page.getByTestId("matched-family-resources").locator("[data-family-resource-card]");
  await expect(cards.first()).toBeVisible();
  const resourceIds = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-resource-id"))
  );
  expect(resourceIds).toContain("idea_school_discipline");
  expect(resourceIds).toContain("kde_evaluation_request");
  expect(resourceIds.slice(0, 3)).not.toContain("kde_parent_toolbox");

  // Zero-key demo: the whole beat ran without one live call.
  expect(familyApiRequests).toBe(0);
});

test("speech recognition ignores a repeated final-result replay", async ({ page }) => {
  const transcript = "reading support from the microphone";
  await installRepeatedFinalSpeechShim(page, transcript);
  await page.goto("/ladder");
  const interview = page.getByLabel("What would you like help with?");
  await interview.fill("");

  await page.getByRole("button", { name: "Start speaking" }).click();

  await expect(interview).toHaveValue(transcript);
});

test("ladder walks a family from waitlist to a confirmed evaluation visit", async ({ page }) => {
  await stubUnconfiguredFamilyInterview(page);
  await page.goto("/ladder");

  await fillBasics(page, { county: "Scott", birthYear: "2019", schoolStage: "elementary" });

  const card = page.getByTestId("family-appointment-card");
  await expect(card).toBeVisible();
  await expect(card.getByText("UKHCI Ladder · concept demo — not an official service")).toBeVisible();
  await card.getByRole("button", { name: "Show me (demo)" }).click();

  // Book the first offered slot
  await card.getByRole("button").filter({ hasText: /,/ }).first().click();
  await expect(card.getByText(/Booked for.*\(demo\)/)).toBeVisible();
  await expect(card.getByText("How to get ready")).toBeVisible();

  // Barriers: need a ride -> honest thanks + visit stays booked
  await card.getByRole("button", { name: "We need a ride" }).click();
  await expect(card.getByText(/in this demo.*simulated visit stays booked/i)).toBeVisible();

  // Demo time-travel to tomorrow -> t1 reminder -> confirm
  await card.getByRole("button", { name: "Demo: move the visit closer" }).click();
  await card.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.getByTestId("family-appt-reminder")).toContainText("tomorrow");
  await page.getByRole("button", { name: "Yes, we'll be there" }).click();
  await expect(card.locator("p:not(.sr-only)", { hasText: /Confirmed for.*\(demo\)/ })).toBeVisible();

  // The reminder collapses the demo panel. Reopen it explicitly for the next turn.
  await card.getByRole("button", { name: "Demo: move the visit closer" }).click();
  await card.getByRole("button", { name: "Date passed" }).click();
  await page.getByRole("button", { name: "We made it" }).click();
  await expect(card.locator("p:not(.sr-only)", { hasText: /Glad you made it \(demo\)/ })).toBeVisible();
});

test("ladder companion: notes accrue, check-in watches, packet prints", async ({ page }) => {
  await stubUnconfiguredFamilyInterview(page);
  await page.goto("/ladder");
  await fillBasics(page, {
    county: "Scott",
    birthYear: "2024",
    birthMonth: "1",
    schoolStage: "not_school_age"
  });

  // The wait status leads the page as soon as there is a child to wait for.
  const header = page.getByTestId("family-wait-header");
  await expect(header).toBeVisible();

  // Orientation, through the same box a caregiver already uses.
  await page.getByLabel("What would you like help with?").fill(TODDLER_DESCRIPTION);
  await page.getByRole("button", { name: "Find help" }).click();
  await expect(page.getByRole("region", { name: "Here is what we heard" })).toBeVisible();

  // A dated deadline the family would otherwise never see: 2024-01 birth, 45-day
  // First Steps cutoff before the third birthday, read at the frozen clock.
  await expect(page.getByText(/About 17 weeks left to start First Steps/).first()).toBeVisible();

  // Every submission after the first is a dated note, not a new orientation.
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByLabel("What would you like help with?").fill(REGRESSION_NOTE);
  await page.getByRole("button", { name: "Find help" }).click();

  // Lost skills route to the clinic now — informational, never a crisis lock.
  const clinicNow = page.getByTestId("family-clinic-now-card");
  await expect(clinicNow).toBeVisible();
  await expect(clinicNow).toHaveAttribute("data-flag-source", "text");
  await expect(clinicNow.getByText("Worth telling the clinic now")).toBeVisible();
  await expect(page.getByTestId("family-crisis-banner")).toHaveCount(0);
  await clinicNow.getByRole("button", { name: "I've noted this" }).click();
  await expect(page.getByTestId("family-clinic-now-card")).toHaveCount(0);

  // The journal is the record: grouped by month, with the caregiver's raw words.
  const journal = page.getByTestId("family-journal");
  await expect(journal.getByRole("heading", { name: "Your notes so far" })).toBeVisible();
  await expect(journal.getByTestId("family-journal-month").first()).toContainText("July 2026");
  const rawNote = journal.getByTestId("family-journal-raw-note").last();
  await rawNote.locator("summary").click();
  await expect(rawNote.getByText(REGRESSION_NOTE)).toBeVisible();
  // One note so far, so the chip reads the singular — never "1 notes".
  await expect(header.getByText("1 note", { exact: true })).toBeVisible();

  // Demo time-travel: a month of quiet brings the check-in back.
  await page.getByTestId("family-checkin-demo").getByRole("button").click();
  const checkin = page.getByTestId("family-checkin");
  await expect(checkin).toBeVisible();
  await expect(checkin.getByRole("heading", { name: "Monthly check-in" })).toBeVisible();
  await checkin.getByRole("button", { name: "Nothing new" }).click();
  await expect(checkin).toHaveAttribute("data-checkin-part", "probe");
  await checkin.getByRole("button", { name: "No", exact: true }).click();
  await expect(checkin).toHaveAttribute("data-checkin-part", "pulse");
  // exact: the sr-only live region carries this question too, prefixed with the
  // card title, so an inexact match would resolve to both.
  await expect(checkin.getByText("How supported do you feel this month?", { exact: true })).toBeVisible();
  await checkin.getByRole("button", { name: "4", exact: true }).click();
  await expect(checkin.getByText("Thanks — see you next month.")).toBeVisible();

  // The packet carries the family's own sentence and whatever they chose to ask.
  await page.getByRole("checkbox", { name: "Who coordinates the next steps?" }).check();
  const packet = page.getByTestId("family-visit-packet-body");
  await expect(packet).toContainText("Questions we want to ask");
  await expect(packet).toContainText("Who coordinates the next steps?");
  await expect(packet).toContainText("Changes we're flagging");
  await expect(packet).toContainText(REGRESSION_NOTE);
  await expect(packet).toContainText("not a medical record");
});

test("ladder companion: an earlier visit survives reload and reschedules without reviving its prior booking", async ({ page }) => {
  await stubUnconfiguredFamilyInterview(page);
  await page.goto("/ladder");
  await fillBasics(page, {
    county: "Scott",
    birthYear: "2024",
    birthMonth: "1",
    schoolStage: "not_school_age"
  });
  await page.getByLabel("What would you like help with?").fill(TODDLER_DESCRIPTION);
  await page.getByRole("button", { name: "Find help" }).click();

  // Commit to a step: the card swaps its offer for a dated status the packet reads.
  const firstCard = page.getByTestId("matched-family-resources").locator("[data-family-resource-card]").first();
  await firstCard.getByTestId("family-step-plan").click();
  const stepStatus = firstCard.getByTestId("family-step-status");
  await expect(stepStatus).toHaveAttribute("data-step-status", "planned");
  await expect(stepStatus).toContainText("Planned");
  const header = page.getByTestId("family-wait-header");
  await expect(header).toContainText("1 step in motion");

  // Seed the waitlist and book the offered visit, then answer the barriers turn
  // so the card is quiet enough to ask about earlier openings.
  const card = page.getByTestId("family-appointment-card");
  await card.getByRole("button", { name: "Show me (demo)" }).click();
  const originalSlotButton = card.getByRole("button").filter({ hasText: /,/ }).first();
  const originalSlot = (await originalSlotButton.innerText()).trim();
  await originalSlotButton.click();
  await expect(card.getByText(/Booked for.*\(demo\)/)).toBeVisible();
  await card.getByRole("button", { name: "We need a ride" }).click();

  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return false;
        const state = JSON.parse(raw) as {
          family?: { appointments?: Array<{ status: string }> };
        };
        return state.family?.appointments?.some(({ status }) => status === "booked") ?? false;
      }, STORAGE_KEY)
    )
    .toBe(true);

  const originalBooking = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const state = JSON.parse(raw) as {
      family?: { appointments?: Array<{ id: string; status: string }> };
    };
    return state.family?.appointments?.find(({ status }) => status === "booked") ?? null;
  }, STORAGE_KEY);
  if (originalBooking === null) {
    throw new Error("Expected the ordinary booking to persist before accepting an earlier visit.");
  }

  const soonerTurn = card.getByTestId("family-sooner-turn");
  await expect(soonerTurn).toBeVisible();
  await soonerTurn.getByRole("button", { name: "Yes, put us on the list" }).click();
  await soonerTurn.getByRole("button", { name: "Weekday mornings" }).click();
  await soonerTurn.getByRole("button", { name: "Add us" }).click();
  await expect(card.getByTestId("family-sooner-status")).toBeVisible();
  await expect(header).toContainText("On the earlier-visit list");

  // A cancellation backfill: one slot, and the current time is never lost by accident.
  await card.getByRole("button", { name: "Demo: move the visit closer" }).click();
  await card.getByTestId("family-sooner-demo").click();
  const offer = card.locator('[data-sooner-offer="true"]');
  await expect(offer).toBeVisible();
  await expect(offer.getByRole("button", { name: "Keep our current time" })).toBeVisible();
  const slots = offer.getByRole("button").filter({ hasText: /,/ });
  await expect(slots).toHaveCount(1);
  const earlierSlot = (await slots.first().innerText()).trim();
  await slots.first().click();
  await expect(card.getByText(/Booked for.*\(demo\)/)).toContainText(earlierSlot);

  await expect
    .poll(() =>
      page.evaluate(
        ({ key, originalId }) => {
          const raw = window.localStorage.getItem(key);
          if (raw === null) return false;
          const state = JSON.parse(raw) as {
            family?: {
              appointments?: Array<{ id: string; status: string; supersedesId?: string }>;
            };
          };
          const appointments = state.family?.appointments ?? [];
          const original = appointments.find(({ id }) => id === originalId);
          const acceptedEarlier = appointments.find(({ id, status }) => id !== originalId && status === "booked");
          return original?.status === "replaced" && acceptedEarlier?.supersedesId === originalId;
        },
        { key: STORAGE_KEY, originalId: originalBooking.id }
      )
    )
    .toBe(true);

  const acceptedEarlierBooking = await page.evaluate(
    ({ key, originalId }) => {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      const state = JSON.parse(raw) as {
        family?: { appointments?: Array<{ id: string; status: string }> };
      };
      return state.family?.appointments?.find(({ id, status }) => id !== originalId && status === "booked") ?? null;
    },
    { key: STORAGE_KEY, originalId: originalBooking.id }
  );
  if (acceptedEarlierBooking === null) {
    throw new Error("Expected the accepted earlier visit to persist before reload.");
  }

  await page.reload();
  await expect(card.getByText(/Booked for.*\(demo\)/)).toContainText(earlierSlot);
  await expect(card.getByText(originalSlot, { exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Keep our current time" })).toHaveCount(0);

  // The accepted visit starts its own barrier turn before its reminder can offer
  // a different time. Rebooking it must preserve the retired original booking.
  await card.getByRole("button", { name: "We're all set" }).click();
  await expect(page.getByTestId("family-appt-reminder")).toBeVisible();
  await page.getByRole("button", { name: "Yes, we'll be there" }).click();
  await card.getByRole("button", { name: "Demo: move the visit closer" }).click();
  await card.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.getByTestId("family-appt-reminder")).toBeVisible();
  await page.getByRole("button", { name: "We need a different time" }).click();
  const rescheduledSlot = card.getByRole("button").filter({ hasText: /,/ }).first();
  await expect(rescheduledSlot).toBeVisible();
  await rescheduledSlot.click();
  await expect(card.getByText(/Booked for.*\(demo\)/)).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(
        ({ key, originalId, currentId }) => {
          const raw = window.localStorage.getItem(key);
          if (raw === null) return null;
          const state = JSON.parse(raw) as {
            family?: {
              appointments?: Array<{ id: string; status: string; supersedesId?: string }>;
            };
            auditEvents?: Array<{ label?: string }>;
          };
          const appointments = state.family?.appointments ?? [];
          const auditEvents = state.auditEvents ?? [];
          const current = appointments.find(({ id }) => id === currentId);
          return {
            originalStatus: appointments.find(({ id }) => id === originalId)?.status ?? null,
            currentFound: current !== undefined,
            currentStatus: current?.status ?? null,
            currentOwnsSupersedesId:
              current !== undefined && Object.prototype.hasOwnProperty.call(current, "supersedesId"),
            replacementAuditCount: auditEvents.filter(
              ({ label }) => label === "Earlier visit replaced the prior booking"
            ).length,
            finalAuditLabel: auditEvents.at(-1)?.label ?? null
          };
        },
        { key: STORAGE_KEY, originalId: originalBooking.id, currentId: acceptedEarlierBooking.id }
      )
    )
    .toEqual({
      originalStatus: "replaced",
      currentFound: true,
      currentStatus: "booked",
      currentOwnsSupersedesId: false,
      replacementAuditCount: 1,
      finalAuditLabel: "Evaluation visit booked"
    });
});

test("resources-first: one paragraph brings help before any question, with zero confirm taps", async ({
  page
}) => {
  await stubUnconfiguredFamilyInterview(page);
  await stubUnconfiguredFamilyRecommend(page);
  await page.goto("/ladder");

  await page.getByLabel("What would you like help with?").fill(RESOURCES_FIRST_DESCRIPTION);
  await page.getByRole("button", { name: "Find help" }).click();

  // 1. The verification is one line, it takes focus, and it stays shut.
  const strip = page.getByTestId("family-heard-strip");
  await expect(strip).toBeVisible();
  await expect(strip).toBeFocused();
  await expect(strip.getByTestId("family-heard")).toHaveText(
    /^Sounds like: Scott County · your child, about 3 years old · .+\.$/
  );
  expect(await strip.locator("details").evaluate((node: HTMLDetailsElement) => node.open)).toBe(false);
  // Read from the description, not stated — so the strip says so.
  await expect(strip.getByTestId("family-heard-guess-chip")).toBeVisible();
  await expect(page.getByRole("region", { name: "Here is what we heard" })).toHaveCount(1);

  // 2. Nothing was confirmed to get here: no prefill card, no basics turns, and
  // the saved profile carries its own provenance.
  await expect(page.getByTestId("family-basics-prefill")).toHaveCount(0);
  await expect(page.getByTestId("family-basics-turns")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        const state = raw
          ? (JSON.parse(raw) as {
              family?: {
                profile?: { county?: string; birthYear?: number; schoolStage?: string };
                profileProvenance?: string;
                facts?: Array<{ status?: string }>;
              };
            })
          : null;
        const family = state?.family;
        return {
          county: family?.profile?.county ?? null,
          birthYear: family?.profile?.birthYear ?? null,
          schoolStage: family?.profile?.schoolStage ?? null,
          provenance: family?.profileProvenance ?? null,
          confirmedFacts: family?.facts?.filter(({ status }) => status === "confirmed").length ?? 0
        };
      }, STORAGE_KEY)
    )
    .toEqual({
      county: "Scott",
      birthYear: 2023,
      schoolStage: "not_school_age",
      provenance: "extracted",
      confirmedFacts: 0
    });

  // 3. The thread's cards are the head of the section's list — one array, two
  // renders. Read in one pass so a re-rank between reads cannot split them.
  const threadRegion = page.getByTestId("thread-family-resources");
  await expect(threadRegion.locator("[data-family-resource-card]").first()).toBeVisible();
  const ids = await page.evaluate(() => {
    const read = (root: Element | null): string[] | null =>
      root
        ? Array.from(root.querySelectorAll("[data-family-resource-card]")).map(
            (node) => node.getAttribute("data-resource-id") ?? ""
          )
        : null;
    return {
      thread: read(document.querySelector('[data-testid="thread-family-resources"]')),
      section: read(document.querySelector('[data-testid="matched-family-resources"]'))
    };
  });
  expect(ids.thread?.length ?? 0).toBeGreaterThan(0);
  expect(ids.thread?.length ?? 0).toBeLessThanOrEqual(3);
  expect(ids.section?.slice(0, ids.thread?.length ?? 0)).toEqual(ids.thread);

  // 4. The question is optional and it lands below the last card, not above it.
  const question = page.locator("#family-follow-up-question");
  await expect(question).toBeVisible();
  expect(
    await page.evaluate(() => {
      const cards = document.querySelectorAll(
        '[data-testid="thread-family-resources"] [data-family-resource-card]'
      );
      const lastCard = cards[cards.length - 1] ?? null;
      const turn = document.getElementById("family-follow-up-question")?.closest("section") ?? null;
      if (!lastCard || !turn) return null;
      const eyebrow = Array.from(turn.querySelectorAll("p")).some(
        (node) => node.textContent?.trim() === "Optional — answering sharpens the list."
      );
      return {
        eyebrowAboveQuestion: eyebrow,
        questionBelowLastCard:
          (lastCard.compareDocumentPosition(turn) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      };
    })
  ).toEqual({ eyebrowAboveQuestion: true, questionBelowLastCard: true });

  // 5. Nothing was lost on the way in: the quote and the confirm action are one
  // tap away, wired to the same reducer the journal uses. Checked before the
  // answer, because every follow-up round re-extracts the whole conversation and
  // the store keeps the first copy of a repeated fact on its original interview.
  await openHeardDisclosure(strip);
  await expect(strip.getByRole("article").first()).toBeVisible();
  await expect(strip.getByText("You wrote").first()).toBeVisible();
  await expect(strip.getByText(/isn't talking yet/i).first()).toBeVisible();
  await strip.getByRole("button", { name: /Yes, that is right/ }).first().click();
  await expect(strip.getByText("You said this is right").first()).toBeVisible();

  // 6. Answering sharpens the list without stacking a second recap, and the
  // "that is enough to get you started" thanks stays away while cards are up.
  await page.getByLabel("Or type a short answer").fill("Speech therapy, as soon as we can.");
  await page.getByRole("button", { name: "Add answer" }).click();
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        const state = raw ? (JSON.parse(raw) as { family?: { interviews?: unknown[] } }) : null;
        return state?.family?.interviews?.length ?? 0;
      }, STORAGE_KEY)
    )
    .toBe(2);
  await expect(page.getByTestId("family-heard-strip")).toHaveCount(1);
  await expect(page.getByTestId("thread-family-resources")).toHaveCount(1);
  await expect(page.getByText("Thanks. That is enough to get you started.")).toHaveCount(0);
  // The confirmation the caregiver just made is still theirs after the round.
  await expect(page.getByTestId("family-journal").getByText("You said this is right")).toBeVisible();
});
