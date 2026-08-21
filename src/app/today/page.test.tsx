import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { brentState } from "@/domain/fixtures";
import type { AppState } from "@/domain/types";
import TodayPage from "./page";

const mocks = vi.hoisted(() => ({ state: null as AppState | null, dispatch: vi.fn() }));

vi.mock("@/state/store", () => ({
  useHealthState: () => ({ state: mocks.state, dispatch: mocks.dispatch })
}));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/home-composer", () => ({ HomeComposer: () => <div>Home composer</div> }));
vi.mock("@/components/language-toggle", () => ({ LanguageToggle: () => <div>Language toggle</div> }));
vi.mock("@/components/today-greeting", () => ({ TodayGreeting: () => <div>Greeting</div> }));
vi.mock("@/components/dose-card", () => ({ DoseCard: () => <div>Dose card</div> }));
vi.mock("@/components/dose-reminder-card", () => ({ DoseReminderCard: () => <div>Dose reminder</div> }));
vi.mock("@/hooks/use-dose-reminder", () => ({ useDoseReminder: () => ({ requestPermission: vi.fn() }) }));

function stateWithRecentMeals(): AppState {
  const times = [
    new Date(2026, 6, 8, 12),
    new Date(2026, 6, 9, 12),
    new Date(2026, 6, 10, 13)
  ];
  return {
    ...brentState,
    glucoseReadings: [],
    mealLog: brentState.mealLog.slice(0, 3).map((entry, index) => ({
      ...entry,
      loggedAt: times[index].toISOString(),
      compassScore: {
        fcs: [20, 50, 83][index],
        band: (["minimize", "moderate", "encourage"] as const)[index],
        tier: "T1" as const
      }
    }))
  };
}

describe("TodayPage nutrition loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 15));
    mocks.dispatch.mockClear();
    mocks.state = stateWithRecentMeals();
  });

  afterEach(() => vi.useRealTimers());

  it("renders the week summary and a due post-meal nudge after the composer", () => {
    render(<TodayPage />);

    expect(screen.getByRole("heading", { name: "Week in Food" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Check your blood sugar" })).toBeInTheDocument();
    const mainText = screen.getByRole("main").textContent ?? "";
    expect(mainText.indexOf("Home composer")).toBeLessThan(mainText.indexOf("Week in Food"));
  });

  it("does not render the nudge without the diabetes lens", () => {
    const state = stateWithRecentMeals();
    mocks.state = {
      ...state,
      carePlan: { ...state.carePlan, condition: "hypertension", conditions: ["hypertension"] }
    };

    render(<TodayPage />);
    expect(screen.queryByRole("heading", { name: "Check your blood sugar" })).not.toBeInTheDocument();
  });
});
