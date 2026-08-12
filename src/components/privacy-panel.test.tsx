import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { demoState } from "@/domain/fixtures";
import { SAMPLE_CAREGIVER_TEXT, schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { AppState } from "@/domain/types";
import { PrivacyPanel } from "./privacy-panel";

type URLExports = typeof URL & {
  createObjectURL: () => string;
  revokeObjectURL: (value: string) => void;
};

describe("PrivacyPanel", () => {
  it("shows patient-facing privacy commitments", () => {
    render(
      <PrivacyPanel
        state={demoState}
        aiDataMode="on_device"
        onReset={() => undefined}
        onExport={() => undefined}
      />
    );

    expect(screen.getByText("No ads. No data monetization.")).toBeInTheDocument();
    expect(screen.getByText(/You control what you share/i)).toBeInTheDocument();
    expect(screen.getByText(/saved demo record stays in this browser/i)).toBeInTheDocument();
    expect(screen.getByText(/microphone audio is not sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export my data" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete demo data" })).toBeInTheDocument();
  });

  it("calls the export handler when export is clicked", () => {
    const onExport = vi.fn();

    render(<PrivacyPanel state={demoState} onReset={() => undefined} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("exports JSON file with the browser download flow in the parent", () => {
    const originalCreateObjectURL = (URL as URLExports).createObjectURL;
    const originalRevokeObjectURL = (URL as URLExports).revokeObjectURL;
    const createObjectURL = vi.fn().mockReturnValue("blob:home-health-data");
    const revokeObjectURL = vi.fn();

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const onExport = vi.fn().mockImplementation(() => {
      const payload = JSON.stringify(demoState, null, 2);
      const file = new Blob([payload], { type: "application/json" });
      const canCreateObjectURL = typeof URL.createObjectURL === "function";
      const href = canCreateObjectURL
        ? URL.createObjectURL(file)
        : `data:application/json;charset=utf-8,${encodeURIComponent(payload)}`;
      const link = document.createElement("a");

      link.href = href;
      link.download = `home-health-data-${demoState.patient.id}.json`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (canCreateObjectURL) {
        URL.revokeObjectURL(href);
      }
    });

    render(<PrivacyPanel state={demoState} onReset={() => undefined} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Export my data" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:home-health-data");

    if (originalCreateObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL
      });
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL
      });
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }

    anchorClick.mockRestore();
  });

  it("asks for confirmation before deleting demo data", () => {
    const onReset = vi.fn();

    render(<PrivacyPanel state={demoState} onReset={onReset} onExport={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete demo data" }));

    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Delete demo data?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete demo data" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("discloses live voice data at the privacy surface", () => {
    render(
      <PrivacyPanel
        state={demoState}
        aiDataMode="live_voice"
        onReset={() => undefined}
        onExport={() => undefined}
      />
    );

    expect(screen.getByText(/microphone audio and relevant care-plan context/i)).toBeInTheDocument();
    expect(screen.queryByText(/camera|image|food context/i)).toBeNull();
    expect(screen.getByText(/sent to OpenAI/i)).toBeInTheDocument();
  });

  it("discloses recorded Ladder text sends independently of the voice transport", () => {
    const state = {
      ...demoState,
      auditEvents: [
        ...demoState.auditEvents,
        {
          id: "family-send-1",
          patientId: demoState.patient.id,
          action: "family_ai_send_attempted" as const,
          label: "Family interview send attempted through Ladder's online service",
          createdAt: "2026-08-08T12:00:00.000Z"
        }
      ]
    };

    render(
      <PrivacyPanel
        state={state}
        aiDataMode="checking"
        onReset={() => undefined}
        onExport={() => undefined}
      />
    );

    const disclosure = screen.getByTestId("privacy-family-ai-use");
    expect(disclosure).toHaveAttribute("data-family-ai-use-mode", "online");
    expect(disclosure).toHaveTextContent(/Ladder online-helper send recorded/i);
    expect(screen.getByText("Family interview send attempted through Ladder's online service")).toBeVisible();
    expect(screen.getByText(/Coach connection: checking/i)).toBeVisible();
    expect(screen.queryByText(/No AI content has been sent/i)).toBeNull();
  });

  it("counts a saved Ladder draft as on-device text activity", () => {
    const state = {
      ...demoState,
      family: {
        ...schoolAgeFamilyState,
        interviews: [],
        interviewDraft: "My child needs help with reading."
      }
    };

    render(
      <PrivacyPanel
        state={state}
        aiDataMode="checking"
        onReset={() => undefined}
        onExport={() => undefined}
      />
    );

    const disclosure = screen.getByTestId("privacy-family-ai-use");
    expect(disclosure).toHaveAttribute("data-family-ai-use-mode", "on_device");
    expect(disclosure).toHaveTextContent(/contains Ladder notes/i);
    expect(disclosure).not.toHaveTextContent(/No Ladder text activity is recorded/i);
  });

  it("describes legacy live Ladder results without inventing an access-log row", () => {
    const state = {
      ...demoState,
      family: {
        ...schoolAgeFamilyState,
        activeDomains: ["school_iep" as const],
        latestInterviewDomains: ["school_iep" as const],
        interviews: [
          {
            id: "legacy-live-interview",
            rawText: SAMPLE_CAREGIVER_TEXT,
            source: "typed" as const,
            createdAt: "2026-07-01T12:00:00.000Z",
            extraction: "live" as const,
            kind: "orientation" as const
          }
        ],
        recommendations: null
      }
    };

    render(
      <PrivacyPanel
        state={state}
        aiDataMode="on_device"
        onReset={() => undefined}
        onExport={() => undefined}
      />
    );

    const disclosure = screen.getByTestId("privacy-family-ai-use");
    expect(disclosure).toHaveAttribute("data-family-ai-use-mode", "online");
    expect(disclosure).toHaveTextContent(/older live results may predate that log/i);
    expect(screen.queryByText(/Family online-helper send attempted/)).toBeNull();
  });

  it("shows a visible retinopathy walkthrough restore control when provided", () => {
    const onRestoreDefaultDemo = vi.fn();

    render(
      <PrivacyPanel
        state={demoState}
        onReset={() => undefined}
        onExport={() => undefined}
        onRestoreDefaultDemo={onRestoreDefaultDemo}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore retinopathy walkthrough" }));

    expect(onRestoreDefaultDemo).toHaveBeenCalledTimes(1);
  });

  it("shows readable action labels and sorts newest entries first", () => {
    const state: AppState = {
      ...demoState,
      auditEvents: [
        {
          id: "event-1",
          patientId: demoState.patient.id,
          action: "created",
          label: "created",
          createdAt: "2026-07-05T10:00:00.000Z"
        },
        {
          id: "event-2",
          patientId: demoState.patient.id,
          action: "ai_generated",
          label: "ai_generated",
          createdAt: "2026-07-05T11:00:00.000Z"
        }
      ]
    };

    const { rerender } = render(
      <PrivacyPanel state={state} onReset={() => undefined} onExport={() => undefined} />
    );
    const listItems = screen.getAllByRole("listitem");

    expect(listItems[0]).toHaveTextContent("AI response generated");
    expect(listItems[1]).toHaveTextContent("Data created");

    rerender(<PrivacyPanel state={{ ...demoState, auditEvents: [] }} onReset={() => undefined} onExport={() => undefined} />);
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });
});
