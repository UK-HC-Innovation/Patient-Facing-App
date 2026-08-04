import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { getFamilyResourceById } from "@/domain/family-resources";
import type { FamilyResourceStep, FamilyStepStatus } from "@/domain/types";
import { FamilyResourceCard } from "./family-resource-card";

const michelle = getFamilyResourceById("michelle_p_waiver")!;

function step(status: FamilyStepStatus, updatedAt = "2026-07-17T12:00:00.000Z"): FamilyResourceStep {
  return {
    id: "step-1",
    resourceId: michelle.id,
    domain: "waivers_financial",
    status,
    plannedAt: "2026-06-02T12:00:00.000Z",
    updatedAt
  };
}

function renderCard(overrides: Partial<React.ComponentProps<typeof FamilyResourceCard>> = {}) {
  const props: React.ComponentProps<typeof FamilyResourceCard> = {
    resource: michelle,
    domain: "waivers_financial",
    language: "en",
    isSaved: false,
    isEnrolled: false,
    onSave: vi.fn(),
    onShare: vi.fn(),
    onToggleEnrollment: vi.fn(),
    ...overrides
  };
  return { ...render(<FamilyResourceCard {...props} />), props };
}

describe("FamilyResourceCard", () => {
  it("renders all catalog provenance, contact, referral, age, and urgency fields", async () => {
    const user = userEvent.setup();
    renderCard();

    // First-read content is visible without any interaction.
    expect(screen.getByRole("heading", { name: michelle.name })).toBeVisible();
    expect(screen.getByText(michelle.summary)).toBeVisible();
    expect(screen.getByText(michelle.actNow!)).toBeVisible();

    // Provenance lives one tap away behind the "Details and source" disclosure,
    // but every field must still be there in full.
    expect(screen.getByText(michelle.contact)).not.toBeVisible();
    await user.click(screen.getByText("Details and source"));
    expect(screen.getByText(michelle.contact)).toBeVisible();
    expect(screen.getByText(michelle.sourceName, { exact: false })).toBeVisible();
    expect(screen.getByText(michelle.verifiedAt, { exact: false })).toBeVisible();
    expect(screen.getByText(/all ages/i)).toBeVisible();
    expect(screen.getByText(/start online/i)).toBeVisible();
    const sourceLink = screen.getByRole("link", { name: /See their official page.*Michelle P/i });
    expect(sourceLink).toHaveAttribute("href", michelle.sourceUrl);
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveAttribute("rel", "noreferrer");
  });

  it("keeps Spanish provenance and its official source reachable from the details disclosure", async () => {
    const user = userEvent.setup();
    renderCard({ language: "es" });

    // Characterization mutation: moving source data outside this disclosure, or
    // dropping the localized control, would make trust information unreachable.
    await user.click(screen.getByText("Detalles y fuente"));
    expect(screen.getByText(michelle.contact)).toBeVisible();
    expect(screen.getByText(michelle.sourceName, { exact: false })).toBeVisible();
    expect(screen.getByText(michelle.verifiedAt, { exact: false })).toBeVisible();
    expect(screen.getByRole("link", { name: /Ver su página oficial.*Michelle P/i })).toHaveAttribute(
      "href",
      michelle.sourceUrl
    );
  });

  it("suppresses urgency for enrolled resources and exposes an aria-pressed enrollment toggle", async () => {
    const user = userEvent.setup();
    const onToggleEnrollment = vi.fn();
    renderCard({ isEnrolled: true, onToggleEnrollment });

    expect(screen.getByText("You already have this")).toBeVisible();
    expect(screen.queryByText(michelle.actNow!)).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /We do not have this.*Michelle P/i });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(onToggleEnrollment).toHaveBeenCalledWith(michelle.id);
  });

  it("saves idempotently and shares once only after per-card consent", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onShare = vi.fn();
    renderCard({ onSave, onShare });

    const save = screen.getByRole("button", { name: /Save.*Michelle P/i });
    await user.dblClick(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(michelle, "waivers_financial");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");

    // Two taps, one consent: the consent question does not occupy the card until
    // someone asks to share, and asking is not itself consenting.
    expect(
      screen.queryByRole("checkbox", { name: /I agree to share this resource now/i })
    ).not.toBeInTheDocument();
    await user.click(screen.getByTestId("family-resource-share-open"));
    expect(onShare).not.toHaveBeenCalled();

    const consent = screen.getByRole("checkbox", {
      name: /I agree to share this resource now.*Michelle P/i
    });
    expect(consent).toHaveFocus();
    const share = screen.getByRole("button", { name: /Share.*Michelle P/i });
    expect(share).toBeDisabled();
    await user.click(consent);
    expect(share).toBeEnabled();
    await user.dblClick(share);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(michelle);
    expect(screen.getByRole("status")).toHaveTextContent("Share recorded with your consent.");
  });

  it("cannot be made to share without consent by any order of taps", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    renderCard({ onShare });

    // Open, close by ticking and un-ticking, re-open — the guard is in share()
    // itself, so no sequence that leaves the box unchecked can get a share out.
    await user.click(screen.getByTestId("family-resource-share-open"));
    const consent = screen.getByRole("checkbox", { name: /I agree to share/i });
    await user.click(consent);
    await user.click(consent);
    expect(consent).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: /Share.*Michelle P/i }));
    expect(onShare).not.toHaveBeenCalled();
  });

  it("does not announce a persisted saved state as though it were a current action", () => {
    renderCard({ isSaved: true });

    expect(screen.getByRole("button", { name: /Saved.*Michelle P/i })).toBeDisabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("uses unique consent controls when the same resource appears in matched and saved sections", async () => {
    const user = userEvent.setup();
    render(
      <>
        <FamilyResourceCard
          resource={michelle}
          domain="waivers_financial"
          language="en"
          isSaved={false}
          isEnrolled={false}
          onSave={vi.fn()}
          onShare={vi.fn()}
          onToggleEnrollment={vi.fn()}
        />
        <FamilyResourceCard
          resource={michelle}
          domain="waivers_financial"
          language="en"
          isSaved
          isEnrolled={false}
          onSave={vi.fn()}
          onShare={vi.fn()}
          onToggleEnrollment={vi.fn()}
        />
      </>
    );

    for (const open of screen.getAllByTestId("family-resource-share-open")) {
      await user.click(open);
    }
    const checkboxes = screen.getAllByRole("checkbox", { name: /I agree to share this resource now.*Michelle P/i });
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].id).not.toBe(checkboxes[1].id);
    expect(within(checkboxes[0].closest("article")!).getByRole("button", { name: /Share.*Michelle P/i })).toBeDisabled();
  });

  it("offers the commit CTA only until a step exists, then shows that step's status and month", () => {
    const { unmount } = renderCard({ onPlanStep: vi.fn() });
    expect(screen.getByRole("button", { name: /I'll do this.*Michelle P/i })).toBeVisible();
    expect(screen.queryByTestId("family-step-status")).not.toBeInTheDocument();
    unmount();

    renderCard({ step: step("in_touch"), onPlanStep: vi.fn() });
    expect(screen.queryByRole("button", { name: /I'll do this/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("family-step-status")).toHaveTextContent("In touch · July 2026");
  });

  it("dispatches the plan with the resource and the domain it was matched under", async () => {
    const user = userEvent.setup();
    const onPlanStep = vi.fn();
    renderCard({ onPlanStep });

    await user.click(screen.getByRole("button", { name: /I'll do this.*Michelle P/i }));

    expect(onPlanStep).toHaveBeenCalledTimes(1);
    expect(onPlanStep).toHaveBeenCalledWith(michelle, "waivers_financial");
  });

  it("renders a line for every tracked status, in Spanish too", () => {
    const expected: Array<[FamilyStepStatus, string]> = [
      ["planned", "Planned"],
      ["tried", "Tried"],
      ["in_touch", "In touch"],
      ["enrolled", "Enrolled"],
      ["not_for_us", "Not for us"]
    ];
    for (const [status, label] of expected) {
      const { unmount } = renderCard({ step: step(status) });
      expect(screen.getByTestId("family-step-status")).toHaveTextContent(label);
      unmount();
    }

    renderCard({ step: step("enrolled"), language: "es" });
    expect(screen.getByTestId("family-step-status")).toHaveTextContent("Inscrito");
  });

  it("hides the commit CTA when no planner is wired up", () => {
    renderCard();
    expect(screen.queryByRole("button", { name: /I'll do this/i })).not.toBeInTheDocument();
  });

  it("renders the deadline clock line only when one is supplied", () => {
    renderCard();
    expect(screen.queryByTestId("family-resource-clock")).not.toBeInTheDocument();

    const firstSteps = getFamilyResourceById("first_steps_statewide")!;
    renderCard({
      resource: firstSteps,
      domain: "early_intervention",
      clockLine: "About 4 weeks left to start First Steps."
    });
    expect(screen.getByTestId("family-resource-clock")).toHaveTextContent(
      "About 4 weeks left to start First Steps."
    );
  });

  it("shows the manual-verification warning when the catalog requires it", () => {
    const stable = getFamilyResourceById("stable_kentucky")!;
    renderCard({ resource: stable, domain: "future_planning" });
    expect(screen.getByText(/Call and check before you count on this/i)).toBeVisible();
  });

  it("keeps a compact card to one sentence and its dated line, and expands in place", async () => {
    const user = userEvent.setup();
    const firstSteps = getFamilyResourceById("first_steps_statewide")!;
    renderCard({
      resource: firstSteps,
      domain: "early_intervention",
      variant: "compact",
      why: "This is the statewide door into early intervention.",
      becauseYouSaid: "he only strings a couple of words together",
      clockLine: "About 4 weeks left to start First Steps.",
      county: "Scott",
      matchNeed: "Early intervention",
      onPlanStep: vi.fn()
    });

    // What a compact card shows: name, one sentence, the dated line, the commit
    // CTA. The catalog summary never doubles the "why" line.
    expect(screen.getByRole("heading", { name: firstSteps.name })).toBeVisible();
    expect(screen.getByTestId("family-resource-why")).toBeVisible();
    expect(screen.queryByText(firstSteps.summary)).not.toBeInTheDocument();
    expect(screen.getByTestId("family-resource-clock")).toBeVisible();
    expect(screen.getByRole("button", { name: /I'll do this/i })).toBeVisible();

    // What it defers: the quote, the locality line, save, enroll, details, share.
    expect(screen.queryByTestId("family-resource-quote")).not.toBeInTheDocument();
    expect(screen.queryByTestId("family-resource-locality")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("family-resource-share-open")).not.toBeInTheDocument();
    expect(screen.queryByText("Details and source")).not.toBeInTheDocument();

    const expand = screen.getByTestId("family-resource-expand");
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);

    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("family-resource-quote")).toBeVisible();
    expect(screen.getByTestId("family-resource-locality")).toBeVisible();
    expect(screen.getByTestId("family-resource-share-open")).toBeVisible();
    expect(screen.getByText("Details and source")).toBeVisible();

    await user.click(screen.getByTestId("family-resource-expand"));
    expect(screen.queryByTestId("family-resource-quote")).not.toBeInTheDocument();
  });

  it("shows one description: a grounded why line sends the catalog summary to details", async () => {
    const user = userEvent.setup();
    const { unmount } = renderCard({ why: "Waiver money can pay for respite hours." });

    expect(screen.getByTestId("family-resource-why")).toBeVisible();
    expect(screen.getByText(michelle.summary)).not.toBeVisible();
    await user.click(screen.getByText("Details and source"));
    expect(screen.getByText("About this program")).toBeVisible();
    expect(screen.getByText(michelle.summary)).toBeVisible();
    unmount();

    // With no why line, the summary is the only description and stays in the body.
    renderCard();
    expect(screen.getByText(michelle.summary)).toBeVisible();
    expect(screen.queryByText("About this program")).not.toBeInTheDocument();
  });

  it("shows one dated block: a clock line sends the act-now paragraph to details", async () => {
    const user = userEvent.setup();
    const firstSteps = getFamilyResourceById("first_steps_statewide")!;
    renderCard({
      resource: firstSteps,
      domain: "early_intervention",
      clockLine: "About 4 weeks left to start First Steps."
    });

    expect(screen.getByTestId("family-resource-clock")).toBeVisible();
    expect(screen.getByText(firstSteps.actNow!)).not.toBeVisible();
    await user.click(screen.getByText("Details and source"));
    expect(screen.getByText(firstSteps.actNow!)).toBeVisible();
  });

  it("makes county-serving and statewide scope visible with the match reason", () => {
    const lklp = getFamilyResourceById("lklp_transportation_region_13")!;
    const { unmount } = renderCard({
      resource: lklp,
      domain: "transportation",
      county: "Breathitt",
      matchNeed: "Transportation"
    });
    expect(screen.getByTestId("family-resource-locality")).toHaveTextContent(
      "Serves Breathitt County · Shown for Transportation."
    );
    unmount();

    renderCard({ county: "Breathitt", matchNeed: "Waivers and financial support" });
    expect(screen.getByTestId("family-resource-locality")).toHaveTextContent(
      "Available statewide · Shown for Waivers and financial support."
    );
  });
});
