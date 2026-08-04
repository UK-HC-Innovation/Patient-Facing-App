import { describe, expect, it } from "vitest";
import { familyStrings, tFamily, type FamilyStringKey } from "./family-strings";

// Spec 09's acceptance list, minus "demoBadge" and "intro": the standing
// top-of-page demo banner and the "What this tool can and cannot do"
// disclosure it partly duplicated were both removed at the owner's request.
// `interviewIntro`'s "We do not diagnose" and `resourcesIntro`'s eligibility
// caveat carry the remaining honesty content and are asserted where they live.
const TASK_7_REQUIRED_KEYS = [
  "pageTitle",
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
  "factFunctionalBurdenLabel",
  "factFunctionalBurdenValue",
  "factPendingEvaluationLabel",
  "factPendingEvaluationValue",
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
    apptOnListLine: "In this demo, you're on the list at {clinic}.",
    apptOfferQuestion: "In this demo, an evaluation opening is available. Does one of these work?",
    apptBookedLine: "Booked for {when} (demo).",
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
    apptBarriersThanks: "Thanks — in this demo, the resources below can help and the simulated visit stays booked.",
    apptBarriersNoneThanks: "Great — in this demo, we'll show reminders as the visit gets close.",
    apptReminderT14: "Demo reminder: your visit at {clinic} is in about two weeks — {when}. Still good?",
    apptReminderT3: "Demo reminder: your visit is in a few days — {when}. Still good?",
    apptReminderT1: "Demo reminder: your visit is tomorrow — {when}. Still good?",
    apptReminderConfirm: "Yes, we'll be there",
    apptReminderReschedule: "We need a different time",
    apptConfirmedLine: "Confirmed for {when} (demo).",
    apptOverdueQuestion: "Your visit date has passed. Were you able to make it?",
    apptOverdueWent: "We made it",
    apptOverdueMissed: "We couldn't make it",
    apptCompletedLine: "Glad you made it (demo). In this demo, the clinic follows up with next steps while Ladder keeps helping.",
    apptMissedLine: "Life happens — in this demo, you have not lost your place. Let's find a new time.",
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
    apptOnListLine: "En esta demo, están en la lista de {clinic}.",
    apptOfferQuestion: "En esta demo, hay un espacio para la evaluación. ¿Te sirve alguno de estos?",
    apptBookedLine: "Reservado para {when} (demo).",
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
    apptBarriersThanks: "Gracias — en esta demo, los recursos de abajo pueden ayudar y la visita simulada sigue reservada.",
    apptBarriersNoneThanks: "Genial — en esta demo, mostraremos recordatorios cuando se acerque la visita.",
    apptReminderT14: "Recordatorio de la demo: tu visita en {clinic} es en unas dos semanas — {when}. ¿Sigue en pie?",
    apptReminderT3: "Recordatorio de la demo: tu visita es en unos días — {when}. ¿Sigue en pie?",
    apptReminderT1: "Recordatorio de la demo: tu visita es mañana — {when}. ¿Sigue en pie?",
    apptReminderConfirm: "Sí, ahí estaremos",
    apptReminderReschedule: "Necesitamos otro horario",
    apptConfirmedLine: "Confirmado para {when} (demo).",
    apptOverdueQuestion: "La fecha de tu visita ya pasó. ¿Pudieron ir?",
    apptOverdueWent: "Sí fuimos",
    apptOverdueMissed: "No pudimos ir",
    apptCompletedLine: "Qué bueno que fueron (demo). En esta demo, la clínica da los próximos pasos mientras Ladder sigue ayudando.",
    apptMissedLine: "Así es la vida — en esta demo, no pierden su lugar. Busquemos una nueva fecha.",
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

  it("keeps functional-burden and pending-evaluation facts exact in both languages", () => {
    expect(tFamily("en", "factFunctionalBurdenLabel")).toBe("Impact on daily life");
    expect(tFamily("en", "factFunctionalBurdenValue")).toBe("Schoolwork is taking substantial time");
    expect(tFamily("en", "factPendingEvaluationLabel")).toBe("Evaluation status");
    expect(tFamily("en", "factPendingEvaluationValue")).toBe("Waiting for an evaluation");
    expect(tFamily("es", "factFunctionalBurdenLabel")).toBe("Impacto en la vida diaria");
    expect(tFamily("es", "factFunctionalBurdenValue")).toBe(
      "Las tareas escolares están tomando mucho tiempo"
    );
    expect(tFamily("es", "factPendingEvaluationLabel")).toBe("Estado de la evaluación");
    expect(tFamily("es", "factPendingEvaluationValue")).toBe("Esperando una evaluación");
  });

  it("keeps the demo honest and interpolates family copy", () => {
    expect(tFamily("en", "pageTitle")).toBe("Ladder — your child's development");
    expect(tFamily("es", "pageTitle")).toBe("Ladder — el desarrollo de tu hijo o hija");
    expect(tFamily("en", "interviewCount", { count: 42, max: 5000 })).toBe("42 of 5000 characters");
    // The standing demo banner and its "what this tool can and cannot do"
    // disclosure are gone; these are the lines now carrying that honesty.
    expect(familyStrings.en.interviewIntro).toMatch(/we do not diagnose/i);
    expect(familyStrings.es.interviewIntro).toMatch(/no diagnosticamos/i);
    expect(familyStrings.en.resourcesIntro).toMatch(/program's own page/i);
    expect(familyStrings.en.timelineDemoControlIntro).toMatch(/does not change the clock on your device/i);
  });

  it("keeps the appointment loop copy complete and exact in both languages", () => {
    for (const language of ["en", "es"] as const) {
      for (const [key, copy] of Object.entries(APPOINTMENT_COPY[language])) {
        expect(familyStrings[language][key as FamilyStringKey]).toBe(copy);
      }
    }
    expect(tFamily("en", "apptOnListLine", { clinic: "UK Developmental Pediatrics" })).toBe(
      "In this demo, you're on the list at UK Developmental Pediatrics."
    );
    expect(tFamily("es", "apptBookedLine", { when: "mañana" })).toBe("Reservado para mañana (demo).");
    for (const key of [
      "apptOnListLine",
      "apptOfferQuestion",
      "apptBookedLine",
      "apptBarriersThanks",
      "apptBarriersNoneThanks",
      "apptReminderT14",
      "apptReminderT3",
      "apptReminderT1",
      "apptConfirmedLine",
      "apptCompletedLine",
      "apptMissedLine"
    ] satisfies FamilyStringKey[]) {
      expect(familyStrings.en[key]).toMatch(/demo/i);
      expect(familyStrings.es[key]).toMatch(/demo/i);
    }
  });

  it("writes its own singular for every counted string, in both languages", () => {
    expect(tFamily("en", "waitChipNotesOne", { count: 1 })).toBe("1 note");
    expect(tFamily("es", "waitChipNotesOne", { count: 1 })).toBe("1 nota");
    expect(tFamily("en", "waitChipStepsOne", { count: 1 })).toBe("1 step in motion");
    expect(tFamily("es", "waitChipStepsOne", { count: 1 })).toBe("1 paso en marcha");
    expect(tFamily("en", "journalMonthNoteOne", { month: "July 2026", count: 1 })).toBe(
      "July 2026 — 1 note"
    );
    expect(tFamily("es", "journalMonthNoteOne", { month: "julio de 2026", count: 1 })).toBe(
      "julio de 2026 — 1 nota"
    );
    expect(tFamily("en", "seeAllResourcesOne", { count: 1 })).toBe("See the 1 place below");
    expect(tFamily("es", "seeAllResourcesOne", { count: 1 })).toBe("Ver el 1 lugar de abajo");

    // Each pair really is a pair: the singular says something different, and the
    // plural is still the one that carries the plural noun.
    const PAIRS = [
      ["waitChipNotesOne", "waitChipNotes"],
      ["waitChipStepsOne", "waitChipSteps"],
      ["journalMonthNoteOne", "journalMonthNote"],
      ["seeAllResourcesOne", "seeAllResources"],
      ["foldResourcesSummaryOne", "foldResourcesSummary"],
      ["foldJournalSummaryOne", "foldJournalSummary"],
      ["foldTimelineSummaryOne", "foldTimelineSummary"]
    ] satisfies Array<[FamilyStringKey, FamilyStringKey]>;
    for (const language of ["en", "es"] as const) {
      for (const [one, many] of PAIRS) {
        expect(familyStrings[language][one]).not.toBe(familyStrings[language][many]);
        expect(familyStrings[language][one]).toContain("{count}");
        expect(familyStrings[language][many]).toContain("{count}");
      }
    }
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
