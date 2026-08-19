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

    expect(screen.getByRole("img", { name: "Sample pizza camera preview" })).toBeInTheDocument();
    expect(screen.getByText(/Camera unavailable in this preview/)).toBeInTheDocument();
    expect(screen.getByText("Tap start and describe your order.")).toBeInTheDocument();
    expect(screen.queryByText(/Chrome site settings/i)).not.toBeInTheDocument();
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
});
