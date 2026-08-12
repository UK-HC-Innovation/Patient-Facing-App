import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useReducer } from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { brentState } from "@/domain/fixtures";
import { SAMPLE_CAREGIVER_TEXT, schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { AppState, FamilyNavigatorState } from "@/domain/types";
import { loadFamilyDraft } from "@/state/family-draft-storage";
import { healthReducer } from "@/state/store";
import { FamilyExperience } from "@/components/family-experience";

/**
 * F1a's proof, and the reason it lives in its own file: every other Ladder suite
 * does `vi.mock("@/ai/family-interview-provider")`, so a "nothing was sent"
 * assertion inside them would pass whether or not the gate exists — the module
 * that owns `fetch` is not even loaded. Here the real providers run and `fetch`
 * itself is the spy, which is the only place the promise ("nothing is sent
 * unless you turn on the online helper") can actually be checked.
 *
 * Note the shape of the pair below. The silence test alone would be vacuous: it
 * would also pass if the composer never submitted, or if the render died early.
 * The consented test is its control — same interaction, same fixture, one flag
 * different — so a passing pair means the send is gated, not merely absent.
 */
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fetchSpy = vi.fn();

function withFamily(family: FamilyNavigatorState | null): AppState {
  return { ...brentState, family };
}

function Harness({
  consent,
  passcode,
  initialFamily = null
}: {
  consent: "unset" | "granted" | "declined";
  passcode?: string;
  initialFamily?: FamilyNavigatorState | null;
}) {
  const [state, dispatch] = useReducer(healthReducer, withFamily(initialFamily));
  return (
    <>
      <FamilyExperience
        state={state}
        dispatch={dispatch}
        passcode={passcode}
        initialAiConsent={consent}
      />
      <output data-testid="network-audit-events">{JSON.stringify(state.auditEvents)}</output>
      <output data-testid="network-family-state">{JSON.stringify(state.family)}</output>
    </>
  );
}

async function describeTheChild(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const open = screen.queryByTestId("family-composer-open");
  if (open) await user.click(open);
  const box = await screen.findByRole("textbox", { name: /what would you like help with/i });
  // fireEvent rather than user.type: this file is about which requests leave the
  // page, not about keystroke handling, and typing the whole sample character by
  // character is slow enough to make the suite's timing flakier under load.
  fireEvent.change(box, { target: { value: SAMPLE_CAREGIVER_TEXT } });
  await user.click(screen.getByRole("button", { name: /find help/i }));
}

beforeEach(() => {
  fetchSpy.mockReset();
  // Any real call would reach the family routes; answer as an unconfigured
  // deployment so a leak shows up as a spy call rather than a crash.
  fetchSpy.mockResolvedValue({
    ok: true,
    json: async () => ({ mode: "unconfigured", data: null })
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function familyRouteCalls(): string[] {
  return fetchSpy.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/family/"));
}

// Typing the full caregiver sample through userEvent is slow, and slower still
// when the whole suite is running in parallel — the same reason page.test.tsx
// carries a raised timeout.
describe("Ladder network silence", { timeout: 20_000 }, () => {
  it("sends nothing at all when the caregiver has not accepted the online helper", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        consent="unset"
        passcode="demo-passcode"
        initialFamily={schoolAgeFamilyState}
      />
    );

    await describeTheChild(user);

    // The answer still arrives — the on-device extractor carries the whole flow.
    await screen.findByTestId("family-heard-strip");
    expect(familyRouteCalls()).toEqual([]);

    // And the ask is on screen rather than assumed.
    expect(screen.getByTestId("family-ai-consent")).toBeVisible();
  });

  it("sends nothing when the caregiver declines, and says so", async () => {
    const user = userEvent.setup();
    render(<Harness consent="declined" passcode="demo-passcode" />);

    await describeTheChild(user);

    await screen.findByTestId("family-heard-strip");
    expect(familyRouteCalls()).toEqual([]);
    expect(screen.queryByTestId("family-ai-consent")).toBeNull();
    expect(screen.getByTestId("family-ai-declined")).toBeVisible();
  });

  it("sends nothing when the deployment has no passcode, whatever the consent says", async () => {
    const user = userEvent.setup();
    render(<Harness consent="granted" passcode={undefined} />);

    await describeTheChild(user);

    await screen.findByTestId("family-heard-strip");
    expect(familyRouteCalls()).toEqual([]);
  });

  it("does send once the caregiver has accepted — the control that keeps the others honest", async () => {
    const user = userEvent.setup();
    render(<Harness consent="granted" passcode="demo-passcode" />);

    await describeTheChild(user);

    await waitFor(() => expect(familyRouteCalls().length).toBeGreaterThan(0));
    expect(familyRouteCalls().some((url) => url.includes("/api/family/interview"))).toBe(true);
    await waitFor(() =>
      expect(screen.getByTestId("network-audit-events")).toHaveTextContent(
        "family_ai_send_attempted"
      )
    );
    const disclosure = await screen.findByTestId("family-ai-use");
    expect(disclosure).toHaveAttribute("data-ai-use-mode", "online");
    expect(disclosure).toHaveTextContent(/send attempted this session/i);
  });

  it("audits the automatic program-ranking send once, independently of the interview path", async () => {
    const returning: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep"],
      latestInterviewDomains: ["school_iep"],
      resourcePreferences: {
        scope: "local_first",
        contact: "school_or_provider_first"
      },
      interviews: [
        {
          id: "interview-awaiting-ranking",
          rawText: SAMPLE_CAREGIVER_TEXT,
          source: "typed",
          createdAt: "2026-07-01T12:00:00.000Z",
          extraction: "mock",
          kind: "orientation"
        }
      ],
      recommendations: null
    };
    render(
      <Harness
        consent="granted"
        passcode="demo-passcode"
        initialFamily={returning}
      />
    );

    await waitFor(() =>
      expect(familyRouteCalls().filter((url) => url.includes("/api/family/recommend"))).toHaveLength(1)
    );
    await waitFor(() =>
      expect(screen.getByTestId("network-audit-events")).toHaveTextContent(
        "Family program-ranking send attempted through Ladder's online service"
      )
    );
    expect(familyRouteCalls().filter((url) => url.includes("/api/family/interview"))).toEqual([]);
    const requestBodies = fetchSpy.mock.calls.map(([, init]) => String(init?.body ?? ""));
    expect(requestBodies.join(" ")).not.toContain("local_first");
    expect(requestBodies.join(" ")).not.toContain("school_or_provider_first");
  });

  it("keeps a pending program-ranking request single-flight while another draft is typed", async () => {
    const user = userEvent.setup();
    let releaseRecommendation: (() => void) | undefined;
    const pendingRecommendation = new Promise<{
      ok: boolean;
      json: () => Promise<{ mode: "success"; data: null }>;
    }>((resolve) => {
      releaseRecommendation = () =>
        resolve({
          ok: true,
          json: async () => ({ mode: "success", data: null })
        });
    });
    fetchSpy.mockImplementation((input) =>
      String(input).includes("/api/family/recommend")
        ? pendingRecommendation
        : Promise.resolve({
            ok: true,
            json: async () => ({ mode: "unconfigured", data: null })
          })
    );
    const returning: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep"],
      latestInterviewDomains: ["school_iep"],
      interviews: [
        {
          id: "interview-ranking-in-flight",
          rawText: SAMPLE_CAREGIVER_TEXT,
          source: "typed",
          createdAt: "2026-07-01T12:00:00.000Z",
          extraction: "mock",
          kind: "orientation"
        }
      ],
      recommendations: null
    };
    render(
      <Harness
        consent="granted"
        passcode="demo-passcode"
        initialFamily={returning}
      />
    );

    await waitFor(() =>
      expect(familyRouteCalls().filter((url) => url.includes("/api/family/recommend"))).toHaveLength(1)
    );
    await user.click(screen.getByTestId("family-composer-open"));
    const box = screen.getByRole("textbox", { name: /what would you like help with/i });
    fireEvent.change(box, { target: { value: "A new note" } });
    fireEvent.change(box, { target: { value: "A new note with more detail" } });
    await waitFor(() =>
      expect(loadFamilyDraft(brentState.patient.id)).toBe("A new note with more detail")
    );
    expect(familyRouteCalls().filter((url) => url.includes("/api/family/recommend"))).toHaveLength(1);

    await act(async () => releaseRecommendation?.());
    await waitFor(() => {
      const family = JSON.parse(
        screen.getByTestId("network-family-state").textContent ?? "null"
      ) as FamilyNavigatorState;
      expect(family.recommendations?.extraction).toBe("mock");
    });
  });

  it("aborts an in-flight ranking request and prevents later sends when consent is revoked", async () => {
    const user = userEvent.setup();
    fetchSpy.mockImplementation((_input, options?: RequestInit) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })
    );
    const returning: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep"],
      latestInterviewDomains: ["school_iep"],
      interviews: [
        {
          id: "interview-ranking-revoked",
          rawText: SAMPLE_CAREGIVER_TEXT,
          source: "typed",
          createdAt: "2026-07-01T12:00:00.000Z",
          extraction: "mock",
          kind: "orientation"
        }
      ],
      recommendations: null
    };
    render(
      <Harness
        consent="granted"
        passcode="demo-passcode"
        initialFamily={returning}
      />
    );

    await waitFor(() =>
      expect(familyRouteCalls().filter((url) => url.includes("/api/family/recommend"))).toHaveLength(1)
    );
    const requestSignal = (fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined)?.signal;
    await user.click(screen.getByTestId("family-composer-open"));
    await user.click(screen.getByTestId("family-ai-consent-revoke"));

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByTestId("family-ai-declined")).toBeVisible();
    const callsAfterRevoke = familyRouteCalls().length;
    fireEvent.change(screen.getByRole("textbox", { name: /what would you like help with/i }), {
      target: { value: "A new local-only note after revoking consent." }
    });
    await user.click(screen.getByRole("button", { name: /find help/i }));
    await screen.findByTestId("family-heard-strip");
    expect(familyRouteCalls()).toHaveLength(callsAfterRevoke);
  });

  it("keeps a safety-derived rerank on device after the banner is acknowledged", async () => {
    const user = userEvent.setup();
    const returning: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep"],
      latestInterviewDomains: ["school_iep"],
      interviews: [
        {
          id: "interview-before-safety",
          rawText: SAMPLE_CAREGIVER_TEXT,
          source: "typed",
          createdAt: "2026-07-01T12:00:00.000Z",
          extraction: "mock",
          kind: "orientation"
        }
      ],
      recommendations: null,
      safetyEvents: [
        {
          id: "safety-awaiting-ack",
          tier: "crisis",
          domain: "self_harm",
          createdAt: "2026-08-08T12:00:00.000Z"
        }
      ]
    };
    render(
      <Harness
        consent="granted"
        passcode="demo-passcode"
        initialFamily={returning}
      />
    );

    const banner = await screen.findByTestId("family-crisis-banner");
    await user.click(screen.getByRole("button", { name: /I understand — return to Ladder/i }));

    // Wait for the post-ack ranking effect to finish. This makes the silence
    // assertion non-vacuous: deleting the safety-history guard produces a
    // /recommend request before the same fallback appears.
    await waitFor(() => {
      const family = JSON.parse(screen.getByTestId("network-family-state").textContent ?? "null") as FamilyNavigatorState;
      expect(family.safetyEvents[0]?.acknowledgedAt).toEqual(expect.any(String));
      expect(family.recommendations?.extraction).toBe("mock");
    });
    expect(banner).not.toBeInTheDocument();
    expect(familyRouteCalls()).toEqual([]);
    expect(screen.getByTestId("network-audit-events")).not.toHaveTextContent(
      "Family program-ranking send attempted"
    );
  });

  it("keeps the inline disclosure scoped to this session instead of inherited live history", async () => {
    const user = userEvent.setup();
    const returning: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep"],
      latestInterviewDomains: ["school_iep"],
      interviews: [
        {
          id: "prior-live-interview",
          rawText: SAMPLE_CAREGIVER_TEXT,
          source: "typed",
          createdAt: "2026-07-01T12:00:00.000Z",
          extraction: "live",
          kind: "orientation"
        }
      ],
      recommendations: null
    };
    render(
      <Harness
        consent="unset"
        passcode="demo-passcode"
        initialFamily={returning}
      />
    );

    await describeTheChild(user);

    const disclosure = await screen.findByTestId("family-ai-use");
    expect(disclosure).toHaveAttribute("data-ai-use-mode", "on_device");
    expect(disclosure).toHaveTextContent(/this session/i);
    expect(familyRouteCalls()).toEqual([]);
  });

  it("keeps a returning family's stored narrative off the ranking route on mount", async () => {
    // The recommend call is an effect, not a submit handler: a returning visitor
    // with a stored interview and no stored ranking used to POST on page load,
    // with no action of their own and no chance to be asked.
    // The fixture alone is not enough, and this test used to prove nothing
    // because of it: schoolAgeFamilyState carries no interviews and no active
    // domains, so the ranking effect dies at its first guard and never reaches
    // the gate. A mutation test confirmed it — deleting the entire gate left the
    // whole suite green. The state below is the one that actually reaches it.
    const returning: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      activeDomains: ["school_iep"],
      latestInterviewDomains: ["school_iep"],
      interviews: [
        {
          id: "interview-returning",
          rawText: SAMPLE_CAREGIVER_TEXT,
          source: "typed",
          createdAt: "2026-07-01T12:00:00.000Z",
          extraction: "mock",
          kind: "orientation"
        }
      ],
      recommendations: null
    };
    render(
      <FamilyExperience
        state={withFamily(returning)}
        dispatch={vi.fn()}
        passcode="demo-passcode"
        initialAiConsent="unset"
      />
    );

    await screen.findByTestId("ladder-tabs");
    await waitFor(() => expect(familyRouteCalls()).toEqual([]));
  });
});
