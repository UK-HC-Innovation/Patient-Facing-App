import { render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoState } from "@/domain/fixtures";
import { DDS2_INSTRUMENT } from "@/domain/instruments/dds2";
import { NIDA_SINGLE_INSTRUMENT } from "@/domain/instruments/nida-single";
import type { AppState } from "@/domain/types";
import CheckinPage from "./page";

const { context } = vi.hoisted(() => ({ context: { state: {} as AppState, dispatch: vi.fn() } }));

vi.mock("@/state/store", () => ({ useHealthState: () => context }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  )
}));

describe("screening hub", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00.000Z"));
    context.state = demoState;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows due instruments, the live quick check, and empty history in English", () => {
    render(<CheckinPage />);

    expect(screen.getByRole("heading", { name: "Screening hub" })).toBeVisible();
    const due = screen.getByRole("region", { name: "Due now" });
    expect(within(due).getByRole("link", { name: /PHQ-9 mood check-in/i })).toHaveAttribute("href", "/checkin/phq9");
    expect(screen.getByRole("heading", { name: "Quick check" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Start the 2-minute check/i })).toHaveAttribute("href", "/checkin/quick");
    expect(screen.getByRole("heading", { name: "Quick check" }).closest("section")).toHaveTextContent("Demo preview");
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "History" })).toHaveTextContent("No completed check-ins yet.");
    expect(screen.queryByRole("link", { name: "Ladder — family support" })).not.toBeInTheDocument();
  });

  it("localizes the hub, conditionally shows family support, and orders history newest first", () => {
    context.state = {
      ...demoState,
      patient: { ...demoState.patient, language: "es" },
      family: {
        profile: null,
        profileProvenance: "stated",
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
      },
      assessmentEvents: [
        {
          id: "older",
          patientId: demoState.patient.id,
          instrumentId: "phq9",
          itemResponses: Array(9).fill(0),
          totalScore: 0,
          severityBand: "minimal",
          status: "patient_reported",
          recordedAt: "2026-06-01T12:00:00.000Z"
        },
        {
          id: "newer",
          patientId: demoState.patient.id,
          instrumentId: "phq9",
          itemResponses: Array(9).fill(2),
          totalScore: 18,
          severityBand: "moderately_severe",
          status: "patient_reported",
          recordedAt: "2026-07-01T12:00:00.000Z"
        }
      ]
    };

    render(<CheckinPage />);

    expect(screen.getByRole("heading", { name: "Centro de chequeos" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Ladder — apoyo familiar" })).toHaveAttribute("href", "/ladder");
    const history = screen.getByRole("region", { name: "Historial" });
    const entries = within(history).getAllByRole("listitem");
    const dates = within(history).getAllByText(/2026/).map((element) => element.getAttribute("dateTime"));
    expect(dates).toEqual(["2026-07-01T12:00:00.000Z", "2026-06-01T12:00:00.000Z"]);
    expect(entries[0]).toHaveTextContent(
      "Tus respuestas sugieren un nivel bastante alto de señales esta semana. Este es un autochequeo, no un diagnóstico. Compartirlo con tu equipo de salud puede ayudar."
    );
    expect(entries[1]).toHaveTextContent(
      "Tus respuestas sugieren pocas o ninguna señal esta semana. Este es un autochequeo, no un diagnóstico. Compartirlo con tu equipo de salud puede ayudar."
    );
    expect(history).not.toHaveTextContent(/moderately severe|moderately_severe|minimal/);
  });

  it("uses a generic localized history fallback instead of exposing impossible registry keys", () => {
    context.state = {
      ...demoState,
      assessmentEvents: [
        {
          id: "unknown-history-row",
          patientId: demoState.patient.id,
          instrumentId: "unknown_instrument",
          itemResponses: [0],
          totalScore: 0,
          severityBand: "private_raw_key",
          status: "patient_reported",
          recordedAt: "2026-07-01T12:00:00.000Z"
        }
      ]
    };

    render(<CheckinPage />);

    const history = screen.getByRole("region", { name: "History" });
    expect(history).toHaveTextContent("Result details unavailable.");
    expect(history).not.toHaveTextContent("private_raw_key");
  });

  it("shows eligible recurring adult modules once in Due now and excludes them from Worth checking", () => {
    render(<CheckinPage />);

    const due = screen.getByRole("region", { name: "Due now" });
    const worthChecking = screen.getByRole("region", { name: "Worth checking" });
    expect(within(due).getByRole("link", { name: /Colorectal screening check/i })).toHaveAttribute("href", "/checkin/crc_eligibility");
    expect(within(due).getByRole("link", { name: /Prediabetes risk test/i })).toHaveAttribute("href", "/checkin/prediabetes_risk");
    expect(within(due).getByRole("link", { name: /AUDIT-C alcohol check/i })).toHaveAttribute("href", "/checkin/audit_c");
    expect(within(due).getByRole("link", { name: /Diabetes Distress Scale/i })).toHaveAttribute("href", "/checkin/dds2");
    expect(within(worthChecking).queryByRole("link", { name: /Lung screening eligibility/i })).not.toBeInTheDocument();
    expect(within(worthChecking).queryByRole("link", { name: /STEADI falls check/i })).not.toBeInTheDocument();
    expect(within(worthChecking).queryByRole("link")).not.toBeInTheDocument();
  });

  it.each(["current", "former"] as const)("shows lung screening when the latest tobacco history is %s", (severityBand) => {
    context.state = {
      ...demoState,
      assessmentEvents: [
        {
          id: `tobacco-${severityBand}`,
          patientId: demoState.patient.id,
          instrumentId: "tobacco_use",
          itemResponses: severityBand === "current" ? [2, -1] : [0, 1],
          totalScore: severityBand === "current" ? 2 : 0,
          severityBand,
          status: "patient_reported",
          recordedAt: "2026-07-20T12:00:00.000Z"
        }
      ]
    };

    render(<CheckinPage />);

    const due = screen.getByRole("region", { name: "Due now" });
    expect(within(due).getByRole("link", { name: /Lung screening eligibility/i })).toHaveAttribute("href", "/checkin/lung_ldct_eligibility");
    expect(within(screen.getByRole("region", { name: "Worth checking" })).queryByRole("link", { name: /Lung screening eligibility/i })).not.toBeInTheDocument();
  });

  it("uses only the latest tobacco history when deciding whether to show lung screening", () => {
    context.state = {
      ...demoState,
      assessmentEvents: [
        {
          id: "tobacco-former",
          patientId: demoState.patient.id,
          instrumentId: "tobacco_use",
          itemResponses: [0, 1],
          totalScore: 0,
          severityBand: "former",
          status: "patient_reported",
          recordedAt: "2026-07-01T12:00:00.000Z"
        },
        {
          id: "tobacco-never",
          patientId: demoState.patient.id,
          instrumentId: "tobacco_use",
          itemResponses: [0, 0],
          totalScore: 0,
          severityBand: "never",
          status: "patient_reported",
          recordedAt: "2026-07-20T12:00:00.000Z"
        }
      ]
    };

    render(<CheckinPage />);

    expect(screen.queryByRole("link", { name: /Lung screening eligibility/i })).not.toBeInTheDocument();
  });

  it("shows STEADI only after an age-bearing screening records age 65 or older", () => {
    context.state = {
      ...demoState,
      assessmentEvents: [
        {
          id: "crc-age-65",
          patientId: demoState.patient.id,
          instrumentId: "crc_eligibility",
          itemResponses: [65, 0, 0, 0, 0, 0],
          totalScore: 0,
          severityBand: "due",
          status: "patient_reported",
          recordedAt: "2026-07-20T12:00:00.000Z"
        }
      ]
    };
    const { unmount } = render(<CheckinPage />);
    expect(screen.getByRole("link", { name: /STEADI falls check/i })).toHaveAttribute("href", "/checkin/steadi3");
    unmount();

    context.state = {
      ...context.state,
      assessmentEvents: [{ ...context.state.assessmentEvents[0], id: "crc-age-64", itemResponses: [64, 0, 0, 0, 0, 0] }]
    };
    render(<CheckinPage />);
    expect(screen.queryByRole("link", { name: /STEADI falls check/i })).not.toBeInTheDocument();
  });

  it("moves a fresh eligible tier-2 instrument to Worth checking", () => {
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
          recordedAt: "2026-07-19T12:00:00.000Z"
        },
        {
          id: "lung-fresh",
          patientId: demoState.patient.id,
          instrumentId: "lung_ldct_eligibility",
          itemResponses: [1, 62, 1.5, 20, -1, 0],
          totalScore: 30,
          severityBand: "eligible",
          status: "patient_reported",
          recordedAt: "2026-07-19T12:00:00.000Z"
        }
      ]
    };

    render(<CheckinPage />);

    const due = screen.getByRole("region", { name: "Due now" });
    const worthChecking = screen.getByRole("region", { name: "Worth checking" });
    expect(within(due).queryByRole("link", { name: /Lung screening eligibility/i })).not.toBeInTheDocument();
    expect(within(worthChecking).getByRole("link", { name: /Lung screening eligibility/i })).toHaveAttribute(
      "href",
      "/checkin/lung_ldct_eligibility"
    );
  });

  it("uses the dedicated Quick card for a due all-clear-license battery without duplicating it in Due now", () => {
    const original = NIDA_SINGLE_INSTRUMENT.licenseStatus;
    NIDA_SINGLE_INSTRUMENT.licenseStatus = "clear";
    try {
      context.state = {
        ...demoState,
        assessmentEvents: ["phq9", "crc_eligibility", "prediabetes_risk", "audit_c", "dds2"].map(
          (instrumentId, index) => ({
            id: `fresh-${index}`,
            patientId: demoState.patient.id,
            instrumentId,
            itemResponses: [0],
            totalScore: 0,
            severityBand: "negative",
            status: "patient_reported" as const,
            recordedAt: "2026-07-19T12:00:00.000Z"
          })
        )
      };
      render(<CheckinPage />);
      const due = screen.getByRole("region", { name: "Due now" });
      expect(within(due).queryByRole("link", { name: /Quick check|2-minute/i })).not.toBeInTheDocument();
      expect(due).toHaveTextContent("Quick check is due below.");
      expect(due).not.toHaveTextContent("You're up to date.");
      expect(screen.getByRole("link", { name: /Start the 2-minute check/i })).toHaveAttribute("href", "/checkin/quick");
      const quick = screen.getByRole("heading", { name: "Quick check" }).closest("section");
      expect(quick).toHaveTextContent("Due now");
      expect(quick).not.toHaveTextContent("Demo preview");
    } finally {
      NIDA_SINGLE_INSTRUMENT.licenseStatus = original;
    }
  });

  it("localizes Worth checking and excludes a module while its license is pending", () => {
    const originalLicense = DDS2_INSTRUMENT.licenseStatus;
    DDS2_INSTRUMENT.licenseStatus = "pending";
    context.state = { ...demoState, patient: { ...demoState.patient, language: "es" } };
    try {
      render(<CheckinPage />);
      const due = screen.getByRole("region", { name: /Para hacer ahora/i });
      expect(within(due).queryByRole("link", { name: /angustia por diabetes/i })).not.toBeInTheDocument();
    } finally {
      DDS2_INSTRUMENT.licenseStatus = originalLicense;
    }
  });

  it("lists only age-appropriate family entries, labels SWYC preview, and excludes pending instruments from Due now", () => {
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
        profileProvenance: "stated",
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

    const { unmount } = render(<CheckinPage />);

    const family = screen.getByRole("region", { name: "For your family" });
    expect(family).toHaveAttribute("id", "for-family");
    expect(within(family).getByRole("link", { name: /18-month development and social check/i })).toHaveAttribute(
      "href",
      "/checkin/swyc_18mo"
    );
    expect(within(family).getByText("Demo preview")).toBeVisible();
    expect(within(family).queryByRole("link", { name: /PSC-17|teen/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Due now" }).closest("section")).not.toHaveTextContent(/SWYC|development/i);
    unmount();

    context.state = { ...context.state, patient: { ...context.state.patient, language: "es" } };
    render(<CheckinPage />);
    expect(screen.getByRole("region", { name: "Para tu familia" })).toHaveTextContent(
      "Vista previa de demostración"
    );
  });

  it("shows PSC-17 and PHQ-A together at age 11 and degrades year-only family profiles", () => {
    const now = new Date();
    const birth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 132, 1));
    const family = {
      profile: {
        childFirstName: "Avery",
        birthYear: birth.getUTCFullYear(),
        birthMonth: birth.getUTCMonth() + 1,
        schoolStage: "middle" as const,
        county: "Fayette",
        diagnoses: []
      },
      profileProvenance: "stated" as const,
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
    };
    context.state = { ...demoState, family };
    const { unmount } = render(<CheckinPage />);
    const section = screen.getByRole("region", { name: "For your family" });
    expect(within(section).getByRole("link", { name: /PSC-17/i })).toBeVisible();
    expect(within(section).getByRole("link", { name: /teen/i })).toBeVisible();
    unmount();

    context.state = { ...demoState, family: { ...family, profile: { ...family.profile, birthMonth: undefined } } };
    render(<CheckinPage />);
    expect(screen.queryByRole("region", { name: "For your family" })).not.toBeInTheDocument();
  });
});
