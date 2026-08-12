import type { CheckinPart } from "@/components/family-checkin";
import type { LadderSurface } from "@/components/ladder/ladder-surface-registry";
import type { FamilyAiConsent } from "@/domain/family-ai-consent";
import type { DevNeedDomain, FamilyProfile } from "@/domain/types";
import type {
  FamilyAppointmentWorkflowEvent,
  FamilyAppointmentWorkflowState
} from "@/domain/family-appointment-workflow";

export type LadderReviewDetails = {
  domains: Array<{ domain: DevNeedDomain; rationale?: string }>;
};

export type LadderComposerSession =
  | { status: "collapsed"; focusRequest: number }
  | { status: "open"; focusRequest: number };

export type LadderCheckinSession =
  | { status: "idle"; part: CheckinPart }
  | { status: "active"; part: CheckinPart }
  | { status: "skipped"; part: CheckinPart };

export type LadderSessionState = {
  surface: LadderSurface;
  composer: LadderComposerSession;
  checkin: LadderCheckinSession;
  disclosures: {
    heardStripOpen: boolean;
    needsScreenOpen: boolean;
    basicsOverride: boolean | null;
    basicsDeferred: boolean;
  };
  review: LadderReviewDetails | null;
  ai: {
    consent: FamilyAiConsent;
    liveSendCount: number;
    sessionTurnCount: number;
  };
  followupAnswered: boolean;
  threadActive: boolean;
  visitNoticeOpen: boolean;
  safetyRoutingProfile: FamilyProfile | null;
  simulation: {
    clockOffsetMs: number;
    visit: FamilyAppointmentWorkflowState | null;
    diagnosisDates: Record<string, string>;
  };
};

export type LadderSessionEvent =
  | { type: "surface.requested"; surface: LadderSurface }
  | { type: "composer.opened" }
  | { type: "checkin.partChanged"; part: CheckinPart }
  | { type: "checkin.started" }
  | { type: "checkin.skipped" }
  | { type: "disclosure.heardToggled" }
  | { type: "disclosure.needsScreenToggled" }
  | { type: "disclosure.basicsToggled" }
  | { type: "disclosure.basicsDeferred" }
  | { type: "review.received"; review: LadderReviewDetails }
  | { type: "review.cleared" }
  | { type: "ai.consentAnswered"; consent: Exclude<FamilyAiConsent, "unset"> }
  | { type: "ai.sendAttempted" }
  | { type: "interview.completed" }
  | { type: "followup.answered" }
  | { type: "thread.activityChanged"; active: boolean }
  | { type: "visitNotice.visibilityChanged"; open: boolean }
  | { type: "safety.routingProfileSet"; profile: FamilyProfile }
  | { type: "simulation.clockAdvanced"; days: number }
  | { type: "simulation.clockPositioned"; offsetMs: number }
  | { type: "simulation.diagnosesSet"; dates: Record<string, string> }
  | {
      type: "simulation.visitTransitioned";
      event: FamilyAppointmentWorkflowEvent;
      base: FamilyAppointmentWorkflowState;
    }
  | { type: "simulation.reset" };

export type LadderSessionActions = {
  selectSurface: (surface: LadderSurface) => void;
  openComposer: () => void;
  changeCheckinPart: (part: CheckinPart) => void;
  startCheckin: () => void;
  skipCheckin: () => void;
  toggleHeardStrip: () => void;
  toggleNeedsScreen: () => void;
  toggleBasics: () => void;
  deferBasics: () => void;
  receiveReview: (review: LadderReviewDetails) => void;
  clearReview: () => void;
  answerAiConsent: (consent: Exclude<FamilyAiConsent, "unset">) => void;
  recordAiSendAttempt: () => void;
  completeInterview: () => void;
  answerFollowup: () => void;
  setThreadActive: (active: boolean) => void;
  setVisitNoticeOpen: (open: boolean) => void;
  setSafetyRoutingProfile: (profile: FamilyProfile) => void;
  advanceSimulationClock: (days: number) => void;
  positionSimulationClock: (offsetMs: number) => void;
  setSimulationDiagnosisDates: (dates: Record<string, string>) => void;
  transitionSimulationVisit: (
    event: FamilyAppointmentWorkflowEvent,
    base: FamilyAppointmentWorkflowState
  ) => void;
  resetSimulation: () => void;
};
