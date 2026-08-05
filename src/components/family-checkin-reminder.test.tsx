import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { schoolAgeFamilyState } from "@/domain/family-fixtures";
import type { FamilyNavigatorState } from "@/domain/types";
import { FamilyCheckinReminder } from "./family-checkin-reminder";

const NOW = new Date("2026-07-17T12:00:00.000Z");

const touched: FamilyNavigatorState = {
  ...schoolAgeFamilyState,
  profile: { ...schoolAgeFamilyState.profile!, childFirstName: "Riley" },
  interviews: [
    {
      id: "interview-1",
      rawText: "reading is hard",
      source: "typed",
      createdAt: "2026-07-10T12:00:00.000Z",
      extraction: "mock",
      kind: "note"
    }
  ]
};

function renderReminder(family: FamilyNavigatorState = touched, language: "en" | "es" = "en") {
  return render(<FamilyCheckinReminder family={family} language={language} now={NOW} />);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FamilyCheckinReminder", () => {
  it("names the next check-in date", () => {
    renderReminder();

    expect(screen.getByRole("heading", { name: "A way back" })).toBeVisible();
    expect(screen.getByText("Your next check-in is around August 9, 2026.")).toBeVisible();
  });

  // The load-bearing honesty of the whole feature: there is no server, so no
  // reminder can reach a closed app, and the copy says exactly that.
  it("says which channel works with the app closed and which does not", () => {
    renderReminder();

    expect(screen.getByText(/works with Ladder closed/)).toBeVisible();
    expect(screen.getByText(/only tell you while Ladder is open on this phone/)).toBeVisible();
    expect(screen.getByText(/There is no reminder that reaches a closed app/)).toBeVisible();
  });

  it("writes a calendar file on this device and says so", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn().mockReturnValue("blob:ics");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
    const downloads: string[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });

    renderReminder();
    await user.click(screen.getByTestId("family-checkin-ics"));

    expect(downloads).toEqual(["ladder-check-in.ics"]);
    const [blob] = createObjectURL.mock.calls[0] as [Blob];
    expect(blob.type).toContain("text/calendar");
    expect(screen.getByTestId("family-remind-receipt")).toHaveTextContent(
      "Calendar file saved. Open it to add the reminder."
    );
    click.mockRestore();
  });

  it("says so when the phone will not save a file", async () => {
    const user = userEvent.setup();
    Object.defineProperty(URL, "createObjectURL", {
      value: () => {
        throw new Error("no");
      },
      configurable: true
    });

    renderReminder();
    await user.click(screen.getByTestId("family-checkin-ics"));

    expect(screen.getByTestId("family-remind-receipt")).toHaveTextContent(/would not save a calendar file/);
  });

  // Opt-in, never assumed: nothing asks for permission until the caregiver taps.
  it("asks for notification permission only when the caregiver opts in", async () => {
    const user = userEvent.setup();
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", Object.assign(function () {}, { permission: "default", requestPermission }));

    renderReminder();
    expect(requestPermission).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("family-checkin-notify"));

    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("family-remind-receipt")).toHaveTextContent(
      "In-app reminders are on."
    );
    expect(window.localStorage.getItem("ladder-checkin-reminder")).toBe("true");
    // The offer is gone once taken; the calendar file stays.
    expect(screen.queryByTestId("family-checkin-notify")).toBeNull();
    expect(screen.getByTestId("family-checkin-ics")).toBeVisible();
  });

  it("says so when the phone refuses, and does not pretend to be on", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "Notification",
      Object.assign(function () {}, {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("denied")
      })
    );

    renderReminder();
    await user.click(screen.getByTestId("family-checkin-notify"));

    await waitFor(() =>
      expect(screen.getByTestId("family-remind-receipt")).toHaveTextContent(/notifications turned off/)
    );
    expect(window.localStorage.getItem("ladder-checkin-reminder")).not.toBe("true");
    expect(screen.getByTestId("family-checkin-notify")).toBeVisible();
  });

  it("says so on a phone with no notifications at all", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("Notification", undefined);

    renderReminder();
    await user.click(screen.getByTestId("family-checkin-notify"));

    await waitFor(() =>
      expect(screen.getByTestId("family-remind-receipt")).toHaveTextContent(/cannot show app notifications/)
    );
  });

  // The in-app nudge fires only for a check-in that is already due, and it
  // points the service worker at Ladder — not at the blood-pressure app.
  it("shows an opted-in reminder for a due check-in, aimed at /ladder", async () => {
    window.localStorage.setItem("ladder-checkin-reminder", "true");
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Notification",
      Object.assign(function () {}, { permission: "granted", requestPermission: vi.fn() })
    );
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({ showNotification }) },
      configurable: true
    });

    const stale: FamilyNavigatorState = {
      ...touched,
      interviews: [{ ...touched.interviews[0], createdAt: "2026-05-01T12:00:00.000Z" }]
    };
    renderReminder(stale);

    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
    expect(showNotification).toHaveBeenCalledWith(
      "Ladder check-in",
      expect.objectContaining({ data: { url: "/ladder" } })
    );
  });

  it("stays quiet while the check-in is not due", async () => {
    window.localStorage.setItem("ladder-checkin-reminder", "true");
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Notification",
      Object.assign(function () {}, { permission: "granted", requestPermission: vi.fn() })
    );
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({ showNotification }) },
      configurable: true
    });

    renderReminder();

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(showNotification).not.toHaveBeenCalled();
  });

  it("renders nothing for a family with no next check-in to name", () => {
    const { container } = renderReminder({ ...touched, interviews: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders in Spanish", () => {
    renderReminder(touched, "es");

    expect(screen.getByRole("heading", { name: "Una forma de volver" })).toBeVisible();
    expect(screen.getByTestId("family-checkin-ics")).toHaveTextContent("Agregar a tu calendario");
  });
});
