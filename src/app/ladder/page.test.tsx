import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useReducer } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { brentState } from "@/domain/fixtures";
import { SAMPLE_CAREGIVER_TEXT, SAMPLE_CAREGIVER_TEXT_ES, eighteenMonthFamilyState, schoolAgeFamilyState } from "@/domain/family-fixtures";
import { createFamilyAppointmentOffer } from "@/domain/family-appointments";
import type { AppState, DevNeedDomain, FamilyNavigatorState } from "@/domain/types";
import { healthReducer } from "@/state/store";
import { openAllFamilyFolds, showFamilySurface } from "@/test/family-folds";
import { FamilyExperience } from "@/components/family-experience";
import { ladderSurfaceForAnchor } from "@/components/ladder-shell";

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

// Scoped to the setup panel: the strip's disclosure mounts a second copy of this
// form, and both label their county select the same way.
async function changeCounty(user: ReturnType<typeof userEvent.setup>, county: string): Promise<void> {
  const basics = screen.getByRole("button", { name: /Add or change your child's details/i });
  if (basics.getAttribute("aria-expanded") === "false") {
    await user.click(basics);
  }
  const panel = document.getElementById("family-basics-panel") as HTMLElement;
  await user.selectOptions(within(panel).getByLabelText("Kentucky county"), county);
  await user.click(within(panel).getByRole("button", { name: "Save these details" }));
}

// A return visit opens on the front door and keeps the composer one tap away
// (P3), so a test about what the composer does opens it the way a caregiver
// would. On a first run there is nothing to open and this is a no-op.
async function openComposer(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const open = screen.queryByTestId("family-composer-open");
  if (open) {
    await user.click(open);
  }
}

async function submitDescription(
  user: ReturnType<typeof userEvent.setup>,
  label: string | RegExp = "Find help"
): Promise<void> {
  await openComposer(user);
  await user.click(screen.getByRole("button", { name: label }));
}

// Brings one of the four surfaces to the front by its tab. Before the tabs
// appear — the whole first session — Home is the only surface there is.
async function goToSurface(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp
): Promise<void> {
  const tab = screen.queryByRole("tab", { name });
  if (tab && tab.getAttribute("aria-selected") !== "true") {
    await user.click(tab);
  }
}

// The in-thread verification strip. The journal section repeats the same facts
// further down the page, so fact assertions name which one they mean.
function reviewTurn(): HTMLElement {
  return screen.getByTestId("family-heard-strip");
}

// jsdom still matches queries inside a closed <details>, but toBeVisible() does
// not — so every assertion about relocated fact content opens it first, the way
// a caregiver would.
async function openStrip(
  user: ReturnType<typeof userEvent.setup>,
  summary = /Check or change this/i
): Promise<HTMLElement> {
  // The strip belongs to the thread, which belongs to Home.
  await goToSurface(user, /Home/);
  const strip = reviewTurn();
  const details = within(strip).getByText(summary).closest("details") as HTMLDetailsElement;
  if (!details.open) {
    await user.click(within(strip).getByText(summary));
  }
  return details;
}

// The fixture carries no scripted draft, so tests that submit supply ordinary caregiver text.
const describedFamily: FamilyNavigatorState = { ...schoolAgeFamilyState, interviewDraft: SAMPLE_CAREGIVER_TEXT };

const F07_OPENING =
  "Noah is sixteen. He was diagnosed with autism and intellectual disability when he was younger. I know the system and I'm planning for adult transition, supported decision-making, ABLE, and waivers before he turns eighteen. Please do not start at the very beginning.";

const f07Family: FamilyNavigatorState = {
  ...schoolAgeFamilyState,
  profile: {
    childFirstName: "Noah",
    birthYear: 2010,
    birthMonth: 1,
    schoolStage: "high",
    county: "Christian",
    diagnoses: [
      { id: "f07-autism", label: "autism" },
      { id: "f07-id", label: "intellectual_disability" }
    ]
  },
  interviewDraft: F07_OPENING,
  screenAnswers: [],
  interviews: [],
  facts: [],
  latestInterviewDomains: [],
  activeDomains: [],
  recommendations: null
};

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
  // A test that follows an in-page link leaves that hash on the jsdom location,
  // and the next mount would treat it as a deep link and open that section.
  window.history.replaceState(null, "", window.location.pathname);
});

// The one-line verification that replaced the stack of confirmation cards.
describe("the heard strip", { timeout: 20_000 }, () => {
  async function submitAs(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
    await user.type(screen.getByLabelText("What would you like help with?"), text);
    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");
  }

  it("says the county, the child's age, and the lead need in one sentence", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");

    // Riley, born 2017, Scott County, school need.
    const sentence = screen.getByTestId("family-heard").textContent ?? "";
    expect(sentence).toMatch(/^Sounds like: /);
    expect(sentence).toContain("Scott County");
    expect(sentence).toContain("Riley, about");
    expect(sentence).toContain("School and IEP");
  });

  // tFamily prints an unmatched {token} literally, so the sentence is assembled
  // from the pieces we actually have.
  it("leaves out the pieces it does not know instead of printing placeholders", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await submitAs(user, "Reading is really hard for him at school.");

    const sentence = screen.getByTestId("family-heard").textContent ?? "";
    expect(sentence).not.toMatch(/[{}]/);
    expect(sentence).not.toContain("County");
    expect(sentence).toContain("School and IEP");
  });

  it("keeps the caregiver's facts, quotes, and confirm buttons one tap inside it", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");

    // Collapsed by default — the help is what leads.
    const strip = screen.getByTestId("family-heard-strip");
    expect(within(strip).getByText(/Check or change this/i).closest("details")).not.toHaveAttribute(
      "open"
    );
    expect(screen.queryByTestId("family-heard-strip-editor")).not.toBeInTheDocument();

    const disclosure = await openStrip(user);
    expect(within(disclosure).getByRole("heading", { name: "Here is what we heard" })).toBeVisible();
    expect(within(disclosure).getAllByText("You wrote")[0]).toBeVisible();
    expect(within(disclosure).getByText("Grade")).toBeVisible();
    expect(within(disclosure).getByRole("heading", { name: "Why we are showing this" })).toBeVisible();
    expect(within(disclosure).getByTestId("family-heard-strip-editor")).toBeVisible();
    expect(
      within(disclosure).getByText(/Nothing here is saved anywhere but this device/i)
    ).toBeVisible();
  });

  // Ladder's families are mostly 0-3. "about 1 years old" is exactly the phrasing
  // that reads as machine output, so each age form is written out by hand.
  it.each([
    [1, /about a year old/],
    [2, /about 2 years old/]
  ])("writes the age out for a %i-year-old", async (age, expected) => {
    const user = userEvent.setup();
    render(
      <ReducerHarness
        initialState={withFamily({
          ...schoolAgeFamilyState,
          profile: {
            ...schoolAgeFamilyState.profile!,
            childFirstName: undefined,
            birthYear: new Date().getFullYear() - age
          },
          interviewDraft: SAMPLE_CAREGIVER_TEXT
        })}
      />
    );

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");

    expect(screen.getByTestId("family-heard")).toHaveTextContent(expected);
    expect(screen.getByTestId("family-heard")).toHaveTextContent(/your child/);
  });

  // Every program decides its own eligibility. That caveat must survive the
  // reordering on the deterministic path, which is the whole zero-key demo.
  it("keeps the check-the-program's-rules caveat on screen when no model sentence is showing", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");

    await goToSurface(user, /Programs/);
    openAllFamilyFolds();
    const section = screen.getByTestId("matched-family-resources").closest("section") as HTMLElement;
    expect(within(section).getByText(/rules are the ones that count/i)).toBeVisible();
  });

  it("swaps in a grounded model sentence when one arrives, and keeps the strip a single line", async () => {
    const user = userEvent.setup();
    requestFamilyRecommendations.mockResolvedValue({
      heard: "You are looking for help with reading and an IEP meeting.",
      lead: "school_iep",
      recommendations: [
        { id: "scott_county_exceptional_child_services", urgency: "soon" as const }
      ]
    });
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");

    await waitFor(() =>
      expect(screen.getByTestId("family-heard")).toHaveTextContent(
        "You are looking for help with reading and an IEP meeting."
      )
    );
    expect(screen.getAllByTestId("family-heard")).toHaveLength(1);
    expect(screen.getAllByTestId("family-heard-strip")).toHaveLength(1);
  });
});

describe("FamilyExperience", { timeout: 20_000 }, () => {
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

  it("states the tool's limits plainly, in English and Spanish, without a tap", () => {
    // The owner removed the standing demo banner and the "what this tool can and
    // cannot do" disclosure it sat beside — this line is what still says it,
    // always visible.
    const { unmount } = render(
      <FamilyExperience state={withFamily(schoolAgeFamilyState, "en")} dispatch={vi.fn()} passcode="" />
    );
    expect(screen.getByText(/We do not diagnose/i)).toBeVisible();
    expect(screen.queryByText("What this tool can and cannot do")).not.toBeInTheDocument();

    unmount();
    render(<FamilyExperience state={withFamily(schoolAgeFamilyState, "es")} dispatch={vi.fn()} passcode="" />);
    expect(screen.getByText(/No diagnosticamos/i)).toBeVisible();
  });

  // F8.1. Both back-to-top links pointed at #family-experience, which the anchor
  // map owns for Home — so tapping "Back to top" at the foot of the Programs
  // library or the Journal silently switched the caregiver to a different tab.
  // Each now points at the top of the surface it is on.
  it("keeps every back-to-top link on the surface it lives on", () => {
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
    // returning them to the top of what they were reading.
    const links = screen.getAllByRole("link", { name: "Back to top", hidden: true });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toBe("#family-experience");
      // The target exists, and it belongs to the surface the link is on.
      const targetId = href.slice(1);
      expect(document.getElementById(targetId)).not.toBeNull();
      const linkSurface = link.closest("[data-ladder-panel]")?.getAttribute("data-ladder-panel");
      expect(ladderSurfaceForAnchor(href)).toBe(linkSurface);
    }
  });

  // Every doorway row names a surface that exists and a target that is in the
  // document. A row pointing at a section this state does not render is the
  // front door's one navigation control doing nothing.
  it("keeps every rendered doorway target in the document", () => {
    const { unmount } = render(
      <FamilyExperience state={withFamily(schoolAgeFamilyState)} dispatch={vi.fn()} passcode="" />
    );

    const baselineDoorways = within(screen.getByTestId("family-doorways"));
    // No matched needs yet, so there is no Programs surface to open.
    expect(baselineDoorways.queryByRole("link", { name: /Programs/ })).not.toBeInTheDocument();
    // No referral, so no appointment companion either (1h).
    expect(baselineDoorways.queryByRole("link", { name: /Your visit/ })).not.toBeInTheDocument();
    for (const link of baselineDoorways.getAllByRole("link")) {
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

    const conditionalDoorways = within(screen.getByTestId("family-doorways"));
    expect(conditionalDoorways.getByRole("link", { name: /Programs/ })).toBeVisible();
    expect(conditionalDoorways.getByRole("link", { name: /Visit packet/ })).toBeVisible();
    for (const link of conditionalDoorways.getAllByRole("link")) {
      const href = link.getAttribute("href");
      expect(href).toMatch(/^#/);
      expect(document.querySelector(href!)).toBeInTheDocument();
    }
  });

  // The bar is the only way between surfaces, so it can never name fewer than
  // the surfaces that exist — nor offer one that does not.
  it("shows a tab for every surface this family has, and no others", () => {
    const { unmount } = render(
      <FamilyExperience state={withFamily(schoolAgeFamilyState)} dispatch={vi.fn()} passcode="" />
    );
    // Home plus Notes (a profile means a packet). No matched needs, no referral.
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Home", "Notes"]);
    unmount();

    render(
      <FamilyExperience
        state={withFamily({
          ...schoolAgeFamilyState,
          activeDomains: ["school_iep"],
          referral: { clinic: "UK Developmental Pediatrics", referredAt: "2026-03-02T12:00:00.000Z" }
        })}
        dispatch={vi.fn()}
        passcode=""
      />
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Home",
      "Programs",
      "Notes",
      "Visit"
    ]);
  });

  // F1b. The redesign rendered all four panels always while the bar rendered
  // only the unlocked ones, so a first run shipped three (and, with no bar at
  // all, four) tabpanels labelled by ids nothing had rendered.
  it("labels no panel by a tab that is not on the page", () => {
    const dangling = (): string[] =>
      [...document.body.querySelectorAll("[aria-labelledby]")]
        .flatMap((node) => (node.getAttribute("aria-labelledby") ?? "").split(/\s+/))
        .filter((id) => id.length > 0 && document.getElementById(id) === null);

    const first = render(<FamilyExperience state={withFamily(null)} dispatch={vi.fn()} passcode="" />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryAllByRole("tabpanel", { hidden: true })).toHaveLength(0);
    expect(dangling()).toEqual([]);
    first.unmount();

    // Home + Notes: two tabs, two panels, and nothing pointing past them.
    render(<FamilyExperience state={withFamily(schoolAgeFamilyState)} dispatch={vi.fn()} passcode="" />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(2);
    expect(dangling()).toEqual([]);
  });

  // Stronger than "does not steal focus": a return visit does not reopen last
  // session's verification card at all. Home opens on what changed and what is
  // due, and the composer that produced the strip is one tap away (P3).
  it("does not replay an earlier visit's verification card", () => {
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

    expect(screen.queryByTestId("family-heard-strip")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    expect(screen.getByTestId("family-last-note")).toHaveTextContent(/Last note: July 16/);
    expect(screen.getByTestId("family-composer-open")).toBeVisible();
  });

  it("exposes F07's waiver follow-up through its accessible heading", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(f07Family)} />);

    await submitDescription(user);

    expect(
      await screen.findByRole("heading", {
        name: "Have you applied for any state programs yet?"
      })
    ).toBeVisible();
    expect(screen.getByText("Question 1 of 2")).toHaveAttribute(
      "aria-live",
      "polite"
    );
    expect(
      screen.queryByRole("heading", {
        name: /start at the very beginning|what is autism|new diagnosis/i
      })
    ).not.toBeInTheDocument();

    const family = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(family.latestInterviewDomains).toEqual([
      "waivers_financial",
      "future_planning"
    ]);
    expect(family.activeDomains).toEqual([
      "waivers_financial",
      "future_planning"
    ]);
    expect(family.activeDomains).not.toContain("therapies");
    expect(family.activeDomains).not.toContain("early_intervention");
  });

  it("runs the described-child path with atomic family facts, confirmation, deterministic Scott-first resources, saved return state, and timeline", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    expect(screen.getByRole("button", { name: /rather answer yes or no/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "What would help?" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/What would you like help with/i)).toHaveValue(SAMPLE_CAREGIVER_TEXT);
    const adultFactsBefore = screen.getByTestId("adult-facts").textContent;

    await submitDescription(user);
    await screen.findByRole("heading", { name: "Here is what we heard" });
    expect(screen.getByRole("heading", { name: "Here is what we heard" }).closest("section")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "What has the school offered so far?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Nothing yet" })).toBeVisible();
    // The library lives on its own surface now; this journey is about what the
    // library holds, so bring it up and leave it up.
    await goToSurface(user, /Programs/);
    showFamilySurface("Programs");
    openAllFamilyFolds();
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

    // Everything the old ceremony showed is still here, one tap inside the strip.
    const disclosure = await openStrip(user);
    await user.click(within(disclosure).getAllByRole("button", { name: /Yes, that is right/ })[0]);
    // The journal below renders the same fact, so scope the badge to the review turn.
    await waitFor(() =>
      expect(within(disclosure).getByText("You said this is right")).toBeVisible()
    );
    const stateAfterConfirm = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(stateAfterConfirm.facts.filter(({ status }) => status === "confirmed")).toHaveLength(1);

    await goToSurface(user, /Programs/);
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

    // Back to the thread for its next turn: the one ask is always on Home.
    await goToSurface(user, /Home/);
    await user.click(screen.getByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: "Have you applied for any state programs yet?" });
    const stateAfterFirstFollowUp = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(stateAfterFirstFollowUp.interviews).toHaveLength(2);
    expect(stateAfterFirstFollowUp.interviews[1].rawText).toBe(`${SAMPLE_CAREGIVER_TEXT}\nNothing yet`);

    await user.click(screen.getByRole("button", { name: "Not yet" }));
    // The round cap ends the thread. No sign-off block: the cards are the answer.
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Have you applied for any state programs yet?" })
      ).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Thanks. That is enough to get you started.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Who can take over for a few hours?" })).not.toBeInTheDocument();
    const stateAfterSecondFollowUp = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(stateAfterSecondFollowUp.interviews).toHaveLength(3);
    expect(stateAfterSecondFollowUp.interviews[2].rawText).toBe(
      `${SAMPLE_CAREGIVER_TEXT}\nNothing yet\nNot yet`
    );

    await goToSurface(user, /Programs/);
    const currentMatched = screen.getByTestId("matched-family-resources");
    const currentScottCard = within(currentMatched).getAllByTestId("family-resource-card")[0];
    await user.click(within(currentScottCard).getByRole("button", { name: /Save.*Scott County Schools/i }));
    const saved = screen.getByRole("region", { name: "Saved for later" });
    expect(within(saved).getByRole("heading", { name: "Scott County Schools Exceptional Child Services" })).toBeVisible();
    // Saving must not clone a card. The thread shows the head of the same list
    // the section shows, so the invariant is one card per resource per region.
    for (const region of ["matched-family-resources", "thread-family-resources"] as const) {
      expect(
        within(screen.getByTestId(region))
          .getAllByTestId("family-resource-card")
          .filter(
            (card) =>
              card.getAttribute("data-resource-id") === "scott_county_exceptional_child_services"
          )
      ).toHaveLength(1);
    }
    expect(within(saved).queryByRole("button", { name: /Share.*Scott County Schools/i })).not.toBeInTheDocument();

    await goToSurface(user, /Home/);
    openAllFamilyFolds();
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
    await submitDescription(user);
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
    // Real cards in the thread now, not a pointer at cards further down.
    expect(screen.queryByText(/places that can help — they're just below/i)).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("thread-family-resources")).getAllByTestId("family-resource-card")
        .length
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /See (all \d+|the \d+) places? below/i })).toHaveAttribute(
      "href",
      "#family-resources"
    );
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
    await submitDescription(user);

    const turns = await screen.findByTestId("family-basics-turns");
    await user.selectOptions(
      within(turns).getByLabelText(/which Kentucky county do you live in/i),
      "Pike"
    );
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.type(within(turns).getByLabelText(/What year was your child born/i), "2024");
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    // Theo is two. Nobody asks the grandmother of a two-year-old what grade he is in.
    expect(within(turns).queryByRole("button", { name: "Not school age" })).not.toBeInTheDocument();

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
  }, 20_000);

  it("applies the county, age, and stage the caregiver already wrote without asking for a tap", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "I have a seven-year-old with big meltdowns. He has been kicked out of school several times. We live in Breathitt County and we need help."
    );
    await submitDescription(user);

    // No confirm card, no turns, nothing to answer — the basics just land.
    const strip = await screen.findByTestId("family-heard-strip");
    expect(screen.queryByTestId("family-basics-prefill")).not.toBeInTheDocument();
    expect(screen.queryByTestId("family-basics-turns")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/which Kentucky county do you live in/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/What year was your child born/i)).not.toBeInTheDocument();

    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.profile).toMatchObject({
      county: "Breathitt",
      birthYear: new Date().getFullYear() - 7,
      schoolStage: "elementary"
    });
    // And it says out loud that nobody has checked them yet.
    expect(family.profileProvenance).toBe("extracted");
    expect(within(strip).getByText(/Breathitt County/)).toBeVisible();
    expect(within(strip).getByTestId("family-heard-guess-chip")).toBeVisible();
  });

  it("still asks for whatever the description left out, and never re-asks what it read", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "We live in Scott County and reading homework is a nightly battle."
    );
    await submitDescription(user);

    // County was written down, so only the birth year and stage are asked.
    const turns = await screen.findByTestId("family-basics-turns");
    expect(screen.queryByTestId("family-basics-prefill")).not.toBeInTheDocument();
    expect(within(turns).queryByLabelText(/which Kentucky county do you live in/i)).not.toBeInTheDocument();
    await user.type(within(turns).getByLabelText(/What year was your child born/i), "2017");
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.click(within(turns).getByRole("button", { name: "Elementary school" }));

    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.profile).toMatchObject({ county: "Scott", birthYear: 2017, schoolStage: "elementary" });
    // A person answered these turns, so nothing here is a guess.
    expect(family.profileProvenance).toBe("stated");
  });

  it("lets the caregiver correct what we picked up", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "We live in Breathitt County and reading homework is a nightly battle."
    );
    await submitDescription(user);

    const turns = await screen.findByTestId("family-basics-turns");
    await user.type(within(turns).getByLabelText(/What year was your child born/i), "2017");
    await user.click(within(turns).getByRole("button", { name: "Next" }));
    await user.click(within(turns).getByRole("button", { name: "Elementary school" }));
    expect(
      (JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState).profile
    ).toMatchObject({ county: "Breathitt" });

    // The county we read is wrong; changing it is one edit, not a re-interview.
    await changeCounty(user, "Scott");
    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.profile).toMatchObject({ county: "Scott", birthYear: 2017, schoolStage: "elementary" });
    expect(family.profileProvenance).toBe("stated");
  });

  it("rejects an out-of-range birth year in the conversational turn", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "Reading is really hard for him at school."
    );
    await submitDescription(user);
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
    await submitDescription(user);

    const heard = await screen.findByTestId("family-heard");
    expect(within(heard).getByText(/school keeps sending him home/)).toBeVisible();
    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.recommendations?.lead).toBe("school_iep");

    await goToSurface(user, /Programs/);
    openAllFamilyFolds();
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
    await submitDescription(user);

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
    await submitDescription(user);

    await goToSurface(user, /Programs/);
    // The deterministic cards render first, so wait for the ranking to land.
    await waitFor(() =>
      expect(
        within(screen.getByTestId("matched-family-resources"))
          .getAllByTestId("family-resource-card")[0]
      ).toHaveAttribute("data-resource-id", "idea_school_discipline")
    );
    openAllFamilyFolds();
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

    await submitDescription(user);
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

  // Correcting a county mid-thread is exactly what the strip's "Check or change
  // this" invites. It must not cost the caregiver the question they were answering.
  it("keeps an active follow-up thread when the caregiver corrects the profile", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByRole("heading", { name: "What has the school offered so far?" });
    await changeCounty(user, "Perry");

    expect(screen.getByRole("heading", { name: "What has the school offered so far?" })).toBeVisible();
    expect(familyStateOutput().profile).toMatchObject({ county: "Perry" });
    // The corrected county drives the next set of matches.
    await waitFor(() =>
      expect(
        within(screen.getByTestId("matched-family-resources"))
          .getAllByTestId("family-resource-card")
          .map((card) => card.getAttribute("data-resource-id"))
      ).not.toContain("scott_county_exceptional_child_services")
    );
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

    showFamilySurface("Programs");
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

    openAllFamilyFolds();
    expect(screen.getByText("Nothing to plan for right now based on what you have told us.")).toBeVisible();
  });

  it("requires consent for sharing, writes one shared audit event, and sinks enrolled resources without urgency", async () => {
    const user = userEvent.setup();
    const family: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["waivers_financial"]
    };
    render(<ReducerHarness initialState={withFamily(family)} />);

    await goToSurface(user, /Programs/);
    openAllFamilyFolds();
    const michelle = screen.getByTestId("matched-family-resources").querySelector(
      '[data-resource-id="michelle_p_waiver"]'
    ) as HTMLElement;
    expect(within(michelle).getByText(/date ordered/i)).toBeVisible();
    // Two taps, one consent: asking to share reveals the question, ticking it
    // answers, and only then does the audit line get written.
    await user.click(within(michelle).getByTestId("family-resource-share-open"));
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

  // F8.5. The dedupe window was "ever", so a genuine second share of the same
  // program months later was silently never recorded. It is per label per day.
  it("records a share again on a later day, and still only once today", async () => {
    const user = userEvent.setup();
    const family: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["waivers_financial"]
    };
    const lastMonth = {
      id: "audit-old-share",
      patientId: brentState.patient.id,
      action: "shared" as const,
      label: "Shared family resource: Michelle P. Waiver",
      createdAt: "2026-06-01T12:00:00.000Z"
    };
    render(
      <ReducerHarness
        initialState={{ ...withFamily(family), auditEvents: [...brentState.auditEvents, lastMonth] }}
      />
    );

    await goToSurface(user, /Programs/);
    openAllFamilyFolds();
    const michelle = screen
      .getByTestId("matched-family-resources")
      .querySelector('[data-resource-id="michelle_p_waiver"]') as HTMLElement;
    await user.click(within(michelle).getByTestId("family-resource-share-open"));
    await user.click(within(michelle).getByRole("checkbox"));
    await user.click(within(michelle).getByRole("button", { name: /Share.*Michelle P/i }));

    await waitFor(() => {
      const shares = (
        JSON.parse(screen.getByTestId("audit-events").textContent || "[]") as Array<{
          action: string;
          label: string;
          createdAt: string;
        }>
      ).filter(({ action, label }) => action === "shared" && label.includes("Michelle P."));
      // Last month's line survives and today's is written beside it.
      expect(shares).toHaveLength(2);
      expect(new Set(shares.map(({ createdAt }) => createdAt.slice(0, 10))).size).toBe(2);
    });
  });

  it("keeps enrolled CHILD visible at the end of a capped multi-domain list and suppresses its urgency", () => {
    const family: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep", "waivers_financial", "parent_support"],
      alreadyEnrolled: ["child_waiver"]
    };
    render(<FamilyExperience state={withFamily(family)} dispatch={vi.fn()} passcode="" />);

    showFamilySurface("Programs");
    const matched = screen.getByTestId("matched-family-resources");
    const cards = within(matched).getAllByTestId("family-resource-card");
    const ids = cards.map((card) => card.getAttribute("data-resource-id"));
    expect(ids).toHaveLength(8);
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
    // Spanish parity for the relocated facts: same six values, one tap in.
    const review = await openStrip(user, /Revisa o cambia esto/i);
    expect(within(review).getByText("Grado")).toBeVisible();
    expect(within(review).getAllByText("segundo grado")[0]).toBeVisible();
    expect(within(review).getByText("Diagnóstico informado")).toBeVisible();
    expect(within(review).getByText("dislexia")).toBeVisible();
    expect(within(review).getByText("Sobre la escuela y el aprendizaje")).toBeVisible();
    expect(within(review).getByText(/Mencionaste la escuela/)).toBeVisible();
    await goToSurface(user, /Programas/);
    openAllFamilyFolds();
    expect(screen.getByTestId("library-source-language-notice")).toBeVisible();
    expect(
      within(screen.getByTestId("matched-family-resources")).getByRole("heading", {
        name: "Scott County Schools Exceptional Child Services"
      })
    ).toBeVisible();
  });

  // F6a/F6b/F6d. Chrome was at exact 475/475 parity while every card a family
  // acts on was English — and the one notice that said so rendered on one
  // surface out of four.
  it("tells a Spanish reader where the English is, on every surface that has any", async () => {
    const user = userEvent.setup();
    render(
      <ReducerHarness
        initialState={withFamily(
          { ...schoolAgeFamilyState, interviewDraft: SAMPLE_CAREGIVER_TEXT_ES },
          "es"
        )}
      />
    );

    // F6d: the draft-translation caveat is in the shell header, so it is there
    // on entry and on every surface — not buried in one branch of the composer.
    expect(screen.getByTestId("ladder-spanish-review-notice")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Buscar ayuda/i }));
    await screen.findByRole("heading", { name: /Esto fue lo que entendimos/i });

    // The thread's answer cards: the first English a Spanish reader meets.
    const threadNotice = screen.getByTestId("thread-source-language-notice");
    expect(threadNotice).toBeVisible();
    expect(threadNotice).toHaveTextContent(/vienen directo de las organizaciones/i);

    await goToSurface(user, /Programas/);
    openAllFamilyFolds();
    expect(screen.getByTestId("library-source-language-notice")).toBeVisible();
    expect(screen.getByTestId("guides-source-language-notice")).toBeVisible();

    // F6b: the English nodes say they are English, so a Spanish screen-reader
    // voice switches for them and back for the chrome around them.
    const card = within(screen.getByTestId("matched-family-resources")).getAllByTestId(
      "family-resource-card"
    )[0];
    expect(card.querySelector("h3")).toHaveAttribute("lang", "en");
    expect(card.querySelector("h3")?.textContent).toBe(
      "Scott County Schools Exceptional Child Services"
    );
    const guide = within(screen.getByTestId("family-guides")).getAllByTestId("family-guide-card")[0];
    expect(guide.querySelector("h4")).toHaveAttribute("lang", "en");
    expect(guide.querySelector("ul")).toHaveAttribute("lang", "en");
  });

  it("says none of that to an English reader", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    expect(screen.queryByTestId("ladder-spanish-review-notice")).not.toBeInTheDocument();
    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");
    expect(screen.queryByTestId("thread-source-language-notice")).not.toBeInTheDocument();

    await goToSurface(user, /Programs/);
    openAllFamilyFolds();
    expect(screen.queryByTestId("library-source-language-notice")).not.toBeInTheDocument();
    const card = within(screen.getByTestId("matched-family-resources")).getAllByTestId(
      "family-resource-card"
    )[0];
    expect(card.querySelector("h3")).not.toHaveAttribute("lang");
  });

  it("shows the safety banner without taking the resources away", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily({ ...schoolAgeFamilyState, activeDomains: ["school_iep"] })} />);

    showFamilySurface("Programs");
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();
    showFamilySurface("Home");
    const interview = screen.getByLabelText("What would you like help with?");
    await user.clear(interview);
    await user.type(interview, "honestly she's been saying she wants to die");
    await submitDescription(user);

    const banner = await screen.findByTestId("family-crisis-banner");
    expect(within(banner).getByRole("link", { name: /Call 988/i })).toHaveAttribute("href", "tel:988");
    expect(within(banner).getByRole("link", { name: /Call 911/i })).toHaveAttribute("href", "tel:911");
    // The navigator keeps helping — this is the whole point of the change.
    expect(push).not.toHaveBeenCalled();
    showFamilySurface("Programs");
    openAllFamilyFolds();
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

  // F2b. "Stays until acknowledged" was the comment; the code read the latest
  // event with no acknowledged filter, and safetyEvents persist — so one
  // disclosure pinned the 988/911 banner above the header of every surface on
  // every future visit. Acknowledgement de-escalates presentation only: the
  // event stays in the record and the crisis routes stay on the page (FR-2).
  it("stands the crisis banner down after acknowledgement and raises it again on a new disclosure", async () => {
    const user = userEvent.setup();
    const acknowledgedFamily: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep"],
      safetyEvents: [
        {
          id: "safety-old",
          tier: "crisis",
          domain: "self_harm",
          createdAt: "2026-06-01T12:00:00.000Z",
          acknowledgedAt: "2026-06-01T12:05:00.000Z"
        }
      ]
    };

    render(<ReducerHarness initialState={withFamily(acknowledgedFamily)} />);

    // (a) A returning family carrying only acknowledged events sees no banner —
    // on any surface.
    expect(screen.queryByTestId("family-crisis-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ladder-crisis-layer")).not.toBeInTheDocument();
    showFamilySurface("Programs");
    expect(screen.queryByTestId("family-crisis-banner")).not.toBeInTheDocument();
    showFamilySurface("Notes");
    expect(screen.queryByTestId("family-crisis-banner")).not.toBeInTheDocument();
    showFamilySurface("Home");

    // (c) A new disclosure is a new pending event, and the banner returns.
    const interview = screen.getByLabelText("What would you like help with?");
    await user.clear(interview);
    await user.type(interview, "honestly she's been saying she wants to die");
    await submitDescription(user);
    const banner = await screen.findByTestId("family-crisis-banner");
    expect(within(banner).getByRole("link", { name: /Call 988/i })).toHaveAttribute("href", "tel:988");

    // (b) Acknowledging it puts it away without a reload — and keeps both events.
    await user.click(within(banner).getByRole("button", { name: "I've seen this — continue" }));
    expect(screen.queryByTestId("family-crisis-banner")).not.toBeInTheDocument();
    const family = JSON.parse(screen.getByTestId("family-state").textContent || "null") as FamilyNavigatorState;
    expect(family.safetyEvents).toHaveLength(2);
    expect(family.safetyEvents.every(({ acknowledgedAt }) => typeof acknowledgedAt === "string")).toBe(true);
  });

  it("keeps the thread and resources alive when a follow-up answer discloses a crisis", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByRole("heading", { name: "What has the school offered so far?" });
    showFamilySurface("Programs");
    openAllFamilyFolds();
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();

    showFamilySurface("Home");
    const crisisText = "I am going to kill myself tonight";
    await user.type(screen.getByRole("textbox", { name: "Or type a short answer" }), crisisText);
    await user.click(screen.getByRole("button", { name: "Add answer" }));

    expect(await screen.findByTestId("family-crisis-banner")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
    // The opening call only — the crisis answer was extracted on-device.
    expect(requestFamilyInterview).toHaveBeenCalledTimes(1);
    // 1i: the banner is layer 0 — above the surface's own header, and above the
    // tab bar's reach — so switching surfaces cannot put it below anything.
    const banner = screen.getByTestId("family-crisis-banner");
    expect(screen.getByTestId("ladder-crisis-layer")).toContainElement(banner);
    showFamilySurface("Programs");
    expect(banner).toBeVisible();
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();
    // The banner leads and the help stays: strip, thread cards, and the full
    // section are all still on the page beneath it.
    showFamilySurface("Home");
    expect(screen.getByTestId("family-heard-strip")).toBeVisible();
    expect(
      within(screen.getByTestId("thread-family-resources")).getAllByTestId("family-resource-card")
        .length
    ).toBeGreaterThan(0);
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

// FR-9. The page may show any amount of help at once; it may only ever ask one
// question. This is the assertion, not a description.
describe("one ask at a time", () => {
  // Every surface on the page that can hold an open question, counted by what it
  // actually is rather than by any one question's wording.
  function openQuestionCount(): number {
    const staleStep = screen.queryByTestId("family-followup");
    return [
      screen.queryByTestId("family-basics-turns"),
      screen.queryByTestId("family-checkin"),
      // The stale-step section stays mounted to say "Noted" after it is answered.
      staleStep?.querySelector("button") ? staleStep : null,
      document.getElementById("family-follow-up-question")
    ].filter((node) => node !== null && node !== undefined).length;
  }

  it("never opens a second question while the thread is asking one", async () => {
    const user = userEvent.setup();
    // A stale step is already waiting to be asked about when the page loads.
    render(
      <ReducerHarness
        initialState={withFamily({
          ...familyWithStaleSteps(10),
          interviewDraft: SAMPLE_CAREGIVER_TEXT
        })}
      />
    );
    expect(openQuestionCount()).toBe(1);

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");

    // The thread's follow-up is now the one ask; the stale-step question stands down.
    expect(screen.getByRole("heading", { name: "What has the school offered so far?" })).toBeVisible();
    expect(openQuestionCount()).toBe(1);
    // Help is not rationed by the one-ask rule — only questions are.
    expect(
      within(screen.getByTestId("thread-family-resources")).getAllByTestId("family-resource-card")
        .length
    ).toBeGreaterThan(0);

    // Answering moves the thread on; through the whole transition the page never
    // holds two open questions at once.
    await user.click(screen.getByRole("button", { name: "Nothing yet" }));
    expect(openQuestionCount()).toBeLessThanOrEqual(1);
    await screen.findByRole("heading", { name: "Have you applied for any state programs yet?" });
    expect(openQuestionCount()).toBe(1);

    // F7a. This is the state the header used to lie about: the step section is
    // gated on the thread as well as on the step, and the rung computation was
    // never told about the thread — so it offered "See how it went", pointing at
    // #family-followup, a section this render does not contain.
    expect(screen.queryByTestId("family-followup")).not.toBeInTheDocument();
    const rung = screen.queryByTestId("family-next-rung");
    // Either the header stands down, or whatever it points at is on the page.
    // Before F7a it did neither: it offered "See how it went" at #family-followup.
    if (rung) {
      const target = (rung.getAttribute("href") ?? "").slice(1);
      expect(target).not.toBe("family-followup");
      expect(document.getElementById(target), `rung target #${target}`).not.toBeNull();
    }
  });
});

// F7b / F7c / F8. The clock, the cap, and the batch of small defects the audit
// verified one by one.
describe("clock truth and the small-defect batch", () => {
  const toddler = (overrides: Partial<FamilyNavigatorState> = {}): FamilyNavigatorState => ({
    ...eighteenMonthFamilyState(new Date()),
    activeDomains: ["early_intervention", "therapies", "waivers_financial", "parent_support"],
    ...overrides
  });

  // F7b: the clock rung links #family-resources because the countdown lives on
  // the First Steps card. Nothing kept that card inside the displayed eight.
  it("keeps the First Steps card on the page the clock rung points at", () => {
    render(<FamilyExperience state={withFamily(toddler())} dispatch={vi.fn()} passcode="" />);

    showFamilySurface("Programs");
    openAllFamilyFolds();
    const shown = screen
      .getAllByTestId("family-resource-card")
      .map((card) => card.getAttribute("data-resource-id") ?? "");
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.some((id) => id.startsWith("first_steps"))).toBe(true);
  });

  // F7c: past the cutoff the clock returns null, and the family used to lose the
  // one dated thing on their page with no word about where the route continues.
  it("hands off to the school route once the First Steps window has closed", () => {
    const pastCutoff: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      profile: { ...schoolAgeFamilyState.profile!, birthYear: 2022, birthMonth: 1 },
      activeDomains: ["early_intervention"]
    };
    render(<FamilyExperience state={withFamily(pastCutoff)} dispatch={vi.fn()} passcode="" />);

    const handoff = screen.getByTestId("family-clock-handoff");
    expect(handoff).toHaveTextContent(/First Steps window has closed/);
    expect(handoff).toHaveTextContent(/preschool special-education evaluation/);
    expect(screen.getByTestId("family-clock-handoff-link")).toHaveAttribute("href", expect.stringContaining("http"));
  });

  it("says nothing about a closed window to a family still inside it", () => {
    render(<FamilyExperience state={withFamily(toddler())} dispatch={vi.fn()} passcode="" />);

    expect(screen.queryByTestId("family-clock-handoff")).not.toBeInTheDocument();
  });

  // F8.6: the section shows eight; the retrieval usually found more.
  it("names what the eight-card cap left out", () => {
    render(<FamilyExperience state={withFamily(toddler())} dispatch={vi.fn()} passcode="" />);

    showFamilySurface("Programs");
    openAllFamilyFolds();
    const cap = screen.queryByTestId("family-resources-cap");
    const shown = screen.getAllByTestId("family-resource-card").length;
    expect(cap).not.toBeNull();
    expect(cap).toHaveTextContent(`Showing ${shown} of `);
    expect(cap).toHaveTextContent(/of \d+ places we found\./);
  });

  // F8.7: Notes unlocks on a profile while the journal needs facts.
  it("names the emptiness on a Notes tab with a profile but no notes", () => {
    render(
      <FamilyExperience
        state={withFamily({ ...schoolAgeFamilyState, facts: [], interviews: [] })}
        dispatch={vi.fn()}
        passcode=""
      />
    );

    showFamilySurface("Notes");
    openAllFamilyFolds();
    const empty = screen.getByTestId("family-notes-empty");
    expect(empty).toHaveTextContent("Nothing written down yet");
    // The exits stay: an empty packet still carries the child's basics.
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
    expect(screen.queryByTestId("family-journal")).not.toBeInTheDocument();
  });

  it("drops the empty-notes copy as soon as there is a note", () => {
    render(
      <FamilyExperience
        state={withFamily({
          ...schoolAgeFamilyState,
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

    showFamilySurface("Notes");
    expect(screen.queryByTestId("family-notes-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("family-journal")).toBeInTheDocument();
  });

  // F8.4: both composers fall back to the on-device reader in silence.
  it("says when an answer was read on the device instead of by the assistant", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");
    openAllFamilyFolds();

    expect(screen.getByTestId("family-extraction-on-device")).toHaveTextContent(
      /read this on your phone, not with the online assistant/
    );
  });

  // F8.3: "Not sure" is recorded, raises no flag, and prints no packet line.
  it("records a not-sure probe answer without raising a flag", async () => {
    const user = userEvent.setup();
    render(
      <ReducerHarness
        initialState={withFamily({
          ...schoolAgeFamilyState,
          interviews: [
            {
              id: "old",
              rawText: "an old note",
              source: "typed",
              createdAt: "2026-01-01T12:00:00.000Z",
              extraction: "mock",
              kind: "note"
            }
          ]
        })}
      />
    );

    const checkin = await screen.findByTestId("family-checkin");
    await user.click(within(checkin).getByRole("button", { name: "Nothing new" }));
    await user.click(within(checkin).getByRole("button", { name: "Not sure" }));

    const family = JSON.parse(
      screen.getByTestId("family-state").textContent || "null"
    ) as FamilyNavigatorState;
    expect(family.probeAnswers?.map(({ answer }) => answer)).toEqual(["unsure"]);
    expect(family.flags).toHaveLength(0);
    expect(screen.queryByTestId("family-clinic-now-card")).not.toBeInTheDocument();
  });
});

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
    await submitDescription(user);
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
describe("orientation follow-up rounds", { timeout: 20_000 }, () => {
  const REGRESSION_TEXT =
    "He stopped saying the words he knew, like more and mama. He is in second grade and reading is really hard for him.";

  it("records each observation once and files every round under the orientation", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByRole("heading", { name: "What has the school offered so far?" });
    await user.click(screen.getByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: "Have you applied for any state programs yet?" });
    await user.click(screen.getByRole("button", { name: "Not yet" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Have you applied for any state programs yet?" })
      ).not.toBeInTheDocument()
    );
    // With resource cards already on screen, "that is enough to get you started"
    // is noise — the thread just ends.
    expect(screen.queryByText("Thanks. That is enough to get you started.")).not.toBeInTheDocument();

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

    showFamilySurface("Notes");
    openAllFamilyFolds();
    const journal = screen.getByTestId("family-journal");
    expect(within(journal).getAllByTestId("family-fact-row")).toHaveLength(3);
    // Three fact cards, but the family wrote one note — the heading counts notes.
    expect(within(journal).getByRole("heading", { level: 3, name: /— 1 note$/ })).toBeVisible();

    // A packet that says the same sentence three times reads as careless.
    const packet = screen.getByTestId("family-visit-packet-body").textContent ?? "";
    expect(packet.split("reading is really hard for him").length - 1).toBe(1);

    // Nothing was written as a journal note, so the header claims none.
    expect(within(screen.getByTestId("family-wait-chips")).queryByText(/notes/)).not.toBeInTheDocument();
  });

  it("keeps a check-in's own follow-up round filed as a check-in", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(familyQuietFor(40))} />);

    await user.click(
      within(screen.getByTestId("family-checkin")).getByRole("button", { name: "Add a note" })
    );
    await submitDescription(user);
    await screen.findByRole("heading", { name: "What has the school offered so far?" });
    await user.click(screen.getByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: "Have you applied for any state programs yet?" });

    const interviews = familyStateOutput().interviews;
    expect(interviews.map(({ kind }) => kind)).toEqual(["orientation", "checkin", "checkin"]);
  });

  it("raises child-owned regression before the family profile is saved", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness />);

    await user.type(
      screen.getByLabelText("What would you like help with?"),
      "He stopped talking."
    );
    await submitDescription(user);

    expect(await screen.findByTestId("family-clinic-now-card")).toBeVisible();
    expect(familyStateOutput().profile).toBeNull();
    expect(familyStateOutput().flags).toMatchObject([
      { type: "regression", source: "text" }
    ]);
  });

  it("asks about one regression sentence once, even after the card is acknowledged", async () => {
    const user = userEvent.setup();
    render(
      <ReducerHarness
        initialState={withFamily({ ...schoolAgeFamilyState, interviewDraft: REGRESSION_TEXT })}
      />
    );

    await submitDescription(user);
    const card = await screen.findByTestId("family-clinic-now-card");
    expect(familyStateOutput().flags).toMatchObject([
      { type: "regression", source: "text" }
    ]);
    await user.click(within(card).getByRole("button", { name: "I've noted this" }));
    expect(screen.queryByTestId("family-clinic-now-card")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Nothing yet" }));
    await screen.findByRole("heading", { name: "Has anyone talked with you about therapy visits?" });

    // The sentence is still in the transcript, but it was written once, so it asks once.
    expect(familyStateOutput().flags).toHaveLength(1);
    expect(screen.queryByTestId("family-clinic-now-card")).not.toBeInTheDocument();
  });

  it.each([
    ["I stopped talking after my stroke.", "en", /Find help/i],
    [
      "I currently receive speech therapy and stopped talking.",
      "en",
      /Find help/i
    ],
    ["He used to talk with me, but I no longer do.", "en", /Find help/i],
    [
      "He used to talk with me, but now I no longer do.",
      "en",
      /Find help/i
    ],
    ["Dejé de hablar después de mi derrame cerebral.", "es", /Buscar ayuda/i],
    ["Él antes hablaba conmigo, pero yo ya no.", "es", /Buscar ayuda/i],
    [
      "Él antes hablaba conmigo, pero ahora yo ya no.",
      "es",
      /Buscar ayuda/i
    ]
  ] as const)(
    "does not show the clinic-now card for caregiver-owned loss: %s",
    async (interviewDraft, language, submitName) => {
      const user = userEvent.setup();
      render(
        <ReducerHarness
          initialState={withFamily(
            { ...schoolAgeFamilyState, interviewDraft },
            language
          )}
        />
      );

      await user.click(screen.getByRole("button", { name: submitName }));
      await waitFor(() => {
        expect(familyStateOutput().interviews).toHaveLength(1);
      });

      expect(familyStateOutput().flags).toEqual([]);
      expect(
        screen.queryByTestId("family-clinic-now-card")
      ).not.toBeInTheDocument();
    }
  );

  it.each([
    ["I stopped talking, but he stopped walking.", "en", /Find help/i],
    ["He stopped walking, but I stopped talking.", "en", /Find help/i],
    ["Dejé de hablar, pero él dejó de caminar.", "es", /Buscar ayuda/i],
    ["Él dejó de caminar, pero yo dejé de hablar.", "es", /Buscar ayuda/i],
    [
      "I used to talk with him, but he no longer does.",
      "en",
      /Find help/i
    ],
    [
      "I used to talk with him, but now he no longer does.",
      "en",
      /Find help/i
    ],
    ["Yo antes hablaba con él, pero él ya no.", "es", /Buscar ayuda/i],
    [
      "Yo antes hablaba con él, pero ahora él ya no.",
      "es",
      /Buscar ayuda/i
    ]
  ] as const)(
    "still shows one clinic-now card when the same sentence also has caregiver loss: %s",
    async (interviewDraft, language, submitName) => {
      const user = userEvent.setup();
      render(
        <ReducerHarness
          initialState={withFamily(
            { ...schoolAgeFamilyState, interviewDraft },
            language
          )}
        />
      );

      await user.click(screen.getByRole("button", { name: submitName }));
      expect(await screen.findByTestId("family-clinic-now-card")).toBeVisible();
      expect(familyStateOutput().flags).toHaveLength(1);
      expect(familyStateOutput().flags).toMatchObject([
        { type: "regression", source: "text" }
      ]);
    }
  );
});

describe("while-you-wait guide strip", () => {
  it("renders matched guides with their source under the resources, capped at two", () => {
    render(
      <ReducerHarness
        initialState={withFamily({ ...schoolAgeFamilyState, activeDomains: ["school_iep"] })}
      />
    );

    showFamilySurface("Programs");
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

    openAllFamilyFolds();
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
        // The companion surface — and so the rung — needs a referral behind it.
        referral: { clinic: "UK Developmental Pediatrics", referredAt: stamp(120) },
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

// Spec 19: what the page shows before anyone taps. The thread carries a short
// answer, the reference sections carry one-line rows, and everything they hold
// is one tap — or one anchor — away.
describe("phone fit", { timeout: 20_000 }, () => {
  it("answers with compact cards in the thread and keeps the library on its own surface", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");

    // The library is not competing with the answer for the same scroll: it is a
    // whole surface, one tap away, and Home stays the one ask (P2).
    expect(screen.getByTestId("matched-family-resources")).not.toBeVisible();

    const threadCards = within(screen.getByTestId("thread-family-resources")).getAllByTestId(
      "family-resource-card"
    );
    expect(threadCards.length).toBeLessThanOrEqual(3);
    for (const card of threadCards) {
      expect(within(card).queryByTestId("family-resource-quote")).not.toBeInTheDocument();
      expect(within(card).queryByTestId("family-resource-share-open")).not.toBeInTheDocument();
      expect(within(card).getByTestId("family-resource-expand")).toBeVisible();
      // P1: compact or not, the way to reach the program is on the face.
      expect(
        within(card).queryByTestId("family-resource-call") ??
          within(card).queryByTestId("family-resource-start-online") ??
          within(card).queryByTestId("family-resource-face-school") ??
          within(card).queryByTestId("family-resource-face-provider") ??
          within(card).queryByTestId("family-resource-face-navigator")
      ).toBeVisible();
    }

    // One tap grows the first answer into the full card, in place.
    await user.click(within(threadCards[0]).getByTestId("family-resource-expand"));
    expect(within(threadCards[0]).getByTestId("family-resource-share-open")).toBeVisible();

    // And the tab shows the whole library, open — the surface is the disclosure.
    await goToSurface(user, /Programs/);
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();
  });

  it("keeps the library open when it is the only answer the family has", async () => {
    const user = userEvent.setup();
    render(
      <ReducerHarness
        initialState={withFamily({ ...schoolAgeFamilyState, activeDomains: ["school_iep"] })}
      />
    );

    // No thread, no strip, no compact cards — the section is what the caregiver
    // came for, so its surface does not hide it behind a summary row too.
    expect(screen.queryByTestId("thread-family-resources")).not.toBeInTheDocument();
    await goToSurface(user, /Programs/);
    expect(screen.getByTestId("matched-family-resources")).toBeVisible();
  });

  it("brings up the surface a doorway row points at", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    const packetBody = screen.getByTestId("family-visit-packet-body");
    expect(packetBody).not.toBeVisible();

    await user.click(
      within(screen.getByTestId("family-doorways")).getByRole("link", { name: /Visit packet/ })
    );

    await waitFor(() => expect(packetBody).toBeVisible());
    expect(screen.getByRole("button", { name: "Print" })).toBeVisible();
  });

  it("carries no standing demo banner or its disclosure, and still says what it cannot do", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    // Both are gone: the top-of-page badge and the "what this tool can and
    // cannot do" disclosure it sat beside.
    expect(screen.queryByText(/concept demo|not an official service/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText("What this tool can and cannot do")
    ).not.toBeInTheDocument();

    // The honesty they carried is not gone — these lines say it plainly, always
    // visible, without a tap.
    await openComposer(user);
    expect(screen.getByText(/We do not diagnose/i)).toBeVisible();
    expect(screen.getByText(/This demo pretends/i)).toBeVisible();
  });

  it("folds the notes and the packet on their shared surface until they are asked for", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(describedFamily)} />);

    await submitDescription(user);
    await screen.findByTestId("family-heard-strip");
    await goToSurface(user, /Notes/);

    // Two sections share the surface, so each row still says something true
    // about what it is holding.
    const journal = screen.getByTestId("family-journal");
    expect(within(journal).getByText(/1 note ·/)).toBeVisible();
    expect(within(journal).getByText(/Notes stay on this device/i)).not.toBeVisible();
    expect(screen.getByTestId("family-visit-packet-body")).not.toBeVisible();
  });
});

// The redesign's front door: a return visit opens on what changed and what is
// due, never on interview framing, and the composer it replaced is one tap away.
describe("the return front door", { timeout: 20_000 }, () => {
  const returningFamily: FamilyNavigatorState = {
    ...schoolAgeFamilyState,
    profile: { ...schoolAgeFamilyState.profile!, birthYear: 2024, birthMonth: undefined },
    referral: { clinic: "UK Developmental Pediatrics", referredAt: "2026-03-02T12:00:00.000Z" },
    activeDomains: ["early_intervention"],
    interviews: [
      {
        id: "last-visit",
        rawText: "Riley barely talks.",
        source: "typed",
        createdAt: "2026-07-06T12:00:00.000Z",
        extraction: "mock",
        kind: "note"
      }
    ],
    facts: [
      {
        id: "fact-1",
        interviewId: "last-visit",
        label: "About talking",
        value: "Talking and language may need support",
        status: "patient_reported",
        sourceSnippet: "barely talks"
      }
    ]
  };

  it("opens on what changed and what is due, not on the interview", () => {
    render(<ReducerHarness initialState={withFamily(returningFamily)} />);

    expect(screen.getByRole("heading", { name: "Welcome back. Here's what's waiting." })).toBeVisible();
    expect(screen.getByTestId("family-last-note")).toHaveTextContent("Last note: July 6");
    expect(screen.getByTestId("family-wait-chips")).toHaveTextContent("On the list since March");
    // The interview framing is not what a returning caregiver is shown.
    expect(
      screen.queryByText(/Tell us what you have noticed about how your child talks/)
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("family-heard-strip")).not.toBeInTheDocument();
  });

  // P5 on the front door: a birth year gets a window and a repair, not a number.
  it("carries the deadline in the shape the profile supports, with the repair", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(returningFamily)} />);

    const clock = within(screen.getByTestId("family-clock-notice"));
    expect(clock.getByTestId("family-clock-line")).toHaveAttribute("data-clock-kind", "range");
    expect(clock.getByTestId("family-clock-line")).not.toHaveTextContent(/weeks/);

    await user.click(clock.getByTestId("family-clock-add-birth-month"));
    await user.click(screen.getByRole("button", { name: "March" }));

    // One month, and every clock on the page reads a real date.
    await waitFor(() =>
      expect(screen.getByTestId("family-clock-line")).toHaveAttribute("data-clock-kind", "dated")
    );
    expect(familyStateOutput().profile?.birthMonth).toBe(3);
    expect(screen.getByTestId("family-clock-line")).toHaveTextContent(/referrals close January 15, 2027/);
  });

  // P3: the box never vanishes on a return visit — it collapses to one tap, and
  // that tap opens the same crisis-gated composer, not a second writing surface.
  it("keeps one composer, one tap away", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(returningFamily)} />);

    expect(screen.queryByLabelText("What would you like help with?")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("family-composer-open"));

    const box = screen.getByLabelText("What would you like help with?");
    expect(box).toBeVisible();
    expect(box).toHaveFocus();
    // Still exactly one place to write, on every surface.
    expect(screen.getAllByLabelText("What would you like help with?")).toHaveLength(1);
  });

  it("routes the Notes surface's add-a-note to that same box", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(returningFamily)} />);

    await goToSurface(user, /Notes/);
    await user.click(screen.getByTestId("family-notes-add"));

    // It brings the caregiver back to Home rather than opening a second field.
    expect(screen.getByRole("tab", { name: "Home" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByLabelText("What would you like help with?")).toHaveLength(1);
  });
});

// P8: an escape hatch that works, and says what it did.
describe("None of these work", () => {
  const waitlisted: FamilyNavigatorState = {
    ...schoolAgeFamilyState,
    referral: { clinic: "UK Developmental Pediatrics", referredAt: "2026-03-02T12:00:00.000Z" },
    appointments: [createFamilyAppointmentOffer(new Date())]
  };

  it("is a first-class fourth option whose result is said out loud", async () => {
    const user = userEvent.setup();
    render(<ReducerHarness initialState={withFamily(waitlisted)} />);

    await goToSurface(user, /Visit/);
    expect(screen.queryByTestId("family-appt-keep-place")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("family-appt-none-work"));

    expect(screen.getByTestId("family-appt-keep-place")).toHaveTextContent(
      "You keep your place. Saying no to these times changes nothing about your spot on the list."
    );
    // Turning times down is not a decision worth storing, and it does not book.
    const family = familyStateOutput();
    expect(family.appointments[0].status).toBe("offered");
    expect(family.appointments[0].scheduledFor).toBeUndefined();
  });

  // No silent no-ops: a control that cannot act says why, inline.
  it("explains the safety hold instead of just going dim", async () => {
    const user = userEvent.setup();
    render(
      <ReducerHarness
        initialState={withFamily({
          ...waitlisted,
          safetyEvents: [
            { id: "safety-1", tier: "crisis", domain: "self_harm", createdAt: new Date().toISOString() }
          ]
        })}
      />
    );

    await goToSurface(user, /Visit/);
    expect(screen.getByTestId("family-appt-none-work")).toBeDisabled();
    expect(
      within(screen.getByTestId("family-appointment-card")).getByText(/paused while the safety message/i)
    ).toBeVisible();
  });
});
