import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { AccessibilityShell } from "./accessibility-shell";

const healthState = vi.hoisted(() => ({ language: "en" as "en" | "es" }));

vi.mock("@/state/store", async () => {
  const { demoState } = await vi.importActual<typeof import("@/domain/fixtures")>("@/domain/fixtures");
  return {
    useHealthState: () => ({
      state: {
        ...demoState,
        patient: { ...demoState.patient, language: healthState.language }
      }
    })
  };
});

describe("AccessibilityShell", () => {
  const initialDocumentLanguage = document.documentElement.lang;

  afterEach(() => {
    healthState.language = "en";
    document.documentElement.lang = initialDocumentLanguage;
  });

  it("keeps the root document language in sync on every app surface", () => {
    document.documentElement.lang = "fr";
    const { rerender, unmount } = render(
      <AccessibilityShell>
        <p>Today</p>
      </AccessibilityShell>
    );

    expect(document.documentElement.lang).toBe("en");
    healthState.language = "es";
    rerender(
      <AccessibilityShell>
        <p>Hoy</p>
      </AccessibilityShell>
    );
    expect(document.documentElement.lang).toBe("es");

    unmount();
    expect(document.documentElement.lang).toBe("fr");
  });
});
