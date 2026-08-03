import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "home-health-ai-ownership-state";
const FROZEN_NOW = new Date("2026-08-03T12:00:00.000Z");

type ProfileInput = {
  county: string;
  birthYear: string;
  birthMonth: string;
  schoolStage: string;
  diagnoses?: string[];
};

type Persona = {
  id: string;
  language: "en" | "es";
  profile: ProfileInput;
  opening: string;
  expectedPrefix: string[];
  includes: string[];
  excludes: string[];
  action: { kind: "plan" | "save" | "share"; resourceId: string };
};

const PERSONAS: Persona[] = [
  {
    id: "F01",
    language: "en",
    profile: { county: "Pike", birthYear: "2024", birthMonth: "5", schoolStage: "not_school_age" },
    opening:
      "Theo is two. He says mama and no, but not much else, and he still falls a lot when he walks. His doctor said speech and physical therapy could help. I’m his grandmother and I don’t drive, so we need a ride to appointments. I need somebody to tell me who to call first.",
    expectedPrefix: ["first_steps_big_sandy", "first_steps_statewide"],
    includes: ["help_me_grow_ky"],
    excludes: ["michelle_p_waiver", "child_waiver", "uk_developmental_pediatrics"],
    action: { kind: "plan", resourceId: "first_steps_big_sandy" }
  },
  {
    id: "F02",
    language: "es",
    profile: { county: "Jefferson", birthYear: "2023", birthMonth: "10", schoolStage: "not_school_age" },
    opening:
      "Mateo tiene dos años y nueve meses y casi no habla. Señala lo que quiere y usa unas cinco palabras. Trabajo de noche y necesito saber a quién llamar esta semana para terapia del habla, en español.",
    expectedPrefix: ["first_steps_kentuckiana"],
    includes: ["first_steps_statewide", "help_me_grow_ky"],
    excludes: ["michelle_p_waiver", "child_waiver"],
    action: { kind: "share", resourceId: "first_steps_kentuckiana" }
  },
  {
    id: "F03",
    language: "en",
    profile: { county: "Fayette", birthYear: "2022", birthMonth: "3", schoolStage: "preschool" },
    opening:
      "Zoe is four. She covers her ears in busy places, avoids group play, and has trouble with back-and-forth language. She has no diagnosis. I want evidence about whether speech or occupational therapy and a developmental evaluation make sense; I do not want the app to put a label on her.",
    expectedPrefix: ["ocshcn", "uk_developmental_pediatrics"],
    includes: [],
    excludes: ["michelle_p_waiver", "child_waiver"],
    action: { kind: "save", resourceId: "uk_developmental_pediatrics" }
  },
  {
    id: "F04",
    language: "en",
    profile: { county: "McCracken", birthYear: "2017", birthMonth: "5", schoolStage: "elementary" },
    opening:
      "Gabriel is in fourth grade y ya tiene un IEP. La escuela still calls me to pick him up and sends him home when he gets overloaded. Hemos tenido meetings, pero el plan no está working. I need help with the IEP and what to ask for next.",
    expectedPrefix: ["idea_school_discipline", "fba_bip_request"],
    includes: ["kde_dispute_resolution"],
    excludes: [],
    action: { kind: "plan", resourceId: "idea_school_discipline" }
  },
  {
    id: "F05",
    language: "en",
    profile: { county: "Boone", birthYear: "2014", birthMonth: "2", schoolStage: "middle" },
    opening:
      "Jordan is twelve and in seventh grade, and I’m frustrated because the story comes out all mixed up. Homework takes hours. He loses papers, forgets directions, cannot stay focused, starts three things and finishes none, and the school says he needs to try harder. I need help deciding whether to ask for an evaluation, an IEP, or a 504.",
    expectedPrefix: ["kde_evaluation_request", "kde_parent_toolbox", "ky_spin"],
    includes: [],
    excludes: ["idea_school_discipline", "kde_dispute_resolution"],
    action: { kind: "save", resourceId: "kde_evaluation_request" }
  },
  {
    id: "F06",
    language: "en",
    profile: { county: "Warren", birthYear: "2019", birthMonth: "4", schoolStage: "elementary" },
    opening:
      "Sam is seven. He already goes to speech and occupational therapy. I need a break sometimes, his sister needs support too, and I’d like a sports or recreation program where they both feel welcome. Reading long pages is hard for me, so please keep it short.",
    expectedPrefix: ["sibling_support_project"],
    includes: [],
    excludes: ["michelle_p_waiver", "child_waiver"],
    action: { kind: "plan", resourceId: "sibling_support_project" }
  },
  {
    id: "F07",
    language: "en",
    profile: {
      county: "Christian",
      birthYear: "2010",
      birthMonth: "1",
      schoolStage: "high",
      diagnoses: ["Autism", "Intellectual disability"]
    },
    opening:
      "Noah is sixteen. He was diagnosed with autism and intellectual disability when he was younger. I know the system and I’m planning for adult transition, supported decision-making, ABLE, and waivers before he turns eighteen. Please do not start at the very beginning.",
    expectedPrefix: ["my_choice_kentucky"],
    includes: ["michelle_p_waiver"],
    excludes: ["hcb_waiver"],
    action: { kind: "plan", resourceId: "my_choice_kentucky" }
  },
  {
    id: "F08",
    language: "en",
    profile: {
      county: "Greenup",
      birthYear: "2007",
      birthMonth: "4",
      schoolStage: "post_high",
      diagnoses: ["Intellectual disability"]
    },
    opening:
      "Emma is nineteen. She was diagnosed with intellectual disability. Finished her program last spring. Adult transition. Supported decision-making instead of jumping straight to guardianship. ABLE. Services for what comes next. I need simple steps.",
    expectedPrefix: ["my_choice_kentucky"],
    includes: ["stable_kentucky"],
    excludes: ["hcb_waiver"],
    action: { kind: "save", resourceId: "my_choice_kentucky" }
  },
  {
    id: "L01",
    language: "es",
    profile: { county: "Fayette", birthYear: "2021", birthMonth: "6", schoolStage: "preschool" },
    opening:
      "Sofía tiene cinco años. En la escuela le cuesta participar con otros niños y seguir conversaciones; las rutinas nuevas la abruman. No tiene diagnóstico. No sé por dónde empezar ni qué pedir en la escuela, y necesito hacerlo en español.",
    expectedPrefix: [],
    includes: ["kde_parent_toolbox", "ky_spin"],
    excludes: ["michelle_p_waiver", "child_waiver"],
    action: { kind: "save", resourceId: "kde_parent_toolbox" }
  },
  {
    id: "L02",
    language: "en",
    profile: { county: "Breathitt", birthYear: "2018", birthMonth: "3", schoolStage: "elementary" },
    opening:
      "Jaylen is eight. We have an occupational therapy referral, but the nearest therapy is more than an hour away and we do not have a reliable ride. I want help finding something we can actually get to.",
    expectedPrefix: ["lklp_transportation_region_13"],
    includes: ["kentucky_211"],
    excludes: ["michelle_p_waiver", "child_waiver", "uk_developmental_pediatrics"],
    action: { kind: "plan", resourceId: "kentucky_211" }
  },
  {
    id: "L03",
    language: "en",
    profile: { county: "Rowan", birthYear: "2016", birthMonth: "5", schoolStage: "elementary" },
    opening:
      "Maya is ten and in fifth grade. Her teacher and I are concerned about dyslexia and ADHD, but she has not been diagnosed. Reading and homework take hours, and we are waiting for an evaluation.",
    expectedPrefix: ["kde_evaluation_request", "kde_parent_toolbox", "ky_spin"],
    includes: [],
    excludes: ["idea_school_discipline", "kde_dispute_resolution", "uk_developmental_pediatrics"],
    action: { kind: "save", resourceId: "kde_evaluation_request" }
  },
  {
    id: "L04",
    language: "en",
    profile: { county: "Perry", birthYear: "2024", birthMonth: "1", schoolStage: "not_school_age" },
    opening:
      "Ava is two and uses about six words. We were referred to First Steps for speech therapy, and I want help making sure we get started before the deadline.",
    expectedPrefix: ["first_steps_kentucky_river", "first_steps_statewide"],
    includes: ["kde_age_three_transition"],
    excludes: ["michelle_p_waiver", "child_waiver", "ocshcn", "uk_developmental_pediatrics"],
    action: { kind: "plan", resourceId: "first_steps_kentucky_river" }
  }
];

async function useDeterministicFamilyApis(page: Page): Promise<void> {
  for (const pattern of ["**/api/family/interview", "**/api/family/recommend"]) {
    await page.route(pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mode: "unconfigured", data: null })
      });
    });
  }
}

async function setLanguage(page: Page, language: "en" | "es"): Promise<void> {
  if (language === "en") return;
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true);
  await page.evaluate(
    ({ key, nextLanguage }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) throw new Error("Expected persisted state before changing language.");
      const state = JSON.parse(raw) as { patient: { language: string } };
      state.patient.language = nextLanguage;
      window.localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, nextLanguage: language }
  );
  await page.reload();
}

async function fillProfile(page: Page, persona: Persona): Promise<void> {
  const spanish = persona.language === "es";
  const disclosure = page.getByRole("button", {
    name: spanish ? /Agrega o cambia los datos/ : /Add or change your child's details/
  });
  if ((await disclosure.getAttribute("aria-expanded")) === "false") await disclosure.click();

  await page.getByLabel(spanish ? "Condado de Kentucky" : "Kentucky county").selectOption(persona.profile.county);
  await page.getByLabel(spanish ? "Año de nacimiento" : "Birth year").fill(persona.profile.birthYear);
  await page.getByLabel(spanish ? "Mes de nacimiento" : "Birth month").selectOption(persona.profile.birthMonth);
  await page.getByLabel(spanish ? "Etapa escolar" : "School stage").selectOption(persona.profile.schoolStage);
  for (const diagnosis of persona.profile.diagnoses ?? []) {
    await page.getByRole("checkbox", { name: diagnosis }).check();
  }
  await page.getByRole("button", { name: spanish ? "Guardar estos datos" : "Save these details" }).click();
}

async function completeAction(page: Page, persona: Persona): Promise<void> {
  const card = page.locator(`[data-resource-id="${persona.action.resourceId}"]`).first();
  await expect(card).toBeVisible();
  if (persona.action.kind === "plan") {
    await card.getByTestId("family-step-plan").click();
    await expect(card.getByTestId("family-step-status")).toHaveAttribute("data-step-status", "planned");
    return;
  }

  await card.getByRole("button", { name: /Save|Guardar/ }).click();
  await expect(card.getByRole("button", { name: /Saved|Guardado/ })).toBeDisabled();
  if (persona.action.kind === "share") {
    await card.getByRole("checkbox").check();
    await card.getByRole("button", { name: /Share|Compartir/ }).click();
    await expect(card.getByRole("status")).not.toBeEmpty();
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("__ladder_persona_cleared") !== "true") {
      window.localStorage.clear();
      window.sessionStorage.setItem("__ladder_persona_cleared", "true");
    }
  });
  await useDeterministicFamilyApis(page);
});

for (const persona of PERSONAS) {
  test(`${persona.id} fresh deterministic routing and action`, async ({ page }) => {
    await page.goto("/ladder");
    await setLanguage(page, persona.language);
    await fillProfile(page, persona);

    const input = page.getByLabel(
      persona.language === "es" ? "¿Con qué te gustaría recibir ayuda?" : "What would you like help with?"
    );
    await input.fill(persona.opening);
    await page.getByRole("button", { name: persona.language === "es" ? "Buscar ayuda" : "Find help" }).click();

    const cards = page.getByTestId("matched-family-resources").locator("[data-family-resource-card]");
    await expect(cards.first()).toBeVisible();
    const ids = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-resource-id") ?? "")
    );
    expect(ids.length).toBeLessThanOrEqual(8);
    expect(ids.slice(0, persona.expectedPrefix.length)).toEqual(persona.expectedPrefix);
    for (const id of persona.includes) expect(ids).toContain(id);
    for (const id of persona.excludes) expect(ids).not.toContain(id);
    await expect(cards.getByTestId("family-resource-locality")).toHaveCount(ids.length);

    await completeAction(page, persona);
  });
}
