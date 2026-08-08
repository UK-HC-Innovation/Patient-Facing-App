import { describe, expect, it } from "vitest";
import {
  canSendFamilyTextOffDevice,
  familyAiUseMode,
  shouldOfferFamilyAiChoice
} from "./family-ai-consent";

describe("canSendFamilyTextOffDevice", () => {
  it("keeps words on the device until both the deployment and the caregiver say yes", () => {
    expect(canSendFamilyTextOffDevice({ passcode: "demo", consent: "granted" })).toBe(true);

    // Consent without a passcode: this deployment has no online helper to use.
    expect(canSendFamilyTextOffDevice({ passcode: undefined, consent: "granted" })).toBe(false);
    expect(canSendFamilyTextOffDevice({ passcode: "", consent: "granted" })).toBe(false);
    expect(canSendFamilyTextOffDevice({ passcode: "   ", consent: "granted" })).toBe(false);

    // Passcode without consent: the caregiver has not been asked, or said no.
    expect(canSendFamilyTextOffDevice({ passcode: "demo", consent: "unset" })).toBe(false);
    expect(canSendFamilyTextOffDevice({ passcode: "demo", consent: "declined" })).toBe(false);
  });
});

describe("shouldOfferFamilyAiChoice", () => {
  it("asks only where there is a real choice, and only once", () => {
    expect(shouldOfferFamilyAiChoice({ passcode: "demo", consent: "unset" })).toBe(true);

    // Already answered — asking again would be nagging for a yes.
    expect(shouldOfferFamilyAiChoice({ passcode: "demo", consent: "granted" })).toBe(false);
    expect(shouldOfferFamilyAiChoice({ passcode: "demo", consent: "declined" })).toBe(false);

    // No passcode: offering would promise a capability this deployment lacks.
    expect(shouldOfferFamilyAiChoice({ passcode: undefined, consent: "unset" })).toBe(false);
  });
});

describe("familyAiUseMode", () => {
  it("reports what the record shows rather than what the app intended", () => {
    expect(familyAiUseMode({ liveSends: 0, turnsTaken: 0 })).toBe("none");
    expect(familyAiUseMode({ liveSends: 0, turnsTaken: 3 })).toBe("on_device");
    expect(familyAiUseMode({ liveSends: 1, turnsTaken: 3 })).toBe("online");

    // One completed live send is not undone by later on-device turns: the
    // disclosure describes the session's history, not its current setting.
    expect(familyAiUseMode({ liveSends: 1, turnsTaken: 9 })).toBe("online");
  });
});
