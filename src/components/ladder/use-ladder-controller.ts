"use client";

import { useCallback, useMemo, useReducer } from "react";
import type { CheckinPart } from "@/components/family-checkin";
import type { LadderSurface } from "@/components/ladder/ladder-surface-registry";
import type { FamilyAiConsent } from "@/domain/family-ai-consent";
import type { FamilyProfile } from "@/domain/types";
import type {
  FamilyAppointmentWorkflowEvent,
  FamilyAppointmentWorkflowState
} from "@/domain/family-appointment-workflow";
import {
  createLadderSessionState,
  ladderSessionReducer
} from "@/components/ladder/ladder-session-reducer";
import type {
  LadderReviewDetails,
  LadderSessionActions,
  LadderSessionState
} from "@/components/ladder/ladder-session-types";

export type LadderController = {
  session: LadderSessionState;
  actions: LadderSessionActions;
};

export function useLadderController(initialAiConsent: FamilyAiConsent): LadderController {
  const [session, dispatch] = useReducer(
    ladderSessionReducer,
    initialAiConsent,
    createLadderSessionState
  );

  const selectSurface = useCallback((surface: LadderSurface) => {
    dispatch({ type: "surface.requested", surface });
  }, []);
  const openComposer = useCallback(() => dispatch({ type: "composer.opened" }), []);
  const changeCheckinPart = useCallback(
    (part: CheckinPart) => dispatch({ type: "checkin.partChanged", part }),
    []
  );
  const startCheckin = useCallback(() => dispatch({ type: "checkin.started" }), []);
  const skipCheckin = useCallback(() => dispatch({ type: "checkin.skipped" }), []);
  const toggleHeardStrip = useCallback(() => dispatch({ type: "disclosure.heardToggled" }), []);
  const toggleNeedsScreen = useCallback(
    () => dispatch({ type: "disclosure.needsScreenToggled" }),
    []
  );
  const toggleBasics = useCallback(() => dispatch({ type: "disclosure.basicsToggled" }), []);
  const deferBasics = useCallback(() => dispatch({ type: "disclosure.basicsDeferred" }), []);
  const receiveReview = useCallback(
    (review: LadderReviewDetails) => dispatch({ type: "review.received", review }),
    []
  );
  const clearReview = useCallback(() => dispatch({ type: "review.cleared" }), []);
  const answerAiConsent = useCallback(
    (consent: Exclude<FamilyAiConsent, "unset">) =>
      dispatch({ type: "ai.consentAnswered", consent }),
    []
  );
  const recordAiSendAttempt = useCallback(() => dispatch({ type: "ai.sendAttempted" }), []);
  const completeInterview = useCallback(() => dispatch({ type: "interview.completed" }), []);
  const answerFollowup = useCallback(() => dispatch({ type: "followup.answered" }), []);
  const setThreadActive = useCallback(
    (active: boolean) => dispatch({ type: "thread.activityChanged", active }),
    []
  );
  const setVisitNoticeOpen = useCallback(
    (open: boolean) => dispatch({ type: "visitNotice.visibilityChanged", open }),
    []
  );
  const setSafetyRoutingProfile = useCallback(
    (profile: FamilyProfile) => dispatch({ type: "safety.routingProfileSet", profile }),
    []
  );
  const advanceSimulationClock = useCallback(
    (days: number) => dispatch({ type: "simulation.clockAdvanced", days }),
    []
  );
  const positionSimulationClock = useCallback(
    (offsetMs: number) => dispatch({ type: "simulation.clockPositioned", offsetMs }),
    []
  );
  const setSimulationDiagnosisDates = useCallback(
    (dates: Record<string, string>) => dispatch({ type: "simulation.diagnosesSet", dates }),
    []
  );
  const transitionSimulationVisit = useCallback(
    (event: FamilyAppointmentWorkflowEvent, base: FamilyAppointmentWorkflowState) =>
      dispatch({ type: "simulation.visitTransitioned", event, base }),
    []
  );
  const resetSimulation = useCallback(() => dispatch({ type: "simulation.reset" }), []);

  const actions = useMemo<LadderSessionActions>(
    () => ({
      selectSurface,
      openComposer,
      changeCheckinPart,
      startCheckin,
      skipCheckin,
      toggleHeardStrip,
      toggleNeedsScreen,
      toggleBasics,
      deferBasics,
      receiveReview,
      clearReview,
      answerAiConsent,
      recordAiSendAttempt,
      completeInterview,
      answerFollowup,
      setThreadActive,
      setVisitNoticeOpen,
      setSafetyRoutingProfile,
      advanceSimulationClock,
      positionSimulationClock,
      setSimulationDiagnosisDates,
      transitionSimulationVisit,
      resetSimulation
    }),
    [
      advanceSimulationClock,
      answerAiConsent,
      answerFollowup,
      changeCheckinPart,
      clearReview,
      completeInterview,
      openComposer,
      positionSimulationClock,
      receiveReview,
      recordAiSendAttempt,
      resetSimulation,
      selectSurface,
      setSafetyRoutingProfile,
      setSimulationDiagnosisDates,
      setThreadActive,
      setVisitNoticeOpen,
      skipCheckin,
      startCheckin,
      toggleBasics,
      deferBasics,
      toggleHeardStrip,
      toggleNeedsScreen,
      transitionSimulationVisit
    ]
  );

  return { session, actions };
}
