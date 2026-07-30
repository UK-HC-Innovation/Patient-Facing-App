import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useReducer } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { brentState } from "@/domain/fixtures";
import { SAMPLE_CAREGIVER_TEXT, SAMPLE_CAREGIVER_TEXT_ES, eighteenMonthFamilyState, schoolAgeFamilyState } from "@/domain/family-fixtures";
import { createFamilyAppointmentOffer } from "@/domain/family-appointments";
import type { AppState, DevNeedDomain, FamilyNavigatorState } from "@/domain/types";
import { healthReducer } from "@/state/store";
import { FamilyExperience } from "@/components/family-experience";

const { push, requestFamilyInterview, requestFamilyRecommendations } = vi.hoisted(() => ({
  push: vi.fn(),
  requestFamilyInterview: vi.fn(),
  requestFamilyRecommendations: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/ai/family-interview-provider", () => ({ requestFamilyInterview }));
vi.mock("@/ai/family-recommend-provider", () => ({ requestFamilyRecommendations }));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function withFamily(family: FamilyNavigatorState | null, language: "en" | "es" = "en"): AppState {
  return { ...brentState, patient: { ...brentState.patient, language }, family };
}

async function changeCounty(user: ReturnType<typeof userEvent.setup>, county: string): Promise<void> {
  const basics = screen.getByRole("button", { name: /Add or change your child's details/i });
  if (basics.getAttribute("aria-expanded") === "false") {
    await user.click(basics);
  }
  await user.selectOptions(screen.getByLabelText("Kentucky county"), county);
  await user.click(screen.getByRole("button", { name: "Save these details" }));
}

// The in-thread "here is what we heard" turn. The journal section repeats the
// same facts further down the page, so fact assertions name which one they mean.
function reviewTurn(heading = "Here is what we heard"): HTMLElement {
  const section = screen.getByRole("heading", { name: heading }).closest("section");
  if (!section) throw new Error(`No review section for heading: ${heading}`);
  return section;
}

// The fixture carries no scripted draft, so tests that submit supply ordinary caregiver text.
const describedFamily: FamilyNavigatorState = { ...schoolAgeFamilyState, interviewDraft: SAMPLE_CAREGIVER_TEXT };

function ReducerHarness({ initialState = withFamily(null) }: { initialState?: AppState }) {
  const [state, dispatch] = useReducer(healthReducer, initialState);
  return (
    <>
      <FamilyExperience state={state} dispatch={dispatch} passcode="demo-passcode" />
      <output data-testid="family-state">{JSON.stringify(state.family)}</output>
      <output data-testid="adult-facts">{JSON.stringify(state.extractedFacts)}</output>
      <output data-testid="audit-events">{JSON.stringify(state.auditEvents)}</output>
    </>
  );
}

beforeEach(() => {
  push.mockReset();
  requestFamilyInterview.mockReset();
  requestFamilyInterview.mockResolvedValue(null);
  requestFamilyRecommendations.mockReset();
  requestFamilyRecommendations.mockResolvedValue(null);
});

describe("FamilyExperience", { timeout: 10_000 }, () => {
  it("synchronizes the document language and restores the prior value on unmount", () => {
    const originalLanguage = document.documentElement.lang;
    document.documentElement.lang = "fr";
    const { rerender, unmount } = render(
      <FamilyExperience state={withFamily(schoolAgeFamilyState, "es")} dispatch={vi.fn()} passcode="" />
    );

    expect(document.documentElement.lang).toBe("es");
    rerender(<FamilyExperience state={withFamily(schoolAgeFamilyState, "en")} dispatch={vi.fn()} passcode="" />);
    expect(document.documentElement.lang).toBe("en");
    unmount();
    expect(document.documentElement.lang).toBe("fr");
    document.documentElement.lang = originalLanguage;
  });

  it("keeps the English and Spanish tool-limits disclosure available on demand", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <FamilyExperience state={withFamily(schoolAgeFamilyState, "en")} dispatch={vi.fn()} passcode="" />
    );

    // Characterization mutation: removing the disclosure or leaving its content
    // permanently hidden would make the tool's limits unavailable to families.
    await user.click(screen.getByText("What this tool can and cannot do"));
    expect(screen.getByText(/cannot say what your child has/i)).toBeVisible();

    unmount();
    render(<FamilyExperience state={withFamily(schoolAgeFamilyState, "es")} dispatch={vi.fn()} passcode="" />);
    await user.click(screen.getByText("Qué puede y qué no puede hacer esta herramienta"));
    expect(screen.getByText(/No podemos decir qué tiene tu hijo o hija/i)).toBeVisible();
  });

  it("keeps every rendered back-to-top link pointed at the Ladder experience", () => {
    render(
      <FamilyExperience
        state={withFamily({
          ...schoolAgeFamilyState,
          activeDomains: ["school_iep"],
          facts: [
            {
              id: "fact-1",
              label: "Grade",
              value: "fourth grade",
              status: "patient_reported",
              sourceSnippet: "fourth grade"
            }
          ]
        })}
        dispatch={vi.fn()}
        passcode=""
      />
    );

    // Characterization mutation: a stale hash strands a family instead of
    // returning them to the common page origin.
    const links = screen.getAllByRole("link", { name: "Back to top" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "#family-experience");
    }
  });

  it("keeps every rendered wait-header page-navigation target in the document", () => {
    const { unmount } = render(
      <FamilyExperience state={withFamily(schoolAgeFamilyState)} dispatch={vi.fn()} passcode="" />
    );

    const baselineNavigation = within(screen.getByTestId("family-wait-header")).getByRole("navigation", {
      name: "On this page"
    });
    expect(within(baselineNavigation).queryByRole("link", { name: "Programs" })).not.toBeInTheDocument();
    expect(within(baselineNavigation).queryByRole("link", { name: "Notes" })).not.toBeInTheDocument();
    for (const link of within(baselineNavigation).getAllByRole("link")) {
      const href = link.getAttribute("href");
      expect(href).toMatch(/^#/);
      expect(document.querySelector(href!)).toBeInTheDocument();
    }

    unmount();
    render(
      <FamilyExperience
        state={withFamily({
          ...schoolAgeFamilyState,
          activeDomains: ["school_iep"],
          facts: [
            {
              id: "fact-1",
              label: "Grade",
              value: "fourth grade",
              status: "patient_reported",
              sourceSnippet: "fourth grade"
            }
          ]
        })}
        dispatch={vi.fn()}
        passcode=""
      />
    );

    const conditionalNavigation = within(screen.getByTestId("family-wait-header")).getByRole(
      "navigation",
      { name: "On this page" }
    );
    expect(within(conditionalNavigation).getByRole("link", { name: "Programs" })).toBeVisible();
    expect(within(conditionalNavigation).getByRole("link", { name: "Notes" })).toBeVisible();
    for (const link of within(conditionalNavigation).getAllByRole("link")) {
      const href = link.getAttribute("href");
      expect(href).toMatch(/^#/);
      expect(document.querySelector(href!)).toBeInTheDocument();
    }
  });

  it("does not steal focus for a persisted interview from an earlier visit", () => {
    const persistedFamily: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      interviews: [
        {
          id: "persisted-interview",
          rawText: "Riley is in fourth grade.",
          source: "typed",
          createdAt: "2026-07-16T12:00:00.000Z",
          extraction: "mock",
          kind: "orientation"
        }
      ],
      facts: [
        {
          id: "persisted-fact",
          interviewId: "persisted-interview",
          label: "Grade",
          value: "fourth grade",
          status: "patient_reported",
          sourceSnippet: "fourth grade"
        }
      ]
    };

    render(<FamilyExperience state={withFamily(persistedFamily)} dispatch={vi.fn()} passcode="" />);

    expect(screen.getByRole("heading", { name: "Here is what we heard" }).closest("section")).not.toHaveFocus();
  });

  it("runs the described-child path with atomic family facts, confirmation, deterministic Scott-first resources, saved return state, and timeline", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    expect(
      within(screen.getByTestId("family-appointment-card")).getByText(/Demo.*not an official service/i)
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /rather answer yes or no/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "What would help?" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/What would you like help with/i)).toHaveValue(SAMPLE_CAREGIVER_TEXT);
    const adultFactsBefore = screen.getByTestId("adult-facts").textContent;

    await user.click(screen.getByRole("button", { name: "Find help" }));
    await screen.findByRole("heading", { name: "Here is what we heard" });
    expect(screen.getByRole("heading", { name: "Here is what we heard" }).closest("section")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "What has the school offered so far?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nothing yet" })).toBeVisible();
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();
    expect(requestFamilyInterview).toHaveBeenCalledWith(expect.objectContaining({ passcode: "demo-passcode" }));
    expect(screen.getByTestId("adult-facts").textContent).toBe(adultFactsBefore);

    const stateAfterCrunch = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(stateAfterCrunch.interviews).toHaveLength(1);
    expect(stateAfterCrunch.facts).toHaveLength(3);
    expect(stateAfterCrunch.facts.every(({ interviewId }) => interviewId === stateAfterCrunch.interviews[0].id)).toBe(true);
    expect(stateAfterCrunch.facts.map(({ label, status }) => ({ label, status }))).toEqual([
      { label: "Grade", status: "patient_reported" },
      { label: "Reported diagnosis", status: "patient_reported" },
      { label: "About school and learning", status: "patient_reported" }
    ]);
    expect(stateAfterCrunch.activeDomains).toEqual(["school_iep", "waivers_financial", "parent_support"]);

    await user.click(screen.getAllByRole("button", { name: /Yes, that is right/ })[0]);
    // The journal below renders the same fact, so scope the badge to the review turn.
    await waitFor(() =>
      expect(within(reviewTurn()).getByText("You said this is right")).toBeVisible()
    );
    const stateAfterConfirm = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(stateAfterConfirm.facts.filter(({ status }) => status === "confirmed")).toHaveLength(1);

    const matched = screen.getByTestId("matched-family-resources");
    const resourceCards = within(matched).getAllByTestId("family-resource-card");
    expect(resourceCards[0]).toHaveAttribute("data-resource-id", "scott_county_exceptional_child_services");
    const resourceIds = resourceCards.map((card) => card.getAttribute("data-resource-id"));
    expect(resourceIds).toContain("child_waiver");
    expect(new Set(resourceIds).size).toBe(resourceIds.length);
    const source = within(resourceCards[0]).getByRole("link", { name: /See their official page.*Scott County Schools/i });
    expect(source).toHaveAttribute(
      "href",
      "https://www.scott.kyschools.us/departments/student-learning/exceptional-child-services/special-education"
    );
    expect(source).toHaveAttribute("target", "_blank");

    const nearby = screen.getByRole("region", { name: "Something else nearby" });
    expect(within(nearby).getByTestId("family-resource-card")).toHaveAttribute(
      "data-resource-id",
      "central_kentucky_riding_for_hope"
    );
    expect(screen.getAllByText("Central Kentucky Riding for Hope")).toHaveLength(1);
    expect(stateAfterCrunch.activeDomains).not.toContain("recreation");

    await user.click(screen.getByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: "Have you applied for any state programs yet?" });
    const stateAfterFirstFollowUp = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(stateAfterFirstFollowUp.interviews).toHaveLength(2);
    expect(stateAfterFirstFollowUp.interviews[1].rawText).toBe(`${SAMPLE_CAREGIVER_TEXT}\nNothing yet`);
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Not yet" }));
    await screen.findByText("Thanks. That is enough to get you started.");
    expect(screen.queryByRole("heading", { name: "Who can take over for a few hours?" })).not.toBeInTheDocument();
    const stateAfterSecondFollowUp = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(stateAfterSecondFollowUp.interviews).toHaveLength(3);
    expect(stateAfterSecondFollowUp.interviews[2].rawText).toBe(
      `${SAMPLE_CAREGIVER_TEXT}\nNothing yet\nNot yet`
    );

    const currentMatched = screen.getByTestId("matched-family-resources");
    const currentScottCard = within(currentMatched).getAllByTestId("family-resource-card")[0];
    await user.click(within(currentScottCard).getByRole("button", { name: /Save.*Scott County Schools/i }));
    const saved = screen.getByRole("region", { name: "Saved for later" });
    expect(within(saved).getByRole("heading", { name: "Scott County Schools Exceptional Child Services" })).toBeVisible();
    expect(
      screen
        .getAllByTestId("family-resource-card")
        .filter((card) => card.getAttribute("data-resource-id") === "scott_county_exceptional_child_services")
    ).toHaveLength(1);
    expect(within(saved).queryByRole("button", { name: /Share.*Scott County Schools/i })).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Now" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Next" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Later" })).toBeVisible();
    expect(screen.getByText("We only know the birth year, so we show timing early to be safe.")).toBeVisible();
  });

  it("asks county, birth year, and school stage as conversation turns, then unlocks resources and the held follow-up", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    expect(screen.getByRole("button", { name: /Add or change your child's details/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "Reading is really hard for him at school and I keep hearing about waivers."
    );
    await user.click(screen.getByRole("button", { name: "Find help" }));
    await screen.findByRole("heading", { name: "Here is what we heard" });

    const familyBefore = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(familyBefore.profile).toBeNull();
    expect(familyBefore.interviews).toHaveLength(1);
    expect(familyBefore.activeDomains).toEqual(["school_iep", "waivers_financial"]);
    expect(screen.queryByTestId("matched-family-resources")).not.toBeInTheDocument();

    // Basics turns hold the follow-up question until they are answered.
    const turns = screen.getByTestId("family-basics-turns");
    expect(screen.queryByRole("heading", { name: "What has the school offered so far?" })).not.toBeInTheDocument();
    await user.selectOptions(
      within(turns).getByLabelText(/which Kentucky county do you live in/i),
      "Scott"
    );
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.type(within(turns).getByLabelText(/What year was your child born/i), "2017");
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.click(within(turns).getByRole("button", { name: "Elementary school" }));

    const familyAfter = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(familyAfter.profile).toMatchObject({ county: "Scott", birthYear: 2017, schoolStage: "elementary" });
    expect(familyAfter.interviews).toHaveLength(1);

    // The thread survives: the held follow-up question appears once basics land.
    expect(screen.getByRole("heading", { name: "What has the school offered so far?" })).toBeVisible();
    expect(screen.getByText(/places that can help — they're just below/i)).toBeVisible();
    const matched = screen.getByTestId("matched-family-resources");
    expect(
      within(matched)
        .getAllByTestId("family-resource-card")
        .map((card) => card.getAttribute("data-resource-id"))
    ).toContain("scott_county_exceptional_child_services");
  });

  it("recomputes description-first toddler domains after completing Theo's profile", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "Theo is two. He says mama and no, but not much else, and he still falls a lot when he walks. His doctor said speech and physical therapy could help. I’m his grandmother and I don’t drive, so we need a ride to appointments. I need somebody to tell me who to call first."
    );
    await user.click(screen.getByRole("button", { name: "Find help" }));

    const turns = await screen.findByTestId("family-basics-turns");
    await user.selectOptions(
      within(turns).getByLabelText(/which Kentucky county do you live in/i),
      "Pike"
    );
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.type(within(turns).getByLabelText(/What year was your child born/i), "2024");
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.click(within(turns).getByRole("button", { name: "Not school age" }));

    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.profile).toMatchObject({ county: "Pike", birthYear: 2024, schoolStage: "not_school_age" });
    expect(family.latestInterviewDomains).toEqual(["early_intervention", "therapies", "transportation"]);
    expect(family.activeDomains).toEqual(["early_intervention", "therapies", "transportation"]);
    expect(family.interviews).toHaveLength(1);
    expect(family.interviews[0]?.kind).toBe("orientation");

    await screen.findByRole("heading", { name: "Has anyone talked with you about therapy visits?" });
    const cards = within(screen.getByTestId("matched-family-resources")).getAllByTestId("family-resource-card");
    expect(cards.slice(0, 2).map((card) => card.getAttribute("data-resource-id"))).toEqual([
      "first_steps_big_sandy",
      "first_steps_statewide"
    ]);
    const resourceIds = cards.map((card) => card.getAttribute("data-resource-id"));
    expect(resourceIds).toContain("help_me_grow_ky");
    expect(resourceIds).toContain("kentucky_211");

    const bigSandy = screen.getByTestId("matched-family-resources").querySelector(
      '[data-resource-id="first_steps_big_sandy"]'
    ) as HTMLElement;
    await user.click(within(bigSandy).getByTestId("family-step-plan"));
    const planned = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(planned.steps).toMatchObject([{ resourceId: "first_steps_big_sandy", domain: "early_intervention" }]);
  });

  it("offers back the county, age, and stage the caregiver already wrote instead of re-asking", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "I have a seven-year-old with big meltdowns. He has been kicked out of school several times. We live in Breathitt County and we need help."
    );
    await user.click(screen.getByRole("button", { name: "Find help" }));

    const prefill = await screen.findByTestId("family-basics-prefill");
    expect(within(prefill).getByText("Breathitt")).toBeVisible();
    expect(within(prefill).getByText(/about 2019/)).toBeVisible();
    expect(within(prefill).getByText("Elementary school")).toBeVisible();
    expect(screen.queryByLabelText(/which Kentucky county do you live in/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/What year was your child born/i)).not.toBeInTheDocument();

    await user.click(within(prefill).getByRole("button", { name: "Yes, that is right" }));

    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.profile).toMatchObject({
      county: "Breathitt",
      birthYear: new Date().getFullYear() - 7,
      schoolStage: "elementary"
    });
  });

  it("still asks for whatever the description left out", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "We live in Scott County and reading homework is a nightly battle."
    );
    await user.click(screen.getByRole("button", { name: "Find help" }));

    const prefill = await screen.findByTestId("family-basics-prefill");
    await user.click(within(prefill).getByRole("button", { name: "Yes, that is right" }));

    const turns = screen.getByTestId("family-basics-turns");
    expect(within(turns).queryByLabelText(/which Kentucky county do you live in/i)).not.toBeInTheDocument();
    await user.type(within(turns).getByLabelText(/What year was your child born/i), "2017");
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.click(within(turns).getByRole("button", { name: "Elementary school" }));

    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.profile).toMatchObject({ county: "Scott", birthYear: 2017, schoolStage: "elementary" });
  });

  it("lets the caregiver correct what we picked up, with their answer prefilled", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "We live in Breathitt County and reading homework is a nightly battle."
    );
    await user.click(screen.getByRole("button", { name: "Find help" }));

    const prefill = await screen.findByTestId("family-basics-prefill");
    await user.click(within(prefill).getByRole("button", { name: "Change something" }));

    const turns = screen.getByTestId("family-basics-turns");
    const countySelect = within(turns).getByLabelText(/which Kentucky county do you live in/i);
    expect(countySelect).toHaveValue("Breathitt");
    await user.selectOptions(countySelect, "Scott");
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.type(within(turns).getByLabelText(/What year was your child born/i), "2017");
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.click(within(turns).getByRole("button", { name: "Elementary school" }));

    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.profile).toMatchObject({ county: "Scott", birthYear: 2017, schoolStage: "elementary" });
  });

  it("rejects an out-of-range birth year in the conversational turn", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "Reading is really hard for him at school."
    );
    await user.click(screen.getByRole("button", { name: "Find help" }));
    const turns = await screen.findByTestId("family-basics-turns");
    await user.selectOptions(
      within(turns).getByLabelText(/which Kentucky county do you live in/i),
      "Scott"
    );
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.type(within(turns).getByLabelText(/What year was your child born/i), "1850");
    await user.click(within(turns).getByRole("button", { name: "Next" }));

    expect(within(turns).getByRole("alert")).toHaveTextContent(/four-digit birth year/i);
    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.profile).toBeNull();
  });

  it("ranks and justifies the resources when the model returns a grounded ranking", async () => {
    const user = userEvent.setup();
    requestFamilyRecommendations.mockResolvedValue({
      heard: "You told us school keeps sending him home, and that is the thread to pull first.",
      lead: "behavioral_support",
      recommendations: [
        {
          id: "idea_school_discipline",
          why: "Once removals pass ten days the school has to look at whether the behavior is tied to a disability.",
          becauseYouSaid: "kicked out of school",
          urgency: "act_now"
        },
        { id: "ky_spin", why: "A free helpline that walks you through the meeting.", urgency: "soon" }
      ]
    });
    render(<ReducerHarness initialState={withFamily({ ...schoolAgeFamilyState, activeDomains: ["school_iep"] })} />);

    const interview = screen.getByLabelText("What would you like help with?");
    await user.clear(interview);
    await user.type(interview, "He keeps getting kicked out of school and I do not know what to ask for.");
    await user.click(screen.getByRole("button", { name: "Find help" }));

    const heard = await screen.findByTestId("family-heard");
    expect(within(heard).getByText(/school keeps sending him home/)).toBeVisible();
    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.recommendations?.lead).toBe("school_iep");

    const cards = within(screen.getByTestId("matched-family-resources")).getAllByTestId("family-resource-card");
    expect(cards[0]).toHaveAttribute("data-resource-id", "idea_school_discipline");
    expect(within(cards[0]).getByTestId("family-resource-why")).toHaveTextContent(/ten days/);
    expect(within(cards[0]).getByTestId("family-resource-quote")).toHaveTextContent("kicked out of school");
    expect(within(cards[0]).getByTestId("family-resource-urgency")).toHaveTextContent("Worth doing now");
    // The card's own facts still come from the catalog, never from the model.
    expect(within(cards[0]).getByRole("heading", { name: "IDEA school discipline protections" })).toBeVisible();
  });

  it("falls back to the deterministic order when the ranking call fails", async () => {
    const user = userEvent.setup();
    requestFamilyRecommendations.mockResolvedValue(null);
    render(<ReducerHarness initialState={withFamily({ ...schoolAgeFamilyState, activeDomains: ["school_iep"] })} />);

    const interview = screen.getByLabelText("What would you like help with?");
    await user.clear(interview);
    await user.type(interview, "He keeps getting kicked out of school and I do not know what to ask for.");
    await user.click(screen.getByRole("button", { name: "Find help" }));

    await waitFor(() => expect(requestFamilyRecommendations).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        within(screen.getByTestId("matched-family-resources")).getAllByTestId("family-resource-card").length
      ).toBeGreaterThan(0)
    );
    expect(screen.queryByTestId("family-resource-why")).not.toBeInTheDocument();
    expect(screen.getByTestId("family-heard")).toBeVisible();
  });

  it("drops a hallucinated id and an ungrounded quote before anything renders", async () => {
    const user = userEvent.setup();
    requestFamilyRecommendations.mockResolvedValue({
      heard: "You told us school is the problem.",
      lead: "school_iep",
      recommendations: [
        { id: "totally_invented_program", why: "trust me", urgency: "act_now" },
        {
          id: "idea_school_discipline",
          why: "This is the review the school owes you.",
          becauseYouSaid: "words the caregiver never wrote",
          urgency: "act_now"
        }
      ]
    });
    render(<ReducerHarness initialState={withFamily({ ...schoolAgeFamilyState, activeDomains: ["school_iep"] })} />);

    const interview = screen.getByLabelText("What would you like help with?");
    await user.clear(interview);
    await user.type(interview, "He keeps getting kicked out of school and I do not know what to ask for.");
    await user.click(screen.getByRole("button", { name: "Find help" }));

    // The deterministic cards render first, so wait for the ranking to land.
    await waitFor(() =>
      expect(
        within(screen.getByTestId("matched-family-resources"))
          .getAllByTestId("family-resource-card")[0]
      ).toHaveAttribute("data-resource-id", "idea_school_discipline")
    );
    const cards = within(screen.getByTestId("matched-family-resources")).getAllByTestId(
      "family-resource-card"
    );
    expect(cards.map((card) => card.getAttribute("data-resource-id"))).not.toContain(
      "totally_invented_program"
    );
    expect(within(cards[0]).queryByTestId("family-resource-quote")).not.toBeInTheDocument();
    expect(within(cards[0]).getByTestId("family-resource-why")).toBeVisible();
  });

  it("starts a first visit completely blank, with no example shortcuts or pre-filled text", () => {
    render(<FamilyExperience state={withFamily(null)} dispatch={vi.fn()} passcode="" />);

    expect(screen.getByLabelText(/What would you like help with/i)).toHaveValue("");
    expect(screen.queryByText(/fictional|example/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("matched-family-resources")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Here is what we heard" })).not.toBeInTheDocument();
  });

  it("keeps the simple needs screen collapsed until requested and preserves its eight-question path", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    const disclosure = screen.getByRole("button", { name: /rather answer yes or no/i });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "What would help?" })).not.toBeInTheDocument();

    await user.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "What would help?" })).toBeVisible();

    const yesAnswers = screen.getAllByRole("radio", { name: "Yes" });
    expect(yesAnswers).toHaveLength(8);
    for (const answer of yesAnswers) {
      await user.click(answer);
    }
    await user.click(screen.getByRole("button", { name: "See what can help" }));

    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.screenAnswers).toHaveLength(8);
    expect(family.activeDomains).toEqual([
      "early_intervention",
      "therapies",
      "school_iep",
      "waivers_financial",
      "respite",
      "parent_support",
      "sibling_support",
      "transportation"
    ]);
  });

  it("does not attach a late extraction after the profile changes underneath it", async () => {
    const user = userEvent.setup();
    const pending = deferred<null>();
    requestFamilyInterview.mockReturnValueOnce(pending.promise);
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await user.click(screen.getByRole("button", { name: "Find help" }));
    await changeCounty(user, "Perry");
    const stateAfterChange = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(stateAfterChange.profile?.county).toBe("Perry");
    expect(stateAfterChange.interviews).toEqual([]);

    await act(async () => pending.resolve(null));
    const stateAfterLateResponse = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(stateAfterLateResponse.profile?.county).toBe("Perry");
    expect(stateAfterLateResponse.interviews).toEqual([]);
    expect(stateAfterLateResponse.facts).toEqual([]);
    expect(stateAfterLateResponse.activeDomains).toEqual([]);
  });

  it("resets an active follow-up thread when the profile changes", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await user.click(screen.getByRole("button", { name: "Find help" }));
    await screen.findByRole("heading", { name: "What has the school offered so far?" });
    await changeCounty(user, "Perry");

    expect(screen.queryByRole("heading", { name: "What has the school offered so far?" })).not.toBeInTheDocument();
  });

  it("uses exact fallback resources only for an honest domain zero-match, not for no selected domains", () => {
    const profile = { ...schoolAgeFamilyState.profile!, county: "Boone" };
    const zeroMatchFamily: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      profile,
      activeDomains: ["transportation"]
    };
    const { rerender } = render(
      <FamilyExperience state={withFamily(zeroMatchFamily)} dispatch={vi.fn()} passcode="" />
    );

    const fallback = screen.getByRole("region", { name: "Nothing local matched yet" });
    expect(within(fallback).getAllByTestId("family-resource-card").map((card) => card.getAttribute("data-resource-id"))).toEqual([
      "ky_spin",
      "hdi_resource_guide",
      "kynect_resources",
      "kentucky_211"
    ]);

    rerender(
      <FamilyExperience
        state={withFamily({ ...zeroMatchFamily, activeDomains: [] })}
        dispatch={vi.fn()}
        passcode=""
      />
    );
    expect(screen.queryByRole("region", { name: "Nothing local matched yet" })).not.toBeInTheDocument();
  });

  it("shows an honest localized timeline empty state when a profile has no current stage entries", () => {
    const family: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      profile: {
        ...schoolAgeFamilyState.profile!,
        birthMonth: 1,
        diagnoses: [],
        schoolStage: "elementary"
      }
    };
    render(<FamilyExperience state={withFamily(family)} dispatch={vi.fn()} passcode="" />);

    expect(screen.getByText("Nothing to plan for right now based on what you have told us.")).toBeVisible();
  });

  it("requires consent for sharing, writes one shared audit event, and sinks enrolled resources without urgency", async () => {
    const user = userEvent.setup();
    const family: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["waivers_financial"]
    };
    render(<ReducerHarness initialState={withFamily(family)} />);

    const michelle = screen.getByTestId("matched-family-resources").querySelector(
      '[data-resource-id="michelle_p_waiver"]'
    ) as HTMLElement;
    expect(within(michelle).getByText(/date ordered/i)).toBeVisible();
    const share = within(michelle).getByRole("button", { name: /Share.*Michelle P/i });
    expect(share).toBeDisabled();
    await user.click(within(michelle).getByRole("checkbox"));
    await user.click(share);
    await waitFor(() => {
      const audit = JSON.parse(screen.getByTestId("audit-events").textContent || "[]") as Array<{ action: string; label: string }>;
      expect(audit.filter(({ action, label }) => action === "shared" && label.includes("Michelle P."))).toHaveLength(1);
    });

    await user.click(within(michelle).getByRole("button", { name: /We already have this.*Michelle P/i }));
    await waitFor(() => expect(within(michelle).queryByText(/date ordered/i)).not.toBeInTheDocument());
    const orderedCards = within(screen.getByTestId("matched-family-resources")).getAllByTestId("family-resource-card");
    expect(orderedCards.at(-1)).toHaveAttribute("data-resource-id", "michelle_p_waiver");
  });

  it("keeps enrolled CHILD visible after the four unenrolled waiver choices and suppresses its urgency", () => {
    const family: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["waivers_financial"],
      alreadyEnrolled: ["child_waiver"]
    };
    render(<FamilyExperience state={withFamily(family)} dispatch={vi.fn()} passcode="" />);

    const matched = screen.getByTestId("matched-family-resources");
    const cards = within(matched).getAllByTestId("family-resource-card");
    const ids = cards.map((card) => card.getAttribute("data-resource-id"));
    expect(ids).toContain("child_waiver");
    expect(ids.at(-1)).toBe("child_waiver");
    const child = matched.querySelector('[data-resource-id="child_waiver"]') as HTMLElement;
    expect(within(child).getByText("You already have this")).toBeVisible();
    expect(within(child).queryByText(/Why it helps to start now/i)).not.toBeInTheDocument();
  });

  it("does not duplicate CKRH when recreation is primary and hides therapeutic recreation outside age or county", () => {
    const recreationFamily: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["recreation"]
    };
    const { rerender } = render(
      <FamilyExperience state={withFamily(recreationFamily)} dispatch={vi.fn()} passcode="" />
    );

    expect(screen.getAllByText("Central Kentucky Riding for Hope")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Something else nearby" })).not.toBeInTheDocument();

    rerender(
      <FamilyExperience
        state={withFamily({
          ...schoolAgeFamilyState,
          profile: { ...schoolAgeFamilyState.profile!, birthYear: 2024, birthMonth: 1 },
          activeDomains: ["school_iep"]
        })}
        dispatch={vi.fn()}
        passcode=""
      />
    );
    expect(screen.queryByRole("region", { name: "Something else nearby" })).not.toBeInTheDocument();

    rerender(
      <FamilyExperience
        state={withFamily({
          ...schoolAgeFamilyState,
          profile: { ...schoolAgeFamilyState.profile!, county: "Boone" },
          activeDomains: ["school_iep"]
        })}
        dispatch={vi.fn()}
        passcode=""
      />
    );
    expect(screen.queryByRole("region", { name: "Something else nearby" })).not.toBeInTheDocument();
  });

  it("renders substantive localized Spanish mock facts, rationales, resources, and source-language notice", async () => {
    const user = userEvent.setup();
    const spanishFamily: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      interviewDraft: SAMPLE_CAREGIVER_TEXT_ES
    };
    render(<ReducerHarness initialState={withFamily(spanishFamily, "es")} />);

    expect(screen.getByTestId("family-experience")).toHaveAttribute("lang", "es");
    expect(screen.getByText(/borrador.*hablante nativa/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Buscar ayuda/i }));
    await screen.findByRole("heading", { name: /Esto fue lo que entendimos/i });
    expect(screen.getByRole("heading", { name: "¿Qué ha ofrecido la escuela hasta ahora?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nada todavía" })).toBeVisible();
    const review = reviewTurn("Esto fue lo que entendimos");
    expect(within(review).getByText("Grado")).toBeVisible();
    expect(within(review).getAllByText("segundo grado")[0]).toBeVisible();
    expect(within(review).getByText("Diagnóstico informado")).toBeVisible();
    expect(within(review).getByText("dislexia")).toBeVisible();
    expect(within(review).getByText("Sobre la escuela y el aprendizaje")).toBeVisible();
    expect(within(review).getByText(/Mencionaste la escuela/)).toBeVisible();
    expect(screen.getByText(/vienen directo de las organizaciones.*en inglés/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Scott County Schools Exceptional Child Services" })).toBeVisible();
  });

  it("shows the safety banner without taking the resources away", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily({ ...schoolAgeFamilyState, activeDomains: ["school_iep"] })} />);

    expect(screen.getByTestId("matched-family-resources")).toBeVisible();
    const interview = screen.getByLabelText("What would you like help with?");
    await user.clear(interview);
    await user.type(interview, "honestly she's been saying she wants to die");
    await user.click(screen.getByRole("button", { name: "Find help" }));

    const banner = await screen.findByTestId("family-crisis-banner");
    expect(within(banner).getByRole("link", { name: /Call 988/i })).toHaveAttribute("href", "tel:988");
    expect(within(banner).getByRole("link", { name: /Call 911/i })).toHaveAttribute("href", "tel:911");
    // The navigator keeps helping — this is the whole point of the change.
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();

    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.safetyEvents).toHaveLength(1);
    expect(family.safetyEvents[0].acknowledgedAt).toBeUndefined();

    await user.click(within(banner).getByRole("button", { name: "I've seen this — continue" }));
    const acknowledged = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(acknowledged.safetyEvents[0].acknowledgedAt).toEqual(expect.any(String));
    const audit = JSON.parse(screen.getByTestId("audit-events").textContent || "[]") as Array<{ label: string }>;
    expect(audit.map(({ label }) => label)).toEqual(
      expect.arrayContaining(["Family safety resources shown", "Family safety resources acknowledged"])
    );
  });

  it("keeps the thread and resources alive when a follow-up answer discloses a crisis", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await user.click(screen.getByRole("button", { name: "Find help" }));
    await screen.findByRole("heading", { name: "What has the school offered so far?" });
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();

    const crisisText = "I am going to kill myself tonight";
    await user.type(screen.getByRole("textbox", { name: "Or type a short answer" }), crisisText);
    await user.click(screen.getByRole("button", { name: "Add answer" }));

    expect(await screen.findByTestId("family-crisis-banner")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
    // The opening call only — the crisis answer was extracted on-device.
    expect(requestFamilyInterview).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Here is what we heard" })).toBeVisible();
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

// Two steps the family committed to and has not moved: the oldest is the one the
// turn asks about. Stamps are relative so the staleness window holds any day.
function familyWithStaleSteps(daysStale: number): FamilyNavigatorState {
  const stamp = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString();
  return {
    ...schoolAgeFamilyState,
    steps: [
      {
        id: "step-waiver",
        resourceId: "michelle_p_waiver",
        domain: "waivers_financial",
        status: "planned",
        plannedAt: stamp(daysStale),
        updatedAt: stamp(daysStale)
      },
      {
        id: "step-spin",
        resourceId: "ky_spin",
        domain: "parent_support",
        status: "planned",
        plannedAt: stamp(daysStale - 1),
        updatedAt: stamp(daysStale - 1)
      }
    ]
  };
}

function familyStateOutput(): FamilyNavigatorState {
  return JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
}

describe("next-steps follow-up turn", () => {
  it("asks about the oldest stale step, records the answer, and asks only once per visit", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyWithStaleSteps(10))} />);

    const followup = screen.getByTestId("family-followup");
    expect(within(followup).getByText(/Last time you planned to contact Michelle P\. Waiver/)).toBeVisible();

    await user.click(within(followup).getByRole("button", { name: "Left a message" }));

    const family = familyStateOutput();
    expect(family.steps.find(({ id }) => id === "step-waiver")).toMatchObject({ status: "tried" });
    // The second stale step waits for the next visit — one ask at a time.
    expect(family.steps.find(({ id }) => id === "step-spin")).toMatchObject({ status: "planned" });
    expect(screen.getByTestId("family-followup")).toHaveTextContent(/Noted/);
    expect(screen.queryByText(/how did it go\?/)).not.toBeInTheDocument();
  });

  it("keeps a not-yet step planned but restarts its seven-day clock", async () => {
    const user = userEvent.setup();
    const seeded = familyWithStaleSteps(10);
    render(<ReducerHarness initialState={withFamily(seeded)} />);

    await user.click(
      within(screen.getByTestId("family-followup")).getByRole("button", { name: "Haven't yet" })
    );

    const step = familyStateOutput().steps.find(({ id }) => id === "step-waiver");
    expect(step?.status).toBe("planned");
    expect(new Date(step!.updatedAt).valueOf()).toBeGreaterThan(
      new Date(seeded.steps[0].updatedAt).valueOf()
    );
  });

  it("stays silent while a step is fresh or the monthly check-in is due", () => {
    const { unmount } = render(<ReducerHarness initialState={withFamily(familyWithStaleSteps(3))} />);
    expect(screen.queryByTestId("family-followup")).not.toBeInTheDocument();
    unmount();

    render(<ReducerHarness initialState={withFamily(familyWithStaleSteps(40))} />);
    expect(screen.queryByTestId("family-followup")).not.toBeInTheDocument();
  });
});

// One orientation interview and nothing since — the only touch on the clock.
function familyQuietFor(days: number): FamilyNavigatorState {
  return {
    ...schoolAgeFamilyState,
    interviewDraft: SAMPLE_CAREGIVER_TEXT,
    interviews: [
      {
        id: "interview-old",
        rawText: "Riley is in fourth grade and reading is hard.",
        source: "typed",
        createdAt: new Date(Date.now() - days * DAY_MS).toISOString(),
        extraction: "mock",
        kind: "orientation"
      }
    ]
  };
}

describe("monthly check-in", () => {
  it("stays away until a month of silence, and the demo control produces one", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyQuietFor(3))} />);

    expect(screen.queryByTestId("family-checkin")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Demo: pretend a month passed" }));

    expect(screen.getByTestId("family-checkin")).toBeVisible();
    expect(screen.queryByTestId("family-checkin-demo")).not.toBeInTheDocument();
    expect(screen.getByTestId("audit-events")).toHaveTextContent(
      "Demo control: family activity moved 31 days back"
    );
  });

  it("files the note it invites under the check-in kind", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyQuietFor(40))} />);

    await user.click(
      within(screen.getByTestId("family-checkin")).getByRole("button", { name: "Add a note" })
    );
    await user.click(screen.getByRole("button", { name: "Find help" }));
    await screen.findByRole("heading", { name: "Here is what we heard" });

    const interviews = familyStateOutput().interviews;
    expect(interviews).toHaveLength(2);
    expect(interviews.at(-1)?.kind).toBe("checkin");
    // The card stays for its remaining part instead of vanishing mid-sequence.
    expect(screen.getByTestId("family-checkin")).toHaveAttribute("data-checkin-part", "probe");
  });

  it("hands a probe yes to the clinic-now card, then resumes the check-in at the pulse", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyQuietFor(40))} />);

    const checkin = screen.getByTestId("family-checkin");
    await user.click(within(checkin).getByRole("button", { name: "Nothing new" }));
    await user.click(within(checkin).getByRole("button", { name: "Yes, I think so" }));

    // One ask at a time: the clinic-now card owns the page until it is read.
    expect(screen.getByTestId("family-clinic-now-card")).toBeVisible();
    expect(screen.queryByTestId("family-checkin")).not.toBeInTheDocument();
    expect(familyStateOutput().flags).toMatchObject([{ type: "regression", source: "probe" }]);

    await user.click(
      within(screen.getByTestId("family-clinic-now-card")).getByRole("button", {
        name: "I've noted this"
      })
    );

    // The pulse is the whole point of the check-in, so it survives the detour.
    const resumed = screen.getByTestId("family-checkin");
    expect(resumed).toHaveAttribute("data-checkin-part", "pulse");
    expect(within(resumed).getByText("How supported do you feel this month?")).toBeVisible();
    expect(within(resumed).getByTestId("family-checkin-live-turn")).toHaveTextContent(
      "Monthly check-in: How supported do you feel this month?"
    );
    // Neither earlier part comes back, so the probe cannot raise a second flag.
    expect(
      screen.queryByText("It's been about a month. Anything new or different with Riley?")
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yes, I think so" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a note" })).not.toBeInTheDocument();

    await user.click(within(resumed).getByRole("button", { name: "4" }));

    const family = familyStateOutput();
    expect(family.pulses).toMatchObject([{ score: 4 }]);
    expect(family.flags).toHaveLength(1);
    expect(family.checkinTouchedAt).not.toBeNull();
    expect(screen.queryByTestId("family-clinic-now-card")).not.toBeInTheDocument();
  });

  it("records the pulse, stamps the touch, and rests until next month", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyQuietFor(40))} />);

    const checkin = screen.getByTestId("family-checkin");
    await user.click(within(checkin).getByRole("button", { name: "Nothing new" }));
    await user.click(within(checkin).getByRole("button", { name: "No" }));
    await user.click(within(checkin).getByRole("button", { name: "4" }));

    const family = familyStateOutput();
    expect(family.pulses).toMatchObject([{ score: 4 }]);
    expect(family.checkinTouchedAt).not.toBeNull();
    expect(within(screen.getByTestId("family-checkin")).getByText("Thanks — see you next month.")).toBeVisible();
  });

  it("skips for the whole visit and stops asking", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyQuietFor(40))} />);

    await user.click(
      within(screen.getByTestId("family-checkin")).getByRole("button", { name: "Skip check-in" })
    );

    expect(screen.queryByTestId("family-checkin")).not.toBeInTheDocument();
    expect(familyStateOutput().checkinTouchedAt).not.toBeNull();
    expect(familyStateOutput().pulses).toEqual([]);
  });
});

// Every follow-up round re-extracts the whole conversation so far, so the same
// observation comes back word for word. What the family sees must not repeat.
describe("orientation follow-up rounds", () => {
  const REGRESSION_TEXT =
    "He stopped saying the words he knew, like more and mama. He is in second grade and reading is really hard for him.";

  it("records each observation once and files every round under the orientation", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await user.click(screen.getByRole("button", { name: "Find help" }));
    await screen.findByRole("heading", { name: "What has the school offered so far?" });
    await user.click(screen.getByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: "Have you applied for any state programs yet?" });
    await user.click(screen.getByRole("button", { name: "Not yet" }));
    await screen.findByText("Thanks. That is enough to get you started.");

    const family = familyStateOutput();
    expect(family.interviews).toHaveLength(3);
    // Rounds one and two continue the first conversation, so none of them is a note.
    expect(family.interviews.map(({ kind }) => kind)).toEqual([
      "orientation",
      "orientation",
      "orientation"
    ]);
    expect(family.facts.map(({ label }) => label)).toEqual([
      "Grade",
      "Reported diagnosis",
      "About school and learning"
    ]);
    expect(family.facts.every(({ interviewId }) => interviewId === family.interviews[0].id)).toBe(true);

    const journal = screen.getByTestId("family-journal");
    expect(within(journal).getAllByRole("article")).toHaveLength(3);
    // Three fact cards, but the family wrote one note — the heading counts notes.
    expect(within(journal).getByRole("heading", { level: 3, name: /— 1 note$/ })).toBeVisible();

    // A packet that says the same sentence three times reads as careless.
    const packet = screen.getByTestId("family-visit-packet-body").textContent ?? "";
    expect(packet.split("reading is really hard for him").length - 1).toBe(1);

    // Nothing was written as a journal note, so the header claims none.
    expect(within(screen.getByTestId("family-wait-header")).queryByText(/notes/)).not.toBeInTheDocument();
  });

  it("keeps a check-in's own follow-up round filed as a check-in", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyQuietFor(40))} />);

    await user.click(
      within(screen.getByTestId("family-checkin")).getByRole("button", { name: "Add a note" })
    );
    await user.click(screen.getByRole("button", { name: "Find help" }));
    await screen.findByRole("heading", { name: "What has the school offered so far?" });
    await user.click(screen.getByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: "Have you applied for any state programs yet?" });

    const interviews = familyStateOutput().interviews;
    expect(interviews.map(({ kind }) => kind)).toEqual(["orientation", "checkin", "checkin"]);
  });

  it("asks about one regression sentence once, even after the card is acknowledged", async () => {
    const user = userEvent.setup();
    render(
      <ReducerHarness
        initialState={withFamily({ ...schoolAgeFamilyState, interviewDraft: REGRESSION_TEXT })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Find help" }));
    const card = await screen.findByTestId("family-clinic-now-card");
    await user.click(within(card).getByRole("button", { name: "I've noted this" }));
    expect(screen.queryByTestId("family-clinic-now-card")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: "Has anyone talked with you about therapy visits?" });

    // The sentence is still in the transcript, but it was written once, so it asks once.
    expect(familyStateOutput().flags).toHaveLength(1);
    expect(screen.queryByTestId("family-clinic-now-card")).not.toBeInTheDocument();
  });
});

describe("while-you-wait guide strip", () => {
  it("renders matched guides with their source under the resources, capped at two", () => {
    render(
      <ReducerHarness
        initialState={withFamily({ ...schoolAgeFamilyState, activeDomains: ["school_iep"] })}
      />
    );

    const strip = screen.getByTestId("family-guides");
    expect(within(strip).getByRole("heading", { name: "Things to try at home" })).toBeVisible();
    expect(
      within(strip).getByText(
        "Small, checked ideas for the meantime — from the sources named on each card."
      )
    ).toBeVisible();

    const cards = within(strip).getAllByTestId("family-guide-card");
    expect(cards.length).toBeLessThanOrEqual(2);
    expect(cards.map((card) => card.getAttribute("data-guide-id"))).toEqual(["kyspin_resources"]);
    expect(within(cards[0]).getByTestId("family-guide-source")).toHaveTextContent(
      /Source: KY-SPIN, Inc\. · Checked on \d{4}-\d{2}-\d{2}/
    );
  });

  it("stays away until a domain is active", () => {
    render(<ReducerHarness initialState={withFamily(schoolAgeFamilyState)} />);

    expect(screen.queryByTestId("family-guides")).not.toBeInTheDocument();
  });
});

describe("P4 eighteen-month family", () => {
  it("renders the development stage and its hub link for an 18-month-old", () => {
    render(<ReducerHarness initialState={withFamily(eighteenMonthFamilyState(new Date()))} />);

    expect(screen.getByRole("heading", { name: "18-month development check" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open family check-ins" })).toHaveAttribute(
      "href",
      "/checkin#for-family"
    );
    expect(screen.getByTestId("family-state")).toHaveTextContent('"county":"Fayette"');
  });
});

// The header shows one rung and it is the feature's only navigation control, so
// a rung whose section is missing is a link that does nothing.
describe("wait header rungs", () => {
  const stamp = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString();

  // The First Steps cutoff falls 45 days before the third birthday, counted to
  // the first of the birth month. Pick the month start that lands the cutoff
  // inside the header's eight-week tail, whatever day this suite runs.
  function thirdBirthdayInsideRungTail(now: Date): Date {
    for (let ahead = 0; ahead < 8; ahead += 1) {
      const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + ahead, 1));
      const daysToCutoff = (candidate.valueOf() - 45 * DAY_MS - now.valueOf()) / DAY_MS;
      if (daysToCutoff > 1 && daysToCutoff < 56) {
        return candidate;
      }
    }
    throw new Error("No month start lands the First Steps cutoff inside the rung window.");
  }

  function familyNearFirstStepsCutoff(activeDomains: DevNeedDomain[]): FamilyNavigatorState {
    const now = new Date();
    const base = eighteenMonthFamilyState(now);
    const thirdBirthday = thirdBirthdayInsideRungTail(now);
    return {
      ...base,
      profile: {
        ...base.profile!,
        birthYear: thirdBirthday.getUTCFullYear() - 3,
        birthMonth: thirdBirthday.getUTCMonth() + 1
      },
      activeDomains
    };
  }

  const rungCases: Array<{ kind: string; href: string; family: () => FamilyNavigatorState }> = [
    {
      kind: "safety",
      href: "#family-experience",
      family: () => ({
        ...schoolAgeFamilyState,
        safetyEvents: [
          { id: "safety-1", tier: "crisis", domain: "self_harm", createdAt: stamp(0) }
        ]
      })
    },
    {
      kind: "visit",
      href: "#family-appt-title",
      family: () => ({
        ...schoolAgeFamilyState,
        appointments: [createFamilyAppointmentOffer(new Date())]
      })
    },
    {
      kind: "clinic_now",
      href: "#family-clinic-now",
      family: () => ({
        ...schoolAgeFamilyState,
        flags: [{ id: "flag-1", type: "regression", source: "text", raisedAt: stamp(0) }]
      })
    },
    {
      kind: "clock",
      href: "#family-resources",
      family: () => familyNearFirstStepsCutoff(["early_intervention"])
    },
    { kind: "checkin", href: "#family-checkin", family: () => familyQuietFor(40) },
    { kind: "step", href: "#family-followup", family: () => familyWithStaleSteps(10) },
    {
      kind: "journal",
      href: "#family-interview-title",
      family: () => ({ ...familyQuietFor(45), checkinTouchedAt: stamp(1) })
    }
  ];

  it.each(rungCases)("puts the $kind rung on a section that is on the page", ({ href, family }) => {
    render(<ReducerHarness initialState={withFamily(family())} />);

    expect(screen.getByTestId("family-next-rung")).toHaveAttribute("href", href);
    expect(document.querySelector(href)).toBeInTheDocument();
  });

  it("holds the First Steps rung until the resources section carries the countdown", () => {
    render(<ReducerHarness initialState={withFamily(familyNearFirstStepsCutoff([]))} />);

    // Nothing to scroll to: no active domain means no resources section and no
    // First Steps card, so the header says nothing rather than pointing at air.
    expect(document.querySelector("#family-resources")).not.toBeInTheDocument();
    expect(screen.queryByTestId("family-next-rung")).not.toBeInTheDocument();
  });

  it("keeps pointing at the check-in after its first answer ends the quiet month", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyWithStaleSteps(40))} />);

    expect(screen.getByTestId("family-next-rung")).toHaveAttribute("href", "#family-checkin");

    const checkin = screen.getByTestId("family-checkin");
    await user.click(within(checkin).getByRole("button", { name: "Nothing new" }));
    await user.click(within(checkin).getByRole("button", { name: "No" }));
    await user.click(within(checkin).getByRole("button", { name: "4" }));

    // The pulse stamped a touch, so the month of silence is over — but the card
    // is still up, and it is still holding back the follow-up turn.
    expect(screen.getByTestId("family-checkin")).toHaveAttribute("data-checkin-part", "done");
    expect(screen.queryByTestId("family-followup")).not.toBeInTheDocument();
    expect(screen.getByTestId("family-next-rung")).toHaveAttribute("href", "#family-checkin");
    expect(document.querySelector("#family-checkin")).toBeInTheDocument();
  });
});
