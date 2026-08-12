import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { FamilyResourcePreferencesCard } from "@/components/family-resource-preferences";

describe("FamilyResourcePreferencesCard", () => {
  it("is optional, names its limits, and saves only catalog-supported ordering choices", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <FamilyResourcePreferencesCard
        language="en"
        preferences={{ scope: "no_preference", contact: "no_preference" }}
        onSave={onSave}
      />
    );

    const disclosure = screen.getByText(/What matters for your program list/i).closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText(/What matters for your program list/i));
    expect(screen.getByText(/cannot verify openings, cost, insurance, language access, hours, or eligibility/i)).toBeVisible();

    await user.click(screen.getByRole("radio", { name: /Nearby or county-specific first/i }));
    await user.click(screen.getByRole("radio", { name: /person or navigator I can call/i }));
    await user.click(screen.getByRole("button", { name: /Save list preferences/i }));

    expect(onSave).toHaveBeenCalledWith({ scope: "local_first", contact: "call_first" });
    expect(screen.getByRole("status")).toHaveTextContent(/saved on this device/i);
  });
});
