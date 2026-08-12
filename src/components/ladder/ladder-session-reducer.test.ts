import { describe, expect, it } from "vitest";
import {
  createLadderSessionState,
  ladderSessionReducer,
  selectLadderActiveSurface,
  selectLadderBasicsOpen,
  selectLadderComposerCollapsed,
  selectLadderNow
} from "@/components/ladder/ladder-session-reducer";

describe("ladderSessionReducer", () => {
  it("keeps the two profile editors mutually exclusive", () => {
    let state = createLadderSessionState("unset");
    state = ladderSessionReducer(state, { type: "disclosure.basicsToggled" });
    expect(selectLadderBasicsOpen(state)).toBe(true);
    expect(state.disclosures.heardStripOpen).toBe(false);

    state = ladderSessionReducer(state, { type: "disclosure.heardToggled" });
    expect(state.disclosures.heardStripOpen).toBe(true);
    expect(selectLadderBasicsOpen(state)).toBe(false);
  });

  it("defers the automatic basics ask for this session without creating profile data", () => {
    const initial = createLadderSessionState("unset");
    const deferred = ladderSessionReducer(initial, { type: "disclosure.basicsDeferred" });

    expect(deferred.disclosures).toMatchObject({
      basicsDeferred: true,
      basicsOverride: false
    });
    expect(ladderSessionReducer(deferred, { type: "disclosure.basicsDeferred" })).toBe(deferred);
  });

  it("opens the shared composer on Home and advances its focus request", () => {
    let state = createLadderSessionState("unset");
    state = ladderSessionReducer(state, { type: "surface.requested", surface: "notes" });
    state = ladderSessionReducer(state, { type: "composer.opened" });

    expect(state.surface).toBe("home");
    expect(state.composer).toEqual({ status: "open", focusRequest: 1 });
    expect(selectLadderComposerCollapsed(state, true, true)).toBe(false);
  });

  it("keeps the current check-in part across an interruption", () => {
    let state = createLadderSessionState("unset");
    state = ladderSessionReducer(state, { type: "checkin.partChanged", part: "pulse" });

    expect(state.checkin).toEqual({ status: "active", part: "pulse" });
    state = ladderSessionReducer(state, { type: "checkin.started" });
    expect(state.checkin).toEqual({ status: "active", part: "pulse" });
  });

  it("marks a skipped check-in terminal for this session", () => {
    let state = createLadderSessionState("unset");
    state = ladderSessionReducer(state, { type: "checkin.partChanged", part: "probe" });
    state = ladderSessionReducer(state, { type: "checkin.skipped" });
    state = ladderSessionReducer(state, { type: "checkin.partChanged", part: "pulse" });

    expect(state.checkin).toEqual({ status: "skipped", part: "pulse" });
  });

  it("falls back to Home when the requested surface is unavailable", () => {
    const state = ladderSessionReducer(createLadderSessionState("unset"), {
      type: "surface.requested",
      surface: "visit"
    });

    expect(selectLadderActiveSurface(state, ["home", "programs"])).toBe("home");
  });

  it("counts sends and completed turns independently", () => {
    let state = createLadderSessionState("granted");
    state = ladderSessionReducer(state, { type: "ai.sendAttempted" });
    state = ladderSessionReducer(state, { type: "ai.sendAttempted" });
    state = ladderSessionReducer(state, { type: "interview.completed" });

    expect(state.ai).toEqual({ consent: "granted", liveSendCount: 2, sessionTurnCount: 1 });
  });

  it("advances a session-only simulation clock without rewriting family history", () => {
    const wallClock = new Date("2026-08-08T12:00:00.000Z");
    const initial = createLadderSessionState("unset");
    const advanced = ladderSessionReducer(initial, { type: "simulation.clockAdvanced", days: 31 });

    expect(selectLadderNow(advanced, wallClock).toISOString()).toBe("2026-09-08T12:00:00.000Z");
    expect(initial.simulation.clockOffsetMs).toBe(0);
    expect(ladderSessionReducer(advanced, { type: "simulation.clockAdvanced", days: 0 })).toBe(
      advanced
    );
  });

  it("positions simulated time in either direction and rejects non-finite offsets", () => {
    const initial = createLadderSessionState("unset");
    const ahead = ladderSessionReducer(initial, {
      type: "simulation.clockPositioned",
      offsetMs: 90_000.5
    });
    const behind = ladderSessionReducer(ahead, {
      type: "simulation.clockPositioned",
      offsetMs: -45_000
    });

    expect(behind.simulation.clockOffsetMs).toBe(-45_000);
    expect(
      ladderSessionReducer(behind, { type: "simulation.clockPositioned", offsetMs: Number.NaN })
    ).toBe(behind);
  });
});
