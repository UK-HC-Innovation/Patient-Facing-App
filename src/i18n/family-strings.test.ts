import { describe, expect, it } from "vitest";
import { familyStrings, tFamily, type FamilyStringKey } from "./family-strings";

const TASK_7_REQUIRED_KEYS = [
  "pageTitle",
  "demoBadge",
  "intro",
  "spanishReviewNotice",
  "setupTitle",
  "profileCountyLabel",
  "profileChildNameLabel",
  "profileBirthYearLabel",
  "profileBirthMonthLabel",
  "profileSchoolStageLabel",
  "profileDiagnosesLabel",
  "diagnosisAutism",
  "diagnosisAdhd",
  "diagnosisDyslexia",
  "diagnosisSpeechLanguage",
  "diagnosisDevelopmentalDelay",
  "diagnosisIntellectualDisability",
  "diagnosisDownSyndrome",
  "diagnosisOther",
  "diagnosisAdd",
  "diagnosisRemove",
  "schoolNotSchoolAge",
  "schoolPreschool",
  "schoolElementary",
  "schoolMiddle",
  "schoolHigh",
  "schoolPostHigh",
  "screenEarlyIntervention",
  "screenTherapies",
  "screenSchoolIep",
  "screenWaiversFinancial",
  "screenRespite",
  "screenParentSupport",
  "screenSiblingSupport",
  "screenTransportation",
  "answerYes",
  "answerNo",
  "answerDeclined",
  "interviewLabel",
  "interviewPlaceholder",
  "interviewMicStart",
  "interviewSubmit",
  "interviewWorking",
  "interviewErrorTooShort",
  "interviewErrorTooLong",
  "interviewCount",
  "interviewSafetyRedirect",
  "interviewSafetyRedirectTitle",
  "interviewSafetyRedirectBody",
  "evidencePatientReported",
  "evidenceInferred",
  "evidenceConfirmed",
  "factConfirm",
  "followUpSchoolIepQuestion",
  "followUpTherapiesQuestion",
  "followUpWaiversQuestion",
  "followUpRespiteQuestion",
  "followUpGenericDayQuestion",
  "followUpGenericHelpQuestion",
  "orientationRoundCount",
  "followUpChipsLabel",
  "followUpAnswerLabel",
  "followUpAnswerSubmit",
  "orientationComplete",
  "orientationStartOver",
  "needsScreenDisclosureTitle",
  "needsScreenDisclosureBody",
  "domainRationaleTitle",
  "resourceSource",
  "resourceVerified",
  "resourceReferralMode",
  "resourceSave",
  "resourceSaved",
  "resourceShare",
  "resourceShareConsent",
  "resourceShareConsentRequired",
  "resourceOpenSource",
  "resourceAlreadyEnrolled",
  "resourceActNow",
  "resourceAllAges",
  "resourceAgeFrom",
  "resourceAgeThrough",
  "resourceAgeBetween",
  "emptyFallbackTitle",
  "emptyFallbackBody",
  "emptyNavigatorHonesty",
  "timelineNow",
  "timelineNext",
  "timelineLater",
  "timelineDemoControlTitle",
  "timelineDemoControlIntro",
  "timelineDemoThisMonth",
  "timelineDemoOneMonthAgo",
  "timelineDemoThreeMonthsAgo",
  "timelineDemoSixMonthsAgo",
  "timelineDevelopmentEighteenTitle",
  "timelineDevelopmentEighteenBody",
  "timelineDevelopmentEighteenCta",
  "timelineDevelopmentThirtyTitle",
  "timelineDevelopmentThirtyBody",
  "timelineDevelopmentThirtyCta"
] satisfies FamilyStringKey[];

describe("familyStrings", () => {
  it("keeps English and Spanish key sets identical and Task 7 ready", () => {
    expect(Object.keys(familyStrings.es).sort()).toEqual(Object.keys(familyStrings.en).sort());
    expect(Object.keys(familyStrings.en)).toEqual(expect.arrayContaining(TASK_7_REQUIRED_KEYS));
  });

  it("marks Spanish as a draft pending native review", () => {
    expect(familyStrings.es.spanishReviewNotice).toMatch(/borrador/i);
    expect(familyStrings.es.spanishReviewNotice).toMatch(/revise.*hablante nativ/i);
  });

  it("keeps the demo honest and interpolates family copy", () => {
    expect(tFamily("en", "pageTitle")).toBe("Ladder — your child's development");
    expect(tFamily("es", "pageTitle")).toBe("Ladder — el desarrollo de tu hijo o hija");
    expect(tFamily("en", "demoBadge")).toBe("UKHCI Ladder · concept demo — not an official service");
    expect(tFamily("es", "demoBadge")).toBe("UKHCI Ladder · demo conceptual — no es un servicio oficial");
    expect(tFamily("en", "interviewCount", { count: 42, max: 5000 })).toBe("42 of 5000 characters");
    expect(familyStrings.en.intro).toMatch(/cannot say what your child has/i);
    expect(familyStrings.en.intro).toMatch(/cannot decide what you qualify for/i);
    expect(familyStrings.es.intro).toMatch(/no podemos decir qu[eé] tiene/i);
    expect(familyStrings.en.timelineDemoControlIntro).toMatch(/does not change the clock on your device/i);
  });

  it("addresses the caregiver directly instead of describing them in the third person", () => {
    const rationales = Object.entries(familyStrings.en).filter(([key]) => key.startsWith("rationale"));
    expect(rationales).not.toHaveLength(0);
    for (const [, copy] of rationales) {
      expect(copy).not.toMatch(/the caregiver/i);
      expect(copy).toMatch(/^You /);
    }
  });
});
