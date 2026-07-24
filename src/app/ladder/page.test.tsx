import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useReducer } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { brentState } from "@/domain/fixtures";
import { SAMPLE_CAREGIVER_TEXT, SAMPLE_CAREGIVER_TEXT_ES, eighteenMonthFamilyState, schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { AppState, FamilyNavigatorState } from "@/domain/types";
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

  it("does not steal focus for a persisted interview from an earlier visit", () => {
    const persistedFamily: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      interviews: [
        {
          id: "persisted-interview",
          rawText: "Riley is in fourth grade.",
          source: "typed",
          createdAt: "2026-07-16T12:00:00.000Z",
          extraction: "mock"
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

    expect(screen.getByText(/Demo.*not an official service/i)).toBeVisible();
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
    await waitFor(() => expect(screen.getByText("You said this is right")).toBeVisible());
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
    expect(screen.getByText("Grado")).toBeVisible();
    expect(screen.getAllByText("segundo grado")[0]).toBeVisible();
    expect(screen.getByText("Diagnóstico informado")).toBeVisible();
    expect(screen.getByText("dislexia")).toBeVisible();
    expect(screen.getByText("Sobre la escuela y el aprendizaje")).toBeVisible();
    expect(screen.getByText(/Mencionaste la escuela/)).toBeVisible();
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
