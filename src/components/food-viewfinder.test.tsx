import React, { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FoodViewfinder } from "./food-viewfinder";

const videoRef = createRef<HTMLVideoElement>();

describe("FoodViewfinder demo states", () => {
  it("shows a deterministic sample scan and neutral fallback copy when the camera is unavailable", () => {
    render(
      <FoodViewfinder
        cameraStatus="denied"
        demoPreview
        idleLabel="Tap start and describe your order."
        language="en"
        scanChip={null}
        sessionStatus="idle"
        videoRef={videoRef}
      />
    );

    expect(screen.getByRole("img", { name: "Pizza in the camera view" })).toBeInTheDocument();
    expect(screen.getByText("Camera is off. Turn on camera access to talk about your food.")).toBeInTheDocument();
    expect(screen.getByText("Tap start and describe your order.")).toBeInTheDocument();
    expect(screen.queryByText(/Chrome site settings/i)).not.toBeInTheDocument();
  });

  it("localizes the deterministic sample preview in Spanish", () => {
    render(
      <FoodViewfinder
        cameraStatus="denied"
        demoPreview
        language="es"
        scanChip={null}
        sessionStatus="idle"
        videoRef={videoRef}
      />
    );

    expect(
      screen.getByRole("img", { name: "Una pizza en la vista de la cámara" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("La cámara está apagada. Permite el acceso a la cámara para hablar sobre tu comida.")
    ).toBeInTheDocument();
  });

  it("makes tap-start voice copy a real control when a voice action is available", async () => {
    const onVoiceStatusTap = vi.fn();
    render(
      <FoodViewfinder
        cameraStatus="denied"
        demoPreview
        idleLabel="Tap start and describe your order."
        language="en"
        onVoiceStatusTap={onVoiceStatusTap}
        scanChip={null}
        sessionStatus="idle"
        videoRef={videoRef}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Tap start and describe your order." }));
    expect(onVoiceStatusTap).toHaveBeenCalledTimes(1);
  });

  it("makes a score badge actionable only when score details have an action", async () => {
    const onScoreTap = vi.fn();
    const { rerender } = render(
      <FoodViewfinder
        cameraStatus="active"
        language="en"
        scanChip="Banana, raw"
        scoreBadge="score"
        scoreBand="encourage"
        scoreFcs={83}
        scoreName="Banana, raw"
        scoreTier="T1"
        sessionStatus="idle"
        showVoiceStatus={false}
        videoRef={videoRef}
      />
    );

    expect(screen.queryByRole("button", { name: /Show score details/ })).not.toBeInTheDocument();

    rerender(
      <FoodViewfinder
        cameraStatus="active"
        language="en"
        onScoreTap={onScoreTap}
        scanChip="Banana, raw"
        scoreBadge="score"
        scoreBand="encourage"
        scoreFcs={83}
        scoreName="Banana, raw"
        scoreTier="T1"
        sessionStatus="idle"
        showVoiceStatus={false}
        videoRef={videoRef}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Show score details for Banana, raw" }));
    expect(onScoreTap).toHaveBeenCalledTimes(1);
  });

  it("offers a camera retry on the /food overlays", async () => {
    const onCameraRetry = vi.fn();
    render(
      <FoodViewfinder
        cameraStatus="denied"
        language="en"
        onCameraRetry={onCameraRetry}
        scanChip={null}
        sessionStatus="idle"
        showVoiceStatus={false}
        videoRef={videoRef}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Retry camera" }));
    expect(onCameraRetry).toHaveBeenCalledTimes(1);
  });

  it("renders idle disarm as a tappable scan-again chip", async () => {
    const onScanAgain = vi.fn();
    render(
      <FoodViewfinder
        cameraStatus="active"
        language="en"
        onScoreTap={onScanAgain}
        scanChip="Banana, raw"
        scoreBadge="scan_again"
        sessionStatus="idle"
        showVoiceStatus={false}
        videoRef={videoRef}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Scan again" }));
    expect(onScanAgain).toHaveBeenCalledTimes(1);
  });
});
