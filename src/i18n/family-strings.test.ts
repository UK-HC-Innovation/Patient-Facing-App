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

const APPOINTMENT_COPY = {
  en: {
    apptSectionTitle: "Your evaluation visit",
    apptSectionIntro: "Ladder walks with you from the waitlist to the visit — booking, getting ready, and solving anything that could get in the way.",
    apptJoinDemoBody: "This demo pretends your child is on the UK Developmental Pediatrics waitlist. Nothing here is a real appointment.",
    apptJoinDemoCta: "Show me (demo)",
    apptOnListLine: "You're on the list at {clinic}.",
    apptOfferQuestion: "An evaluation opening is available. Does one of these work?",
    apptBookedLine: "Booked for {when}.",
    apptPrepTitle: "How to get ready",
    apptPrepBullet1: "Bring any school papers, past evaluations, and a list of what you have noticed.",
    apptPrepBullet2: "The visit can take a few hours. Your child can bring something that helps them feel calm.",
    apptPrepBullet3: "You know your child best. Your answers are a big part of the evaluation.",
    apptPrepSource: "Learn more: CDC, \"Learn the Signs. Act Early.\"",
    apptBarriersQuestion: "Is there anything that could make it hard to get to this visit?",
    apptBarrierRide: "We need a ride",
    apptBarrierSiblings: "Someone to watch the other kids",
    apptBarrierWork: "Hard to get time off work",
    apptBarrierNone: "We're all set",
    apptBarriersThanks: "Thanks — the resources below can help with that. Your visit stays booked either way.",
    apptBarriersNoneThanks: "Great — we'll remind you as the visit gets close.",
    apptReminderT14: "Your visit at {clinic} is in about two weeks — {when}. Still good?",
    apptReminderT3: "Your visit is in a few days — {when}. Still good?",
    apptReminderT1: "Your visit is tomorrow — {when}. Still good?",
    apptReminderConfirm: "Yes, we'll be there",
    apptReminderReschedule: "We need a different time",
    apptConfirmedLine: "Confirmed. See you {when}.",
    apptOverdueQuestion: "Your visit date has passed. Were you able to make it?",
    apptOverdueWent: "We made it",
    apptOverdueMissed: "We couldn't make it",
    apptCompletedLine: "Glad you made it. The clinic will follow up with next steps, and Ladder keeps helping in the meantime.",
    apptMissedLine: "Life happens — you have not lost your place. Let's find a new time.",
    apptRebookCta: "Find a new time",
    apptDemoControlsTitle: "Demo: move the visit closer",
    apptDemoTwoWeeks: "About 2 weeks away",
    apptDemoFewDays: "A few days away",
    apptDemoTomorrow: "Tomorrow",
    apptDemoPassed: "Date passed",
    apptSafetyHold: "Paused while the safety message above is open."
  },
  es: {
    apptSectionTitle: "Tu visita de evaluación",
    apptSectionIntro: "Ladder te acompaña desde la lista de espera hasta la visita: reservar, prepararte y resolver lo que pueda estorbar.",
    apptJoinDemoBody: "Esta demo supone que tu hijo o hija está en la lista de espera de UK Developmental Pediatrics. Nada de esto es una cita real.",
    apptJoinDemoCta: "Muéstrame (demo)",
    apptOnListLine: "Están en la lista de {clinic}.",
    apptOfferQuestion: "Hay un espacio para la evaluación. ¿Te sirve alguno de estos?",
    apptBookedLine: "Reservado para {when}.",
    apptPrepTitle: "Cómo prepararte",
    apptPrepBullet1: "Lleva papeles de la escuela, evaluaciones anteriores y una lista de lo que has notado.",
    apptPrepBullet2: "La visita puede durar unas horas. Tu hijo o hija puede llevar algo que le ayude a sentirse en calma.",
    apptPrepBullet3: "Tú conoces mejor a tu hijo o hija. Tus respuestas son una parte importante de la evaluación.",
    apptPrepSource: "Aprende más: CDC, \"Learn the Signs. Act Early.\" (en inglés)",
    apptBarriersQuestion: "¿Hay algo que dificulte llegar a esta visita?",
    apptBarrierRide: "Necesitamos transporte",
    apptBarrierSiblings: "Alguien que cuide a los otros niños",
    apptBarrierWork: "Es difícil pedir permiso en el trabajo",
    apptBarrierNone: "Estamos listos",
    apptBarriersThanks: "Gracias — los recursos de abajo pueden ayudar con eso. Tu visita sigue reservada de todos modos.",
    apptBarriersNoneThanks: "Genial — te recordaremos cuando se acerque la visita.",
    apptReminderT14: "Tu visita en {clinic} es en unas dos semanas — {when}. ¿Sigue en pie?",
    apptReminderT3: "Tu visita es en unos días — {when}. ¿Sigue en pie?",
    apptReminderT1: "Tu visita es mañana — {when}. ¿Sigue en pie?",
    apptReminderConfirm: "Sí, ahí estaremos",
    apptReminderReschedule: "Necesitamos otro horario",
    apptConfirmedLine: "Confirmado. Nos vemos {when}.",
    apptOverdueQuestion: "La fecha de tu visita ya pasó. ¿Pudieron ir?",
    apptOverdueWent: "Sí fuimos",
    apptOverdueMissed: "No pudimos ir",
    apptCompletedLine: "Qué bueno que fueron. La clínica les dará los próximos pasos, y Ladder sigue ayudando mientras tanto.",
    apptMissedLine: "Así es la vida — no perdieron su lugar. Busquemos una nueva fecha.",
    apptRebookCta: "Buscar nueva fecha",
    apptDemoControlsTitle: "Demo: acerca la visita",
    apptDemoTwoWeeks: "A unas 2 semanas",
    apptDemoFewDays: "A unos días",
    apptDemoTomorrow: "Mañana",
    apptDemoPassed: "La fecha pasó",
    apptSafetyHold: "En pausa mientras el mensaje de seguridad de arriba esté abierto."
  }
} as const;

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

  it("keeps the appointment loop copy complete and exact in both languages", () => {
    for (const language of ["en", "es"] as const) {
      for (const [key, copy] of Object.entries(APPOINTMENT_COPY[language])) {
        expect(familyStrings[language][key as FamilyStringKey]).toBe(copy);
      }
    }
    expect(tFamily("en", "apptOnListLine", { clinic: "UK Developmental Pediatrics" })).toBe(
      "You're on the list at UK Developmental Pediatrics."
    );
    expect(tFamily("es", "apptBookedLine", { when: "mañana" })).toBe("Reservado para mañana.");
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
