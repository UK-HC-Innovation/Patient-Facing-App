import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { FoodAskBar } from "./food-ask-bar";

describe("FoodAskBar", () => {
  it("shows a start button before a session begins", () => {
    render(<FoodAskBar mode="unknown" dataMode="checking" status="idle" onStart={() => {}} onStop={() => {}} onSendText={() => {}} language="en" />);
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("submits typed questions in mock mode and clears the input", async () => {
    const onSendText = vi.fn();
    const user = userEvent.setup();
    render(<FoodAskBar mode="mock" dataMode="on_device" status="listening" onStart={() => {}} onStop={() => {}} onSendText={onSendText} language="en" />);

    expect(screen.getByText(/type your question/i)).toBeInTheDocument();
    const input = screen.getByLabelText("Ask about this food…");
    await user.type(input, "Can I have this?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(onSendText).toHaveBeenCalledWith("Can I have this?");
    expect(input).toHaveValue("");
  });

  it("disables asking while thinking", () => {
    render(<FoodAskBar mode="mock" dataMode="on_device" status="thinking" onStart={() => {}} onStop={() => {}} onSendText={() => {}} language="en" />);
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  });

  it("keeps typed questions on the gated live-session send handle", async () => {
    const user = userEvent.setup();
    const onSendText = vi.fn();
    render(<FoodAskBar mode="live" dataMode="live_voice" status="listening" onStart={() => {}} onStop={() => {}} onSendText={onSendText} language="en" />);
    expect(screen.getByRole("button", { name: "End" })).toBeInTheDocument();
    expect(screen.getByText(/microphone audio, a current camera frame/i)).toBeInTheDocument();
    expect(screen.getByText(/sent to OpenAI/i)).toBeInTheDocument();
    const input = screen.getByLabelText("Ask about this food…");
    await user.type(input, "What should I notice?");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(onSendText).toHaveBeenCalledWith("What should I notice?");
  });
});
