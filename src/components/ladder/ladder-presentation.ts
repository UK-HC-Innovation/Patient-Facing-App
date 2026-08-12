import {
  selectLadderActiveSurface,
  selectLadderComposerCollapsed,
  selectLadderNow
} from "@/components/ladder/ladder-session-reducer";
import type { LadderSessionState } from "@/components/ladder/ladder-session-types";
import {
  availableLadderSurfaces,
  type LadderSurface
} from "@/components/ladder/ladder-surface-registry";
import {
  applyLadderSimulation,
  withoutLadderSimulation
} from "@/components/ladder/ladder-simulation";
import { answerableStaleStep, checkInDue } from "@/domain/family-journey";
import { pendingFamilySafetyEvent } from "@/domain/family-safety";
import type {
  FamilyFlag,
  FamilyNavigatorState,
  FamilyProfile,
  FamilyResourceStep,
  FamilySafetyEvent
} from "@/domain/types";

export type LadderPresentationInput = {
  family: FamilyNavigatorState | null;
  session: LadderSessionState;
  simulationEnabled: boolean;
  wallClock: Date;
  wroteThisSession: boolean;
  /** The online helper can be offered, but only after a completed review exists. */
  aiChoiceAvailable?: boolean;
  reviewAvailable?: boolean;
};

export type LadderActiveAsk =
  | "none"
  | "basics"
  | "ai_consent"
  | "checkin"
  | "stale_step";

/**
 * Everything that decides which Ladder places and asks exist for this render.
 *
 * This is deliberately free of React, browser history, network calls, and
 * persistence. Those are adapters around this model. Keeping the priority rules
 * here means the wait-header pointer and the body can be tested from the same
 * state rather than independently reconstructing "one ask at a time".
 */
export type LadderPresentation = {
  durableFamily: FamilyNavigatorState | null;
  postureFamily: FamilyNavigatorState | null;
  routingProfile: FamilyProfile | null;
  now: Date;
  pendingSafetyEvent: FamilySafetyEvent | undefined;
  openFlag: FamilyFlag | undefined;
  checkinVisible: boolean;
  followupStep: FamilyResourceStep | undefined;
  activeAsk: LadderActiveAsk;
  returning: boolean;
  composerCollapsed: boolean;
  hasPrograms: boolean;
  hasNotes: boolean;
  hasVisit: boolean;
  surfaces: LadderSurface[];
  resolvedSurface: LadderSurface;
  showTabs: boolean;
};

export function deriveLadderPresentation({
  family,
  session,
  simulationEnabled,
  wallClock,
  wroteThisSession,
  aiChoiceAvailable = false,
  reviewAvailable = false
}: LadderPresentationInput): LadderPresentation {
  const durableFamily = family === null ? null : withoutLadderSimulation(family);
  const postureFamily =
    family === null
      ? null
      : simulationEnabled
        ? applyLadderSimulation(family, session.simulation)
        : durableFamily;
  const routingProfile = family?.profile ?? session.safetyRoutingProfile;
  const now = simulationEnabled ? selectLadderNow(session, wallClock) : wallClock;
  const pendingSafety = pendingFamilySafetyEvent(family?.safetyEvents ?? []);
  const openFlag = postureFamily?.flags.find(({ acknowledgedAt }) => acknowledgedAt === undefined);
  const checkinStarted = session.checkin.status === "active";
  const checkinSkipped = session.checkin.status === "skipped";
  const checkinCandidate =
    postureFamily !== null &&
    postureFamily.profile !== null &&
    !checkinSkipped &&
    (checkinStarted || checkInDue(postureFamily, now));
  const followupCandidate =
    family !== null &&
    !session.followupAnswered &&
    !session.threadActive
      ? answerableStaleStep(family.steps, now)
      : undefined;
  const needsBasics =
    family !== null &&
    routingProfile === null &&
    !session.disclosures.basicsDeferred &&
    (family.interviews.length > 0 || family.activeDomains.length > 0);
  // One ordered arbiter owns every page-level question. Safety and clinic-now
  // information suppress questions; the basic facts required for local matching
  // come before the optional online-service choice, then return-visit asks.
  const activeAsk: LadderActiveAsk =
    pendingSafety !== undefined || openFlag !== undefined
      ? "none"
      : needsBasics
        ? "basics"
        : aiChoiceAvailable && reviewAvailable
          ? "ai_consent"
          : checkinCandidate
            ? "checkin"
            : followupCandidate
              ? "stale_step"
              : "none";
  const checkinVisible = activeAsk === "checkin";
  const followupStep = activeAsk === "stale_step" ? followupCandidate : undefined;
  const hasPrograms =
    family !== null && routingProfile !== null && family.activeDomains.length > 0;
  const hasNotes = family !== null && (family.profile !== null || family.facts.length > 0);
  const hasVisit =
    simulationEnabled &&
    postureFamily?.profile !== null &&
    postureFamily?.profile !== undefined &&
    postureFamily.referral !== null;
  const surfaces = availableLadderSurfaces({ hasPrograms, hasNotes, hasVisit });
  const returning = !wroteThisSession && (family?.interviews.length ?? 0) > 0;

  return {
    durableFamily,
    postureFamily,
    routingProfile,
    now,
    pendingSafetyEvent: pendingSafety,
    openFlag,
    checkinVisible,
    followupStep,
    activeAsk,
    returning,
    composerCollapsed: selectLadderComposerCollapsed(
      session,
      returning,
      family?.profile !== null && family?.profile !== undefined
    ),
    hasPrograms,
    hasNotes,
    hasVisit,
    surfaces,
    resolvedSurface: selectLadderActiveSurface(session, surfaces),
    showTabs: surfaces.length > 1
  };
}
