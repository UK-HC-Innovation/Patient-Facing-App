/**
 * Whether a family turn may use the network path at all.
 *
 * The Ladder copy promises the caregiver's words stay on the device. Until this
 * module existed that promise was false: both composers POSTed the narrative and
 * the full child profile on every non-safety turn, and the only gates
 * (`unconfigured`, `locked`) lived in the route handler — which is to say, after
 * the words had already left. A deployment with a provider key and no
 * DEMO_PASSCODE forwarded every visitor's text with nothing in front of it.
 *
 * So the resting state is on-device: the deterministic extractor carries the flow
 * with zero network, and the live path opens only when the caregiver has been
 * told what it sends and has said yes. Consent is session-scoped on purpose —
 * it lives in React state, never in the persisted record, so a shared phone does
 * not inherit the last person's answer and no storage migration can resurrect it.
 */
export type FamilyAiConsent = "unset" | "granted" | "declined";

export type FamilyAiGateInput = {
  /** The `?k=` demo passcode. Absent means this deployment never offers the live path. */
  passcode?: string;
  consent: FamilyAiConsent;
};

function hasPasscode(passcode?: string): boolean {
  return typeof passcode === "string" && passcode.trim().length > 0;
}

/**
 * The single question every network call site must ask. Both conditions are
 * required: the passcode says the deployment offers the online helper, the
 * consent says this caregiver accepted it.
 */
export function canSendFamilyTextOffDevice({ passcode, consent }: FamilyAiGateInput): boolean {
  return hasPasscode(passcode) && consent === "granted";
}

/**
 * Whether to put the choice on screen. Only where there is a real choice to make:
 * no passcode means there is no online helper to offer, and a caregiver who has
 * already answered is not asked again this session.
 */
export function shouldOfferFamilyAiChoice({ passcode, consent }: FamilyAiGateInput): boolean {
  return hasPasscode(passcode) && consent === "unset";
}

export type FamilyAiUseMode = "none" | "on_device" | "online";

/**
 * What to tell the caregiver about what actually happened, derived from the
 * record rather than asserted. `liveSends` counts interviews whose extraction
 * was "live" — the only persisted trace of a completed network round trip.
 *
 * Note the asymmetry this cannot see: a POST that the server answered `locked`
 * or `unconfigured` records "mock" even though the body left the device. That is
 * exactly why the gate above has to prevent the send rather than describe it.
 */
export function familyAiUseMode({
  liveSends,
  turnsTaken
}: {
  liveSends: number;
  turnsTaken: number;
}): FamilyAiUseMode {
  if (liveSends > 0) return "online";
  if (turnsTaken > 0) return "on_device";
  return "none";
}
