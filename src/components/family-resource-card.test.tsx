import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFamilyResourceById } from "@/domain/family-resources";
import type { FamilyResourceStep, FamilyStepStatus } from "@/domain/types";
import { FamilyResourceCard } from "./family-resource-card";

const michelle = getFamilyResourceById("michelle_p_waiver")!;

// jsdom ships neither Web Share nor a clipboard, which is also the honest
// baseline: a browser with no way to share must not be told it shared.
function defineNavigator(properties: PropertyDescriptorMap): void {
  Object.defineProperties(navigator, properties);
}

function useShareSheet(): ReturnType<typeof vi.fn> {
  const share = vi.fn().mockResolvedValue(undefined);
  defineNavigator({ share: { value: share, configurable: true, writable: true } });
  return share;
}

function useClipboardOnly(): ReturnType<typeof vi.fn> {
  const writeText = vi.fn().mockResolvedValue(undefined);
  defineNavigator({
    share: { value: undefined, configurable: true, writable: true },
    clipboard: { value: { writeText }, configurable: true, writable: true }
  });
  return writeText;
}

function useNoShareSupport(): void {
  defineNavigator({
    share: { value: undefined, configurable: true, writable: true },
    clipboard: { value: undefined, configurable: true, writable: true }
  });
}

afterEach(() => {
  useNoShareSupport();
});

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

    // The two facts that decide fit are on the face, not behind a disclosure.
    expect(screen.getByTestId("family-resource-fit")).toHaveTextContent(/all ages/i);

    // Provenance lives one tap away behind the "Details and source" disclosure,
    // but every field must still be there in full.
    expect(screen.getByText(michelle.contact)).not.toBeVisible();
    await user.click(screen.getByText("Details and source"));
    const details = screen.getByText("Details and source").parentElement!;
    expect(screen.getByText(michelle.contact)).toBeVisible();
    expect(screen.getByText(michelle.sourceName, { exact: false })).toBeVisible();
    expect(screen.getByText(michelle.verifiedAt, { exact: false })).toBeVisible();
    expect(within(details).getByText(/all ages/i)).toBeVisible();
    expect(within(details).getByText(/start online/i)).toBeVisible();
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
    const share = useShareSheet();
    const onSave = vi.fn();
    const onShare = vi.fn();
    renderCard({ onSave, onShare, childName: "Mateo" });

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
    const shareButton = screen.getByRole("button", { name: /Share.*Michelle P/i });
    expect(shareButton).toBeDisabled();
    await user.click(consent);
    expect(shareButton).toBeEnabled();
    await user.dblClick(shareButton);

    // P6: something actually leaves the phone, and it is exactly the two things
    // the receipt names.
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      title: michelle.name,
      text: michelle.name,
      url: michelle.sourceUrl
    });
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(michelle);
    expect(await screen.findByText(/Sent: the program's name and link\. Nothing about Mateo\./)).toBeVisible();
  });

  it("copies the link when the phone has no share sheet, and says so", async () => {
    const user = userEvent.setup();
    const writeText = useClipboardOnly();
    const onShare = vi.fn();
    renderCard({ onShare, childName: "Mateo" });

    await user.click(screen.getByTestId("family-resource-share-open"));
    await user.click(screen.getByRole("checkbox", { name: /I agree to share/i }));
    await user.click(screen.getByRole("button", { name: /Share.*Michelle P/i }));

    expect(writeText).toHaveBeenCalledWith(`${michelle.name} — ${michelle.sourceUrl}`);
    expect(
      await screen.findByText(/Link copied: the program's name and link\. Nothing about Mateo\./)
    ).toBeVisible();
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("hands the control back when the caregiver backs out of the share sheet", async () => {
    const user = userEvent.setup();
    const share = useShareSheet();
    share.mockRejectedValue(Object.assign(new Error("cancelled"), { name: "AbortError" }));
    const onShare = vi.fn();
    renderCard({ onShare });

    await user.click(screen.getByTestId("family-resource-share-open"));
    await user.click(screen.getByRole("checkbox", { name: /I agree to share/i }));
    await user.click(screen.getByRole("button", { name: /Share.*Michelle P/i }));

    // Backing out is a decision: nothing was shared, nothing was copied behind
    // their back, and the button is still there.
    expect(onShare).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Share.*Michelle P/i })).toBeEnabled();
  });

  // No silent no-ops (P8): a phone that can do neither says which door is left.
  it("says what to do instead when the phone can neither share nor copy", async () => {
    const user = userEvent.setup();
    useNoShareSupport();
    const onShare = vi.fn();
    renderCard({ onShare });

    await user.click(screen.getByTestId("family-resource-share-open"));
    await user.click(screen.getByRole("checkbox", { name: /I agree to share/i }));
    await user.click(screen.getByRole("button", { name: /Share.*Michelle P/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Open the program's official page and share it from there/i
    );
    expect(onShare).not.toHaveBeenCalled();
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

    // The way out to the program is on the answer card, not behind the expand —
    // a family who already knows they want this one should not have to open it.
    const source = screen.getByTestId("family-resource-compact-source");
    expect(source).toBeVisible();
    expect(source).toHaveAttribute("href", firstSteps.sourceUrl);
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noreferrer");
    expect(source).toHaveAccessibleName(`See their official page: ${firstSteps.name}`);

    // P1: the phone number is on the face of a compact card too. The whole point
    // of the redesign is that no variant is allowed to hide it.
    expect(screen.getByTestId("family-resource-call")).toHaveAttribute("href", "tel:8774178377");
    // Service area and age band decide fit, so they stay on the face as well.
    expect(screen.getByTestId("family-resource-fit")).toHaveTextContent(/Available statewide/i);

    // What it defers: the quote, the match reason, save, enroll, details, share.
    expect(screen.queryByTestId("family-resource-quote")).not.toBeInTheDocument();
    expect(screen.getByTestId("family-resource-fit")).not.toHaveTextContent(/Shown for/i);
    expect(screen.queryByRole("button", { name: /Save/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("family-resource-share-open")).not.toBeInTheDocument();
    expect(screen.queryByText("Details and source")).not.toBeInTheDocument();

    const expand = screen.getByTestId("family-resource-expand");
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);

    expect(expand).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("family-resource-quote")).toBeVisible();
    expect(screen.getByTestId("family-resource-fit")).toHaveTextContent(/Shown for/i);
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

  it("makes county-serving and statewide scope visible with the age band and match reason", () => {
    const lklp = getFamilyResourceById("lklp_transportation_region_13")!;
    const { unmount } = renderCard({
      resource: lklp,
      domain: "transportation",
      county: "Breathitt",
      matchNeed: "Transportation"
    });
    expect(screen.getByTestId("family-resource-fit")).toHaveTextContent(
      "Serves Breathitt County · All ages · Shown for Transportation."
    );
    unmount();

    renderCard({ county: "Breathitt", matchNeed: "Waivers and financial support" });
    expect(screen.getByTestId("family-resource-fit")).toHaveTextContent(
      "Available statewide · All ages · Shown for Waivers and financial support."
    );
  });

  // P1 in one line: the audit found "Call 606-886-4417" three taps down, as
  // un-tappable text. It is now the label of the biggest control on the card.
  describe("the face action follows the catalog's referral mode", () => {
    it("dials a call program, with the number as the label and the toll-free line under it", () => {
      const poe = getFamilyResourceById("first_steps_big_sandy")!;
      renderCard({ resource: poe, domain: "early_intervention", county: "Pike" });

      const call = screen.getByTestId("family-resource-call");
      expect(call).toHaveAttribute("href", "tel:6068864417");
      expect(call).toHaveTextContent("Call 606-886-4417");
      expect(call).toHaveAccessibleName(`Call 606-886-4417: ${poe.name}`);
      expect(screen.getByRole("link", { name: /or toll-free 800-230-6011/i })).toHaveAttribute(
        "href",
        "tel:8002306011"
      );
    });

    it("leads a self-serve program with Start online and keeps its help desk tappable", () => {
      renderCard();
      expect(screen.getByTestId("family-resource-start-online")).toHaveAttribute(
        "href",
        michelle.sourceUrl
      );
      expect(screen.getByTestId("family-resource-call")).toHaveAttribute("href", "tel:8447845614");
    });

    it("names the person who makes the connection rather than faking a number", () => {
      const { unmount } = renderCard({
        resource: getFamilyResourceById("scott_county_exceptional_child_services")!,
        domain: "school_iep"
      });
      expect(screen.getByTestId("family-resource-face-school")).toBeVisible();
      unmount();

      renderCard({
        resource: getFamilyResourceById("uk_developmental_pediatrics")!,
        domain: "therapies"
      });
      expect(screen.getByTestId("family-resource-face-provider")).toHaveTextContent(
        "Ask your doctor for a referral"
      );
    });

    it("stands down once the family is already enrolled", () => {
      renderCard({ isEnrolled: true });
      expect(screen.queryByTestId("family-resource-start-online")).not.toBeInTheDocument();
      expect(screen.queryByTestId("family-resource-call")).not.toBeInTheDocument();
    });
  });

  // P7: the words this app inherits from Kentucky's systems get one plain line.
  it("explains the systems words a card actually uses", () => {
    const poe = getFamilyResourceById("first_steps_big_sandy")!;
    renderCard({ resource: poe, domain: "early_intervention" });

    const gloss = screen.getByTestId("family-gloss");
    expect(gloss).toHaveTextContent(/Point of Entry — the local office that takes First Steps referrals/i);
    expect(gloss).toHaveTextContent(/IFSP — the written plan First Steps makes with your family/i);
  });

  it("stays quiet on a card that uses none of them", () => {
    renderCard();
    expect(screen.queryByTestId("family-gloss")).not.toBeInTheDocument();
  });
});
