import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { AppShell } from "./app-shell";

vi.mock("@/state/store", async () => {
  const { demoState } = await vi.importActual<typeof import("@/domain/fixtures")>("@/domain/fixtures");
  return { useHealthState: () => ({ state: demoState, dispatch: () => {} }) };
});

describe("AppShell", () => {
  it("collapses navigation to Home and the All my health menu", () => {
    render(
      <AppShell title="Today">
        <p>Body</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/today");
    expect(screen.getByRole("link", { name: /all my health/i })).toHaveAttribute("href", "/menu");
  });

  it("does not show a persistent crisis affordance in the demo chrome", () => {
    render(
      <AppShell title="Today">
        <p>Body</p>
      </AppShell>
    );

    expect(screen.queryByText(/feeling unsafe right now/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /988/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /911/i })).not.toBeInTheDocument();
  });

  it("renders the UK-blue 1 good choice lockup on the food page", () => {
    render(
      <AppShell brand="one-good-choice" title="1 good choice">
        <p>Body</p>
      </AppShell>
    );

    expect(screen.getByTestId("one-good-choice-brand")).toBeVisible();
    expect(screen.getByRole("heading", { name: "1 good choice" })).toBeVisible();
  });

  it("renders the page body content in the main region", () => {
    render(
      <AppShell title="Today">
        <p>My temporary page copy</p>
      </AppShell>
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("My temporary page copy")).toBeInTheDocument();
  });
});
