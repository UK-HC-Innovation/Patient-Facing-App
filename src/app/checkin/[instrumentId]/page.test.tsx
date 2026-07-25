import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import type { AppState } from "@/domain/types";
import InstrumentPage from "./page";

const { route, context } = vi.hoisted(() => ({
  route: { instrumentId: "phq9" },
  context: { state: {} as AppState, dispatch: vi.fn() }
}));

vi.mock("next/navigation", () => ({ useParams: () => route }));
vi.mock("@/state/store", () => ({ useHealthState: () => context }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  )
}));

describe("dynamic instrument route", () => {
  beforeEach(() => {
    route.instrumentId = "phq9";
    context.state = demoState;
    context.dispatch.mockReset();
  });

  it("loads a known instrument through the generic runner", () => {
    render(<InstrumentPage />);
    expect(screen.getByRole("heading", { name: "PHQ-9 mood check-in" })).toBeVisible();
    expect(screen.getByRole("button", { name: /start the check-in/i })).toBeVisible();
  });

  it("renders a bilingual-safe unavailable state for an unknown id", () => {
    route.instrumentId = "not-real";
    render(<InstrumentPage />);
    expect(screen.getByText("This check-in is not available.")).toBeVisible();
  });

  it("prefills current tobacco history so the lung route shows four questions and stores all six positions", async () => {
    const user = userEvent.setup();
    route.instrumentId = "lung_ldct_eligibility";
    context.state = {
      ...demoState,
      assessmentEvents: [
        {
          id: "tobacco-current",
          patientId: demoState.patient.id,
          instrumentId: "tobacco_use",
          itemResponses: [2, -1],
          totalScore: 2,
          severityBand: "current",
          status: "patient_reported",
          recordedAt: "2026-07-20T12:00:00.000Z"
        }
      ]
    };

    render(<InstrumentPage />);
    await user.click(screen.getByRole("button", { name: "I understand — start" }));

    expect(screen.queryByText("Do you currently smoke cigarettes, or did you smoke cigarettes in the past?")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "How many full months ago did you quit smoking?" })).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "How old are you?" })).toBeVisible();
    expect(screen.getByRole("spinbutton", { name: /how many packs/i })).toBeVisible();
    expect(screen.getByRole("spinbutton", { name: /For how many years/i })).toBeVisible();
    expect(screen.getByText("Have you coughed up blood or lost weight without trying?")).toBeVisible();

    await user.type(screen.getByRole("spinbutton", { name: "How old are you?" }), "60");
    await user.type(screen.getByRole("spinbutton", { name: /how many packs/i }), "1");
    await user.type(screen.getByRole("spinbutton", { name: /For how many years/i }), "20");
    await user.click(screen.getByRole("radio", { name: "No" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(context.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: "addAssessmentEvent",
      event: expect.objectContaining({
        instrumentId: "lung_ldct_eligibility",
        itemResponses: [1, 60, 1, 20, -1, 0],
        totalScore: 20,
        severityBand: "eligible"
      })
    })));
  });

  it("age-gates SWYC composites, blocks direct POSI, and uses caregiver framing", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const birth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 18, 1));
    context.state = {
      ...demoState,
      family: {
        profile: {
          childFirstName: "Avery",
          birthYear: birth.getUTCFullYear(),
          birthMonth: birth.getUTCMonth() + 1,
          schoolStage: "not_school_age",
          county: "Fayette",
          diagnoses: []
        },
        referral: null,
        appointments: [],
        safetyEvents: [],
        recommendations: null,
        interviewDraft: "",
        screenAnswers: [],
        interviews: [],
        facts: [],
        latestInterviewDomains: [],
        activeDomains: [],
        saved: [],
        alreadyEnrolled: [],
        steps: [],
        pulses: [],
        flags: [],
        soonerList: null,
        packetQuestionIds: [],
        checkinTouchedAt: null
      }
    };
    route.instrumentId = "swyc_18mo";
    const { unmount } = render(<InstrumentPage />);
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.getByText("Answer about Avery.")).toBeVisible();
    expect(screen.getByText(/Draft wording/i)).toBeVisible();
    expect(screen.getByText(/Demo preview/i)).toBeVisible();
    unmount();

    route.instrumentId = "swyc_posi";
    render(<InstrumentPage />);
    expect(screen.getByText("This check-in is not available.")).toBeVisible();
  });

  it("uses caregiver framing for PSC-17 and teen handoff framing for PHQ-A", async () => {
    const user = userEvent.setup();
    const now = new Date();
    const birth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 132, 1));
    context.state = {
      ...demoState,
      family: {
        profile: {
          childFirstName: "Avery",
          birthYear: birth.getUTCFullYear(),
          birthMonth: birth.getUTCMonth() + 1,
          schoolStage: "middle",
          county: "Fayette",
          diagnoses: []
        },
        referral: null,
        appointments: [],
        safetyEvents: [],
        recommendations: null,
        interviewDraft: "",
        screenAnswers: [],
        interviews: [],
        facts: [],
        latestInterviewDomains: [],
        activeDomains: [],
        saved: [],
        alreadyEnrolled: [],
        steps: [],
        pulses: [],
        flags: [],
        soonerList: null,
        packetQuestionIds: [],
        checkinTouchedAt: null
      }
    };

    route.instrumentId = "psc17";
    const { unmount } = render(<InstrumentPage />);
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.getByText("Answer about Avery.")).toBeVisible();
    unmount();

    route.instrumentId = "phq_a";
    render(<InstrumentPage />);
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(screen.getByText(/Hand the device to Avery.*teen to answer themselves/i)).toBeVisible();
  });

  it("makes family routes unavailable with no family profile or outside the locked age band", () => {
    route.instrumentId = "psc17";
    context.state = { ...demoState, family: null };
    const { unmount } = render(<InstrumentPage />);
    expect(screen.getByText("This check-in is not available.")).toBeVisible();
    unmount();

    context.state = {
      ...demoState,
      family: {
        profile: {
          birthYear: new Date().getUTCFullYear(),
          birthMonth: new Date().getUTCMonth() + 1,
          schoolStage: "not_school_age",
          county: "Fayette",
          diagnoses: []
        },
        referral: null,
        appointments: [],
        safetyEvents: [],
        recommendations: null,
        interviewDraft: "",
        screenAnswers: [],
        interviews: [],
        facts: [],
        latestInterviewDomains: [],
        activeDomains: [],
        saved: [],
        alreadyEnrolled: [],
        steps: [],
        pulses: [],
        flags: [],
        soonerList: null,
        packetQuestionIds: [],
        checkinTouchedAt: null
      }
    };
    render(<InstrumentPage />);
    expect(screen.getByText("This check-in is not available.")).toBeVisible();
  });
});
