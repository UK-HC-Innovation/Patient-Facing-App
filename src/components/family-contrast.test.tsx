import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import tailwindConfig from "../../tailwind.config";
import { brentState } from "@/domain/fixtures";
import { SAMPLE_CAREGIVER_TEXT, schoolAgeFamilyState } from "@/domain/family-fixtures";
import { getFamilyResourceById } from "@/domain/family-resources";
import type { FamilyResourceStep } from "@/domain/types";
import { FamilyAppointmentCard } from "./family-appointment-card";
import { FamilyExperience } from "./family-experience";
import { FamilyFactCard } from "./family-fact-card";
import { FamilyOrientationInterview } from "./family-orientation-interview";
import { FamilyResourceCard } from "./family-resource-card";
import { FamilyWaitHeader } from "./family-wait-header";

const { requestFamilyInterview } = vi.hoisted(() => ({
  requestFamilyInterview: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/ai/family-interview-provider", () => ({ requestFamilyInterview }));
vi.mock("@/ai/family-recommend-provider", () => ({
  requestFamilyRecommendations: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/voice/tts", () => ({
  isSpeaking: () => false,
  speak: vi.fn(() => Promise.resolve()),
  stopSpeaking: vi.fn(),
  subscribeSpeaking: () => () => undefined
}));
vi.mock("@/voice/use-dictation", () => ({
  useDictation: () => ({
    supported: false,
    listening: false,
    start: vi.fn(),
    stop: vi.fn()
  })
}));
vi.mock("@/voice/voice-consent", () => ({
  useVoiceEntry: () => ({
    consentRequired: false,
    grantConsent: vi.fn(),
    onSessionStart: vi.fn()
  })
}));

type Rgb = readonly [number, number, number];

const WHITE: Rgb = [255, 255, 255];

function paletteColor(name: string): Rgb {
  if (name === "white") return WHITE;
  const colors = tailwindConfig.theme?.extend?.colors;
  if (colors === undefined || typeof colors !== "object" || Array.isArray(colors)) {
    throw new Error("Tailwind family colors are unavailable.");
  }
  const value = (colors as Record<string, unknown>)[name];
  if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)) {
    throw new Error(`Tailwind color ${name} is not a six-digit hex value.`);
  }
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16)
  ];
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha)
  ];
}

function luminance(color: Rgb): number {
  const [red, green, blue] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function classColor(
  element: HTMLElement,
  kind: "text" | "bg"
): { color: Rgb; alpha: number } | null {
  const names = kind === "text" ? "ink|care" : "white|paper|calm";
  const pattern = new RegExp(`^${kind}-(${names})(?:/(\\d+))?$`);
  for (const className of element.className.split(/\s+/)) {
    const match = pattern.exec(className);
    if (match) {
      return {
        color: paletteColor(match[1]),
        alpha: match[2] === undefined ? 1 : Number(match[2]) / 100
      };
    }
  }
  return null;
}

function expectAaContrast(element: HTMLElement, inheritedBackground: Rgb = WHITE): void {
  const backgroundClass = classColor(element, "bg");
  const background =
    backgroundClass === null
      ? inheritedBackground
      : blend(backgroundClass.color, inheritedBackground, backgroundClass.alpha);
  const textClass = classColor(element, "text");
  if (textClass === null) {
    throw new Error(`No supported text color class on: ${element.className}`);
  }
  const foreground = blend(textClass.color, background, textClass.alpha);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  expect((lighter + 0.05) / (darker + 0.05)).toBeGreaterThanOrEqual(4.5);
}

afterEach(() => {
  cleanup();
  requestFamilyInterview.mockReset();
});

describe("Ladder semantic contrast", () => {
  it("keeps every reviewer-identified foreground/background pair at WCAG AA", async () => {
    const waitHeader = render(
      <FamilyWaitHeader family={schoolAgeFamilyState} language="en" />
    );
    expectAaContrast(screen.getByText(/can't predict the exact date/i));
    waitHeader.unmount();

    const callbacks = {
      onSeedReferral: vi.fn(),
      onBook: vi.fn(),
      onBarriers: vi.fn(),
      onAckReminder: vi.fn(),
      onReschedule: vi.fn(),
      onComplete: vi.fn(),
      onMiss: vi.fn(),
      onRebook: vi.fn(),
      onCountdown: vi.fn(),
      onJoinSoonerList: vi.fn(),
      onLeaveSoonerList: vi.fn(),
      onSoonerOffer: vi.fn(),
      onDeclineSoonerOffer: vi.fn()
    };
    const appointment = render(
      <FamilyAppointmentCard
        family={schoolAgeFamilyState}
        language="en"
        locked={false}
        {...callbacks}
      />
    );
    expectAaContrast(screen.getByText(/UKHCI Ladder.*concept demo/i));
    appointment.unmount();

    const experience = render(
      <FamilyExperience
        state={{ ...brentState, family: schoolAgeFamilyState }}
        dispatch={vi.fn()}
        passcode=""
      />
    );
    const badges = screen.getAllByText(/UKHCI Ladder.*concept demo/i);
    expectAaContrast(badges[0]);
    experience.unmount();

    const fact = {
      id: "fact-contrast",
      label: "Grade",
      value: "fourth grade",
      status: "patient_reported" as const,
      sourceSnippet: "fourth grade"
    };
    const factCard = render(
      <FamilyFactCard
        fact={fact}
        language="en"
        onConfirm={vi.fn()}
        includeToggle={{ included: false, onToggle: vi.fn() }}
      />
    );
    expectAaContrast(screen.getByText("You wrote"));
    expectAaContrast(screen.getByText("Not in packet"));
    expectAaContrast(screen.getByText("From your words"));
    factCard.unmount();

    const michelle = getFamilyResourceById("michelle_p_waiver")!;
    const activeStep: FamilyResourceStep = {
      id: "step-contrast",
      resourceId: michelle.id,
      domain: "waivers_financial",
      status: "planned",
      plannedAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T12:00:00.000Z"
    };
    const resources = render(
      <>
        <FamilyResourceCard
          resource={michelle}
          domain="waivers_financial"
          language="en"
          urgency="when_ready"
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
          isSaved={false}
          isEnrolled
          onSave={vi.fn()}
          onShare={vi.fn()}
          onToggleEnrollment={vi.fn()}
        />
        <FamilyResourceCard
          resource={michelle}
          domain="waivers_financial"
          language="en"
          step={activeStep}
          isSaved={false}
          isEnrolled={false}
          onSave={vi.fn()}
          onShare={vi.fn()}
          onToggleEnrollment={vi.fn()}
        />
      </>
    );
    expectAaContrast(screen.getByText("When you are ready"));
    expectAaContrast(screen.getByText("You already have this"));
    expectAaContrast(screen.getByTestId("family-step-status"));
    resources.unmount();

    requestFamilyInterview.mockResolvedValue({
      facts: [],
      domains: [],
      followUps: []
    });
    render(
      <FamilyOrientationInterview
        profile={schoolAgeFamilyState.profile!}
        draft={SAMPLE_CAREGIVER_TEXT}
        passcode=""
        language="en"
        onDraftChange={vi.fn()}
        onInterviewExtracted={vi.fn()}
        onSafetyEscalation={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /find help/i }));
    const completion = await screen.findByText("Thanks. That is enough to get you started.");
    expectAaContrast(completion.closest('[role="status"]') as HTMLElement);
  });

  // The strip is the first thing a caregiver reads after describing their child,
  // and it sits on the paper card rather than on white.
  it("keeps the heard strip legible", async () => {
    const user = userEvent.setup();
    render(
      <FamilyExperience
        state={{
          ...brentState,
          family: { ...schoolAgeFamilyState, interviewDraft: SAMPLE_CAREGIVER_TEXT }
        }}
        dispatch={vi.fn()}
        passcode=""
      />
    );

    await user.click(screen.getByRole("button", { name: "Find help" }));
    const strip = await screen.findByTestId("family-heard-strip");

    expectAaContrast(screen.getByTestId("family-heard"));
    expectAaContrast(within(strip).getByText(/Check or change this/i));
    await user.click(within(strip).getByText(/Check or change this/i));
    expectAaContrast(within(strip).getByText(/Nothing here is saved anywhere but this device/i));
    expectAaContrast(screen.getByText("Optional — answering sharpens the list."));
  });
});
