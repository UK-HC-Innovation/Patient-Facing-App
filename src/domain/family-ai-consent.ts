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

/** Changes whenever the just-in-time disclosure materially changes. */
export const FAMILY_AI_DISCLOSURE_VERSION = "2026-08-09";
export const FAMILY_AI_CONSENT_HEADER = "X-Ladder-AI-Consent";
export type FamilyAiEgressPurpose = "interview" | "recommend";

export type FamilyAiGateInput = {
  /** A server-verified session capability. The legacy name remains as a narrow test seam. */
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
 * What to tell the caregiver about what actually happened in this mounted
 * session, derived from attempted sends and completed turns rather than from
 * configuration or persisted history.
 *
 * An attempt is counted before awaiting the response: the client cannot infer
 * from a `locked`, `unconfigured`, or network-error result whether Ladder's
 * service forwarded anything to OpenAI. Durable history therefore records an
 * attempted online-service send, not a vendor-delivery claim.
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
