import type { AppState, FamilyNavigatorState } from "@/domain/types";

/**
 * F3a. Which posture this build is in.
 *
 * Ladder carries a working simulation: a button that puts a family on a
 * waitlist, a picker of realistic evaluation dates, "move the visit closer",
 * and a control that pretends a month passed. For the stakeholder demo that
 * apparatus *is* the product being shown, and spec 20 kept it deliberately. In
 * front of a real family it is something else — an interface that looks like it
 * booked an appointment. The review was right that both cannot be one build.
 *
 * So this is the one switch, and it defaults ON: every existing demo behaves
 * exactly as before, and the pilot build sets NEXT_PUBLIC_LADDER_SIM=0.
 *
 * Read at call time rather than at module load so a test can stub the
 * environment; Next inlines the literal `process.env.NEXT_PUBLIC_LADDER_SIM`
 * into client bundles at build time, so the reference must stay written out in
 * full here rather than being computed.
 */
export function ladderSimEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_LADDER_SIM;
  if (raw === undefined) return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === "0" || normalized === "false" || normalized === "off");
}

export function stripLadderSimulationFamily(
  family: FamilyNavigatorState
): FamilyNavigatorState {
  return { ...family, referral: null, appointments: [], soonerList: null };
}

const LEGACY_LADDER_SIMULATION_AUDIT_LABELS = new Set([
  "Family earlier-visit list joined",
  "Family earlier-visit list left",
  "Family referral recorded (demo)",
  "Evaluation slots offered (demo)",
  "Earlier-visit offer declined (demo)",
  "Evaluation visit booked",
  "Earlier visit replaced the prior booking",
  "Visit barriers recorded",
  "Evaluation visit confirmed",
  "Evaluation visit reschedule requested",
  "Evaluation visit completed (self-reported)",
  "Evaluation visit missed (self-reported)"
]);

export function isLegacyLadderSimulationAudit(label: string): boolean {
  return label.startsWith("Demo control:") || LEGACY_LADDER_SIMULATION_AUDIT_LABELS.has(label);
}

export function stripLadderSimulationState(state: AppState): AppState {
  const auditEvents = state.auditEvents.filter(
    ({ label }) => !isLegacyLadderSimulationAudit(label)
  );
  const family = state.family === null ? null : stripLadderSimulationFamily(state.family);
  return family === state.family && auditEvents.length === state.auditEvents.length
    ? state
    : { ...state, family, auditEvents };
}
