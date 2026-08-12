import type { FamilyAiConsent } from "@/domain/family-ai-consent";
import type { LadderSessionEvent, LadderSessionState } from "@/components/ladder/ladder-session-types";
import { familyAppointmentWorkflowReducer } from "@/domain/family-appointment-workflow";

export function createLadderSessionState(initialAiConsent: FamilyAiConsent): LadderSessionState {
  return {
    surface: "home",
    composer: { status: "collapsed", focusRequest: 0 },
    checkin: { status: "idle", part: "note" },
    disclosures: {
      heardStripOpen: false,
      needsScreenOpen: false,
      basicsOverride: null,
      basicsDeferred: false
    },
    review: null,
    ai: {
      consent: initialAiConsent,
      liveSendCount: 0,
      sessionTurnCount: 0
    },
    followupAnswered: false,
    threadActive: false,
    visitNoticeOpen: false,
    safetyRoutingProfile: null,
    simulation: { clockOffsetMs: 0, visit: null, diagnosisDates: {} }
  };
}

export function ladderSessionReducer(
  state: LadderSessionState,
  event: LadderSessionEvent
): LadderSessionState {
  switch (event.type) {
    case "surface.requested":
      return { ...state, surface: event.surface };
    case "composer.opened":
      return {
        ...state,
        surface: "home",
        composer: { status: "open", focusRequest: state.composer.focusRequest + 1 }
      };
    case "checkin.partChanged":
      return {
        ...state,
        checkin: {
          status: state.checkin.status === "skipped" ? "skipped" : "active",
          part: event.part
        }
      };
    case "checkin.started":
      return state.checkin.status === "active"
        ? state
        : { ...state, checkin: { status: "active", part: state.checkin.part } };
    case "checkin.skipped":
      return { ...state, checkin: { status: "skipped", part: state.checkin.part } };
    case "disclosure.heardToggled": {
      const heardStripOpen = !state.disclosures.heardStripOpen;
      return {
        ...state,
        disclosures: {
          ...state.disclosures,
          heardStripOpen,
          basicsOverride: heardStripOpen ? false : state.disclosures.basicsOverride
        }
      };
    }
    case "disclosure.needsScreenToggled":
      return {
        ...state,
        disclosures: {
          ...state.disclosures,
          needsScreenOpen: !state.disclosures.needsScreenOpen
        }
      };
    case "disclosure.basicsToggled": {
      const basicsOpen = !(state.disclosures.basicsOverride ?? false);
      return {
        ...state,
        disclosures: {
          ...state.disclosures,
          basicsOverride: basicsOpen,
          heardStripOpen: basicsOpen ? false : state.disclosures.heardStripOpen
        }
      };
    }
    case "disclosure.basicsDeferred":
      return state.disclosures.basicsDeferred
        ? state
        : {
            ...state,
            disclosures: {
              ...state.disclosures,
              basicsOverride: false,
              basicsDeferred: true
            }
          };
    case "review.received":
      return { ...state, review: event.review };
    case "review.cleared":
      return state.review === null ? state : { ...state, review: null };
    case "ai.consentAnswered":
      return { ...state, ai: { ...state.ai, consent: event.consent } };
    case "ai.sendAttempted":
      return {
        ...state,
        ai: { ...state.ai, liveSendCount: state.ai.liveSendCount + 1 }
      };
    case "interview.completed":
      return {
        ...state,
        ai: { ...state.ai, sessionTurnCount: state.ai.sessionTurnCount + 1 }
      };
    case "followup.answered":
      return state.followupAnswered ? state : { ...state, followupAnswered: true };
    case "thread.activityChanged":
      return state.threadActive === event.active ? state : { ...state, threadActive: event.active };
    case "visitNotice.visibilityChanged":
      return state.visitNoticeOpen === event.open ? state : { ...state, visitNoticeOpen: event.open };
    case "safety.routingProfileSet":
      return { ...state, safetyRoutingProfile: event.profile };
    case "simulation.clockAdvanced":
      return Number.isInteger(event.days) && event.days > 0
        ? {
            ...state,
            simulation: {
              ...state.simulation,
              clockOffsetMs: state.simulation.clockOffsetMs + event.days * DAY_MS
            }
          }
        : state;
    case "simulation.clockPositioned":
      return Number.isFinite(event.offsetMs)
        ? {
            ...state,
            simulation: { ...state.simulation, clockOffsetMs: event.offsetMs }
          }
        : state;
    case "simulation.diagnosesSet":
      return {
        ...state,
        simulation: { ...state.simulation, diagnosisDates: { ...event.dates } }
      };
    case "simulation.visitTransitioned": {
      const current = state.simulation.visit ?? event.base;
      const visit = familyAppointmentWorkflowReducer(current, event.event);
      return visit === current && state.simulation.visit !== null
        ? state
        : { ...state, simulation: { ...state.simulation, visit } };
    }
    case "simulation.reset":
      return {
        ...state,
        simulation: { clockOffsetMs: 0, visit: null, diagnosisDates: {} },
        visitNoticeOpen: false
      };
  }
}

export function selectLadderBasicsOpen(state: LadderSessionState): boolean {
  return state.disclosures.basicsOverride ?? false;
}

export function selectLadderActiveSurface(
  state: LadderSessionState,
  available: readonly LadderSessionState["surface"][]
): LadderSessionState["surface"] {
  return available.includes(state.surface) ? state.surface : "home";
}

export function selectLadderComposerCollapsed(
  state: LadderSessionState,
  returning: boolean,
  hasProfile: boolean
): boolean {
  return returning && hasProfile && state.composer.status === "collapsed";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function selectLadderNow(state: LadderSessionState, wallClock = new Date()): Date {
  return new Date(wallClock.valueOf() + state.simulation.clockOffsetMs);
}
