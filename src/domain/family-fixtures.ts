import type { FamilyNavigatorState } from "./types";

// Ordinary caregiver wording for tests that need submittable interview text.
// Test-only — the app never pre-fills the interview box, and there is no
// scripted demo family behind these fixtures.
export const SAMPLE_CAREGIVER_TEXT =
  "My son is in second grade and reading is really hard for him. He was just diagnosed with dyslexia. I don't know what to ask the school for, and money is tight so I keep hearing about waivers but have no idea where to start.";

export const SAMPLE_CAREGIVER_TEXT_ES =
  "Mi hijo está en segundo grado y le cuesta mucho leer. A mi hijo le diagnosticaron dislexia. No sé qué pedirle a la escuela y el dinero está escaso, sigo escuchando sobre exenciones pero no tengo idea de por dónde empezar.";

/** School-age child in Scott County with two dated diagnoses. */
export const schoolAgeFamilyState: FamilyNavigatorState = {
  profile: {
    childFirstName: "Riley",
    birthYear: 2017,
    schoolStage: "elementary",
    county: "Scott",
    diagnoses: [
      { id: "fixture-diagnosis-dyslexia", label: "dyslexia", diagnosedAt: "2026-05" },
      { id: "fixture-diagnosis-adhd", label: "adhd", diagnosedAt: "2026-05" }
    ]
  },
  referral: null,
  appointments: [],
  safetyEvents: [],
  recommendations: null,
  interviewDraft: "",
  screenAnswers: [],
  interviews: [],
  facts: [],
  latestInterviewDomains: [],
  activeDomains: [],
  saved: [],
  alreadyEnrolled: []
};

export function eighteenMonthFamilyState(now: Date): FamilyNavigatorState {
  if (Number.isNaN(now.valueOf())) {
    throw new RangeError("A valid timestamp is required for the 18-month family fixture.");
  }
  const birth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 18, 1));
  return {
    profile: {
      childFirstName: "Avery",
      birthYear: birth.getUTCFullYear(),
      birthMonth: birth.getUTCMonth() + 1,
      schoolStage: "not_school_age",
      county: "Fayette",
      diagnoses: []
    },
    referral: null,
    appointments: [],
    safetyEvents: [],
    recommendations: null,
    interviewDraft: "",
    screenAnswers: [],
    interviews: [],
    facts: [],
    latestInterviewDomains: [],
    activeDomains: [],
    saved: [],
    alreadyEnrolled: []
  };
}
