import type { AppState } from "./types";
import { DEFAULT_DOSE_REMINDER } from "./reminders";

export const demoState: AppState = {
  patient: {
    id: "patient-1",
    name: "Jordan Taylor",
    preferredName: "Jordan",
    language: "en",
    primaryClinicName: "Bluegrass Primary Care",
    primaryClinicPhone: "555-0142",
    accessibilityPreferences: ["large_text"]
  },
  carePlan: {
    id: "plan-1",
    patientId: "patient-1",
    condition: "hypertension",
    plainLanguageSummary: "You are working on keeping blood pressure in a safer range at home so your heart, brain, and kidneys have less strain over time.",
    goals: [
      {
        id: "goal-1",
        label: "Understand my blood pressure",
        reason: "Knowing your usual range helps you and your care team spot changes earlier."
      },
      {
        id: "goal-2",
        label: "Take medicines with confidence",
        reason: "Blood pressure medicine can help even when you do not feel symptoms."
      }
    ],
    dailyActions: ["Check blood pressure in the morning before coffee.", "Take blood pressure medicine as prescribed.", "Write down dizziness, swelling, chest pain, or missed doses."],
    callThresholdSystolic: 160,
    callThresholdDiastolic: 100,
    thresholdSource: "clinician_authored",
    warningSymptoms: ["chest pain", "shortness of breath", "weakness on one side", "new confusion", "severe headache"],
    nextVisitReason: "Review two weeks of home blood pressure readings and medication barriers."
  },
  medications: [
    {
      id: "med-1",
      patientId: "patient-1",
      name: "Lisinopril",
      dose: "10 mg",
      schedule: "Once daily",
      purpose: "Helps lower blood pressure.",
      preventionBenefit: "Lower blood pressure can reduce the chance of stroke, heart attack, kidney problems, and heart strain.",
      safetyNote: "Do not stop or change the dose without asking your clinician.",
      source: "patient_reported",
      activeBarriers: []
    }
  ],
  readings: [
    {
      id: "reading-1",
      patientId: "patient-1",
      systolic: 132,
      diastolic: 84,
      pulse: 72,
      measuredAt: "2026-07-02T07:15:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-2",
      patientId: "patient-1",
      systolic: 141,
      diastolic: 88,
      pulse: 75,
      measuredAt: "2026-07-03T07:05:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-3",
      patientId: "patient-1",
      systolic: 149,
      diastolic: 94,
      pulse: 78,
      measuredAt: "2026-07-04T07:20:00.000Z",
      contexts: ["morning"],
      note: ""
    }
  ],
  glucoseReadings: [],
  tasks: [],
  contextItems: [],
  extractedFacts: [],
  aiMessages: [],
  auditEvents: [],
  mealLog: [],
  doseEvents: [
    {
      id: "dose-1",
      patientId: "patient-1",
      medicationId: "med-1",
      date: "2026-07-03",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-03T08:00:00.000Z"
    },
    {
      id: "dose-2",
      patientId: "patient-1",
      medicationId: "med-1",
      date: "2026-07-04",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-04T08:05:00.000Z"
    }
  ],
  doseReminder: { ...DEFAULT_DOSE_REMINDER },
  medicationFills: [],
  assessmentEvents: [],
  screeningGaps: [
    {
      id: "gap-demo-dr",
      condition: "diabetes",
      status: "overdue",
      lastScreeningDate: "2024-12-01"
    }
  ],
  screeningResults: [],
  referrals: [],
  recallReminders: [],
  family: null
};

export const deletedDemoState: AppState = {
  patient: {
    id: "patient-deleted",
    name: "Deleted demo data",
    preferredName: "Demo",
    language: "en",
    primaryClinicName: "Care team",
    primaryClinicPhone: ""
  },
  carePlan: {
    id: "plan-deleted",
    patientId: "patient-deleted",
    condition: "hypertension",
    plainLanguageSummary: "Demo data has been deleted. Add new instructions or readings to start again.",
    goals: [],
    dailyActions: [],
    callThresholdSystolic: null,
    callThresholdDiastolic: null,
    thresholdSource: "standard_education",
    warningSymptoms: [],
    nextVisitReason: "Add care context to prepare for a future visit."
  },
  medications: [],
  readings: [],
  glucoseReadings: [],
  tasks: [],
  contextItems: [],
  extractedFacts: [],
  aiMessages: [],
  auditEvents: [],
  mealLog: [],
  doseEvents: [],
  doseReminder: { ...DEFAULT_DOSE_REMINDER },
  medicationFills: [],
  assessmentEvents: [],
  screeningGaps: [],
  screeningResults: [],
  referrals: [],
  recallReminders: [],
  family: null
};

/**
 * The state /compass runs on.
 *
 * The root layout wraps every route in HealthStateProvider, which seeds a full demo
 * patient with medications and blood-pressure readings. A shareable food-scoring page
 * that touched that state would leak a fictional patient into its prompts, so /compass
 * builds this instead: no medications, no readings, no history, and a care plan that
 * exists only because grounding requires the provider to cite a carePlan.id before any
 * clinical-adjacent phrasing is allowed through.
 */
export function blankCompassState(): AppState {
  return {
    ...deletedDemoState,
    patient: {
      id: "compass-anonymous",
      name: "Guest",
      preferredName: "there",
      language: "en",
      primaryClinicName: "Your care team",
      primaryClinicPhone: ""
    },
    carePlan: {
      ...deletedDemoState.carePlan,
      id: "plan-compass",
      patientId: "compass-anonymous",
      plainLanguageSummary:
        "This preview scores foods with the published Food Compass 2.0 system. It holds no personal health information.",
      nextVisitReason: "Talk with your own care team about what these scores mean for you."
    },
    medications: [],
    readings: [],
    glucoseReadings: [],
    aiMessages: [],
    mealLog: []
  };
}

export const brentState: AppState = {
  patient: {
    id: "patient-brent",
    name: "Brent Wright",
    preferredName: "Brent",
    language: "en",
    primaryClinicName: "Elkhorn Creek Family Medicine",
    primaryClinicPhone: "555-0173",
    county: "Perry"
  },
  carePlan: {
    id: "plan-brent",
    patientId: "patient-brent",
    condition: "hypertension",
    conditions: ["hypertension", "diabetes"],
    plainLanguageSummary:
      "You are working to keep your blood pressure in a safer range at home and keep your blood sugar steadier. Doing both protects your heart, brain, kidneys, and eyes over time. This plan follows what your care team wrote down for you — it does not replace their advice.",
    goals: [
      {
        id: "goal-brent-bp",
        label: "Understand my blood pressure",
        reason: "Knowing your usual morning range helps you and your care team spot changes early, before they become a problem."
      },
      {
        id: "goal-brent-meds",
        label: "Take my medicines with confidence",
        reason: "Your blood pressure and blood sugar medicines help even on days you feel fine. If cost or remembering gets in the way, your care team can help find options."
      },
      {
        id: "goal-brent-sugar",
        label: "Keep my blood sugar steadier",
        reason: "Your last A1c was 8.0%. Taking metformin as prescribed and watching sugary drinks can help bring that number down over time."
      }
    ],
    dailyActions: [
      "Check your blood pressure in the morning before coffee.",
      "Take your blood pressure and diabetes medicines as prescribed.",
      "Go easy on canned foods and sugary drinks.",
      "Write down any missed doses, dizziness, swelling, or chest pain."
    ],
    callThresholdSystolic: 160,
    callThresholdDiastolic: 100,
    callThresholdGlucoseLow: 54,
    callThresholdGlucoseHigh: 300,
    thresholdSource: "clinician_authored",
    warningSymptoms: ["chest pain", "shortness of breath", "weakness on one side", "new confusion", "severe headache"],
    nextVisitReason: "Review two weeks of morning blood pressure readings, the medication cost barrier, and follow up on the 8.0% A1c and metformin."
  },
  medications: [
    {
      id: "med-lisinopril",
      patientId: "patient-brent",
      name: "Lisinopril",
      dose: "10 mg",
      schedule: "Once daily",
      purpose: "Helps relax your blood vessels so your blood pressure comes down.",
      preventionBenefit: "Keeping blood pressure lower protects your heart, brain, and kidneys over time — even on days you feel fine.",
      safetyNote: "Do not use salt substitutes or potassium pills unless your care team says it is okay. Do not stop or change the dose on your own. Call your clinic if you get a dry cough that will not go away, or any swelling of the lips or face.",
      source: "imported",
      activeBarriers: []
    },
    {
      id: "med-amlodipine",
      patientId: "patient-brent",
      name: "Amlodipine",
      dose: "5 mg",
      schedule: "Once daily",
      purpose: "Helps open up your blood vessels to lower your blood pressure.",
      preventionBenefit: "Works together with your other blood pressure medicine to lower the strain on your heart and lower your risk of stroke.",
      safetyNote: "Some people get puffy, swollen ankles on this medicine. Tell your care team if that happens — do not stop it on your own.",
      source: "imported",
      activeBarriers: []
    },
    {
      id: "med-metformin",
      patientId: "patient-brent",
      name: "Metformin",
      dose: "500 mg",
      schedule: "Twice daily",
      purpose: "Helps your body handle blood sugar and keeps it from running too high.",
      preventionBenefit: "Steadier blood sugar lowers your risk of harm to your eyes, nerves, and kidneys over the years.",
      safetyNote: "Take it with food to avoid an upset stomach. If you miss a dose, do not double up — just take the next one. Ask your care team before stopping, and tell them if cost is making it hard to refill.",
      source: "imported",
      activeBarriers: ["cost"]
    }
  ],
  readings: [
    {
      id: "reading-brent-1",
      patientId: "patient-brent",
      systolic: 128,
      diastolic: 79,
      pulse: 70,
      measuredAt: "2026-06-22T07:10:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-brent-2",
      patientId: "patient-brent",
      systolic: 131,
      diastolic: 80,
      pulse: 72,
      measuredAt: "2026-06-23T07:05:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: ""
    },
    {
      id: "reading-brent-3",
      patientId: "patient-brent",
      systolic: 130,
      diastolic: 82,
      pulse: 68,
      measuredAt: "2026-06-24T07:20:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-brent-4",
      patientId: "patient-brent",
      systolic: 134,
      diastolic: 83,
      pulse: 74,
      measuredAt: "2026-06-25T07:00:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-brent-5",
      patientId: "patient-brent",
      systolic: 129,
      diastolic: 78,
      pulse: 71,
      measuredAt: "2026-06-26T07:15:00.000Z",
      contexts: ["morning", "after_resting"],
      note: "Slept well."
    },
    {
      id: "reading-brent-6",
      patientId: "patient-brent",
      systolic: 136,
      diastolic: 85,
      pulse: 73,
      measuredAt: "2026-06-27T07:25:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-brent-7",
      patientId: "patient-brent",
      systolic: 138,
      diastolic: 86,
      pulse: 75,
      measuredAt: "2026-06-28T07:05:00.000Z",
      contexts: ["morning", "after_coffee"],
      note: "Had coffee first by mistake."
    },
    {
      id: "reading-brent-8",
      patientId: "patient-brent",
      systolic: 133,
      diastolic: 82,
      pulse: 70,
      measuredAt: "2026-06-29T07:10:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: ""
    },
    {
      id: "reading-brent-9",
      patientId: "patient-brent",
      systolic: 140,
      diastolic: 88,
      pulse: 76,
      measuredAt: "2026-06-30T07:00:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-brent-10",
      patientId: "patient-brent",
      systolic: 142,
      diastolic: 89,
      pulse: 77,
      measuredAt: "2026-07-01T07:20:00.000Z",
      contexts: ["morning", "after_coffee"],
      note: "Salty dinner last night."
    },
    {
      id: "reading-brent-11",
      patientId: "patient-brent",
      systolic: 139,
      diastolic: 87,
      pulse: 74,
      measuredAt: "2026-07-02T07:05:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-brent-12",
      patientId: "patient-brent",
      systolic: 145,
      diastolic: 90,
      pulse: 78,
      measuredAt: "2026-07-03T07:15:00.000Z",
      contexts: ["morning"],
      note: ""
    },
    {
      id: "reading-brent-13",
      patientId: "patient-brent",
      systolic: 150,
      diastolic: 94,
      pulse: 80,
      measuredAt: "2026-07-04T07:10:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: "Higher this morning. Still under my call line."
    }
  ],
  glucoseReadings: [
    {
      id: "glucose-brent-1",
      patientId: "patient-brent",
      valueMgDl: 168,
      measuredAt: "2026-06-29T07:05:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: "Fasting."
    },
    {
      id: "glucose-brent-2",
      patientId: "patient-brent",
      valueMgDl: 172,
      measuredAt: "2026-06-30T07:00:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: ""
    },
    {
      id: "glucose-brent-3",
      patientId: "patient-brent",
      valueMgDl: 165,
      measuredAt: "2026-07-01T07:15:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: ""
    },
    {
      id: "glucose-brent-4",
      patientId: "patient-brent",
      valueMgDl: 158,
      measuredAt: "2026-07-02T07:05:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: "Cut out the evening soda."
    },
    {
      id: "glucose-brent-5",
      patientId: "patient-brent",
      valueMgDl: 149,
      measuredAt: "2026-07-03T07:10:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: ""
    },
    {
      id: "glucose-brent-6",
      patientId: "patient-brent",
      valueMgDl: 152,
      measuredAt: "2026-07-04T07:05:00.000Z",
      contexts: ["morning", "before_medicine"],
      note: ""
    },
    {
      id: "glucose-brent-pm-pancakes",
      patientId: "patient-brent",
      valueMgDl: 214,
      measuredAt: "2026-07-01T09:00:00.000Z",
      contexts: ["after_medicine"],
      note: "About an hour after pancakes and syrup."
    },
    {
      id: "glucose-brent-pm-eggs",
      patientId: "patient-brent",
      valueMgDl: 150,
      measuredAt: "2026-07-01T13:15:00.000Z",
      contexts: ["after_medicine"],
      note: "About an hour after eggs."
    },
    {
      id: "glucose-brent-pm-rice",
      patientId: "patient-brent",
      valueMgDl: 208,
      measuredAt: "2026-07-02T19:30:00.000Z",
      contexts: ["after_medicine"],
      note: "After a big rice dinner."
    },
    {
      id: "glucose-brent-pm-salad",
      patientId: "patient-brent",
      valueMgDl: 145,
      measuredAt: "2026-07-02T13:30:00.000Z",
      contexts: ["after_medicine"],
      note: ""
    },
    {
      id: "glucose-brent-pm-soda",
      patientId: "patient-brent",
      valueMgDl: 220,
      measuredAt: "2026-07-03T13:30:00.000Z",
      contexts: ["after_medicine"],
      note: "About an hour after a regular soda."
    },
    {
      id: "glucose-brent-pm-chicken",
      patientId: "patient-brent",
      valueMgDl: 152,
      measuredAt: "2026-07-04T19:00:00.000Z",
      contexts: ["after_medicine"],
      note: "After grilled chicken and greens."
    }
  ],
  tasks: [],
  contextItems: [
    {
      id: "context-brent-avs",
      patientId: "patient-brent",
      title: "After-visit summary",
      rawText:
        "Visit summary for Brent Wright. Blood pressure moderately controlled. Plan: monitor blood pressure every morning at home and bring the log to your next visit. Continue lisinopril 10 mg once daily as prescribed. Start amlodipine 5 mg once daily. For type 2 diabetes, A1c today is 8.0% — continue metformin 500 mg twice daily and cut back on sugary drinks. Follow up in 6 weeks. Call the clinic for chest pain, shortness of breath, weakness on one side, new confusion, or a severe headache.",
      sourceLabel: "Elkhorn Creek Family Medicine",
      createdAt: "2026-06-20T16:30:00.000Z"
    },
    {
      id: "context-brent-labs",
      patientId: "patient-brent",
      title: "Lab results",
      rawText:
        "Laboratory results for Brent Wright. Hemoglobin A1c 8.0% (goal under 7%). Fasting glucose 152 mg/dL. Kidney function normal. Potassium 4.2 mmol/L, within normal range. Continue current diabetes medicine and recheck A1c in about three months.",
      sourceLabel: "Elkhorn Creek Family Medicine",
      createdAt: "2026-06-19T14:00:00.000Z"
    }
  ],
  extractedFacts: [
    {
      id: "fact-brent-1",
      contextItemId: "context-brent-avs",
      label: "Home blood pressure",
      value: "Check every morning",
      confidence: "high",
      status: "needs_review",
      sourceSnippet: "monitor blood pressure every morning at home and bring the log to your next visit"
    },
    {
      id: "fact-brent-2",
      contextItemId: "context-brent-avs",
      label: "Lisinopril",
      value: "Continue 10 mg once daily",
      confidence: "high",
      status: "needs_review",
      sourceSnippet: "Continue lisinopril 10 mg once daily as prescribed"
    },
    {
      id: "fact-brent-3",
      contextItemId: "context-brent-avs",
      label: "Metformin",
      value: "Continue 500 mg twice daily",
      confidence: "high",
      status: "needs_review",
      sourceSnippet: "continue metformin 500 mg twice daily and cut back on sugary drinks"
    },
    {
      id: "fact-brent-4",
      contextItemId: "context-brent-avs",
      label: "Follow-up visit",
      value: "In 6 weeks",
      confidence: "medium",
      status: "needs_review",
      sourceSnippet: "Follow up in 6 weeks"
    },
    {
      id: "fact-brent-5",
      contextItemId: "context-brent-labs",
      label: "A1c",
      value: "8.0%",
      confidence: "high",
      status: "needs_review",
      sourceSnippet: "Hemoglobin A1c 8.0% (goal under 7%)"
    }
  ],
  aiMessages: [],
  auditEvents: [
    {
      id: "audit-brent-1",
      patientId: "patient-brent",
      action: "created",
      label: "Added your after-visit summary to care context",
      createdAt: "2026-06-20T16:35:00.000Z"
    },
    {
      id: "audit-brent-2",
      patientId: "patient-brent",
      action: "updated",
      label: "Recorded a skipped metformin dose (cost)",
      createdAt: "2026-06-29T20:31:00.000Z"
    }
  ],
  mealLog: [
    {
      id: "meal-brent-cola",
      patientId: "patient-brent",
      loggedAt: "2026-06-26T12:30:00.000Z",
      food: {
        id: "food-brent-cola",
        barcode: "049000050110",
        name: "Cola, regular (20 oz bottle)",
        brand: null,
        category: "Soft drinks",
        nutrition: {
          servingSize: "1 bottle (591 mL)",
          calories: 240,
          sodiumMg: 45,
          potassiumMg: 0,
          totalSugarsG: 65,
          addedSugarsG: 65,
          saturatedFatG: 0,
          fiberG: 0,
          proteinG: 0,
          carbsG: 65,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "barcode_off",
        ingredientText: null
      },
      flags: ["65 g added sugars — 260% of your 25 g daily limit"],
      assistantSummary:
        "This bottle has about 65 g of added sugar — more than two days' worth. Sugary drinks raise blood sugar fast. Water or unsweetened tea is an easier swap most days."
    },
    {
      id: "meal-brent-banana",
      patientId: "patient-brent",
      loggedAt: "2026-06-27T15:00:00.000Z",
      food: {
        id: "food-brent-banana",
        barcode: null,
        name: "Banana, medium",
        brand: null,
        category: "Fresh fruit",
        nutrition: {
          servingSize: "1 medium (118 g)",
          calories: 105,
          sodiumMg: 1,
          potassiumMg: 422,
          totalSugarsG: 14,
          addedSugarsG: 0,
          saturatedFatG: 0.1,
          fiberG: 3.1,
          proteinG: 1,
          carbsG: 27,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "vision_estimate",
        ingredientText: null
      },
      flags: [
        "High in potassium — check with your care team first because you take Lisinopril",
        "3.1 g fiber — good for your heart"
      ],
      assistantSummary:
        "A banana is a wholesome snack with good fiber. It is also high in potassium. Because you take Lisinopril, it is smart to ask your care team how much potassium is right for you before making it a daily habit."
    },
    {
      id: "meal-brent-oatmeal",
      patientId: "patient-brent",
      loggedAt: "2026-06-28T07:45:00.000Z",
      food: {
        id: "food-brent-oatmeal",
        barcode: null,
        name: "Oatmeal with blueberries",
        brand: null,
        category: "Hot cereal",
        nutrition: {
          servingSize: "1 bowl (about 1.5 cups)",
          calories: 220,
          sodiumMg: 8,
          potassiumMg: 260,
          totalSugarsG: 9,
          addedSugarsG: 0,
          saturatedFatG: 0.7,
          fiberG: 6,
          proteinG: 7,
          carbsG: 40,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "vision_estimate",
        ingredientText: null
      },
      flags: ["6 g fiber — good for your heart"],
      assistantSummary:
        "Oatmeal with berries is a heart-friendly choice. The fiber is good for your blood pressure and helps you feel full. It is low in salt with no added sugar — a solid start to the day."
    },
    {
      id: "meal-brent-soup",
      patientId: "patient-brent",
      loggedAt: "2026-07-04T12:15:00.000Z",
      food: {
        id: "food-brent-soup",
        barcode: "051000012616",
        name: "Chicken noodle soup, canned",
        brand: null,
        category: "Canned soup",
        nutrition: {
          servingSize: "1 cup (240 mL)",
          calories: 180,
          sodiumMg: 890,
          potassiumMg: 200,
          totalSugarsG: 3,
          addedSugarsG: 1,
          saturatedFatG: 1.5,
          fiberG: 2,
          proteinG: 9,
          carbsG: 22,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "barcode_off",
        ingredientText: null
      },
      flags: [
        "890 mg sodium — 59% of your 1500 mg daily limit",
        "Your recent readings are trending up — extra reason to go easy on salt this week"
      ],
      assistantSummary:
        "One cup of this canned soup has 890 mg of sodium — over half a day's salt. Too much salt can push blood pressure up. Try a low-sodium version, or use half the seasoning packet and add water."
    },
    {
      id: "meal-brent-pancakes",
      patientId: "patient-brent",
      loggedAt: "2026-07-01T08:00:00.000Z",
      food: {
        id: "food-brent-pancakes",
        barcode: null,
        name: "Pancakes with syrup",
        brand: null,
        category: "Breakfast",
        nutrition: {
          servingSize: "3 pancakes with syrup",
          calories: 350,
          sodiumMg: 550,
          potassiumMg: 200,
          totalSugarsG: 18,
          addedSugarsG: 12,
          saturatedFatG: 3,
          fiberG: 2,
          proteinG: 8,
          carbsG: 55,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "vision_estimate",
        ingredientText: null
      },
      flags: ["55 g carbs — 28% of your 200 g daily limit"],
      assistantSummary:
        "Pancakes with syrup are high in fast carbs, which tend to push blood sugar up. If you enjoy them, a smaller stack with some protein on the side is gentler.",
      compassScore: { fcs: 24, band: "minimize", tier: "T1" }
    },
    {
      id: "meal-brent-eggs",
      patientId: "patient-brent",
      loggedAt: "2026-07-01T12:15:00.000Z",
      food: {
        id: "food-brent-eggs",
        barcode: null,
        name: "Scrambled eggs",
        brand: null,
        category: "Eggs",
        nutrition: {
          servingSize: "2 eggs",
          calories: 180,
          sodiumMg: 380,
          potassiumMg: 140,
          totalSugarsG: 1,
          addedSugarsG: 0,
          saturatedFatG: 3,
          fiberG: 0,
          proteinG: 12,
          carbsG: 6,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "vision_estimate",
        ingredientText: null
      },
      flags: [],
      assistantSummary:
        "Eggs are low in carbs and a good source of protein — an easy choice that keeps blood sugar steadier.",
      compassScore: { fcs: 55, band: "moderate", tier: "T1" }
    },
    {
      id: "meal-brent-rice",
      patientId: "patient-brent",
      loggedAt: "2026-07-02T18:30:00.000Z",
      food: {
        id: "food-brent-rice",
        barcode: null,
        name: "White rice, large bowl",
        brand: null,
        category: "Grains",
        nutrition: {
          servingSize: "1.5 cups cooked",
          calories: 300,
          sodiumMg: 400,
          potassiumMg: 55,
          totalSugarsG: 0,
          addedSugarsG: 0,
          saturatedFatG: 0.5,
          fiberG: 1,
          proteinG: 6,
          carbsG: 50,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "vision_estimate",
        ingredientText: null
      },
      flags: ["50 g carbs — 25% of your 200 g daily limit"],
      assistantSummary:
        "A big bowl of white rice is a lot of fast carbs at once. Half the rice with more vegetables, or brown rice, keeps the same meal gentler on your blood sugar.",
      compassScore: { fcs: 28, band: "minimize", tier: "T1" }
    },
    {
      id: "meal-brent-salad",
      patientId: "patient-brent",
      loggedAt: "2026-07-02T12:30:00.000Z",
      food: {
        id: "food-brent-salad",
        barcode: null,
        name: "Garden salad with chicken",
        brand: null,
        category: "Salads",
        nutrition: {
          servingSize: "1 bowl",
          calories: 260,
          sodiumMg: 300,
          potassiumMg: 400,
          totalSugarsG: 5,
          addedSugarsG: 0,
          saturatedFatG: 2,
          fiberG: 5,
          proteinG: 20,
          carbsG: 15,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "vision_estimate",
        ingredientText: null
      },
      flags: ["5 g fiber — good for your heart"],
      assistantSummary:
        "A salad with lean protein is low in carbs and high in fiber — a steady choice for blood sugar.",
      compassScore: { fcs: 76, band: "encourage", tier: "T1" }
    },
    {
      id: "meal-brent-soda",
      patientId: "patient-brent",
      loggedAt: "2026-07-03T12:30:00.000Z",
      food: {
        id: "food-brent-soda",
        barcode: "049000050110",
        name: "Regular soda (can)",
        brand: null,
        category: "Soft drinks",
        nutrition: {
          servingSize: "1 can (355 mL)",
          calories: 150,
          sodiumMg: 40,
          potassiumMg: 0,
          totalSugarsG: 39,
          addedSugarsG: 39,
          saturatedFatG: 0,
          fiberG: 0,
          proteinG: 0,
          carbsG: 60,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "barcode_off",
        ingredientText: null
      },
      flags: ["39 g added sugars — 156% of your 25 g daily limit"],
      assistantSummary:
        "A regular soda is fast sugar with nothing to slow it down, so blood sugar climbs quickly. Water or unsweetened tea is the easier everyday swap.",
      compassScore: { fcs: 12, band: "minimize", tier: "T1" }
    },
    {
      id: "meal-brent-chicken",
      patientId: "patient-brent",
      loggedAt: "2026-07-04T18:00:00.000Z",
      food: {
        id: "food-brent-chicken",
        barcode: null,
        name: "Grilled chicken and greens",
        brand: null,
        category: "Dinner",
        nutrition: {
          servingSize: "1 plate",
          calories: 320,
          sodiumMg: 350,
          potassiumMg: 500,
          totalSugarsG: 3,
          addedSugarsG: 0,
          saturatedFatG: 4,
          fiberG: 4,
          proteinG: 35,
          carbsG: 12,
          totalFatG: null,
          monoFatG: null,
          polyFatG: null,
          transFatG: null,
          cholesterolMg: null,
          calciumMg: null,
          ironMg: null,
          servingGrams: null,
          basis: "per_serving"
        },
        source: "vision_estimate",
        ingredientText: null
      },
      flags: ["4 g fiber — good for your heart"],
      assistantSummary:
        "Grilled chicken with greens is low in carbs and filling — the kind of dinner that keeps blood sugar steadier overnight.",
      compassScore: { fcs: 72, band: "encourage", tier: "T1" }
    }
  ],
  doseEvents: [
    {
      id: "dose-brent-1",
      patientId: "patient-brent",
      medicationId: "med-lisinopril",
      date: "2026-06-27",
      status: "taken",
      barrier: null,
      recordedAt: "2026-06-27T08:05:00.000Z"
    },
    {
      id: "dose-brent-2",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      date: "2026-06-27",
      status: "taken",
      barrier: null,
      recordedAt: "2026-06-27T08:05:00.000Z"
    },
    {
      id: "dose-brent-3",
      patientId: "patient-brent",
      medicationId: "med-lisinopril",
      date: "2026-06-28",
      status: "taken",
      barrier: null,
      recordedAt: "2026-06-28T07:55:00.000Z"
    },
    {
      id: "dose-brent-4",
      patientId: "patient-brent",
      medicationId: "med-amlodipine",
      date: "2026-06-28",
      status: "taken",
      barrier: null,
      recordedAt: "2026-06-28T07:55:00.000Z"
    },
    {
      id: "dose-brent-5",
      patientId: "patient-brent",
      medicationId: "med-lisinopril",
      date: "2026-06-29",
      status: "taken",
      barrier: null,
      recordedAt: "2026-06-29T08:10:00.000Z"
    },
    {
      id: "dose-brent-6",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      date: "2026-06-29",
      status: "skipped",
      barrier: "cost",
      recordedAt: "2026-06-29T20:30:00.000Z"
    },
    {
      id: "dose-brent-7",
      patientId: "patient-brent",
      medicationId: "med-lisinopril",
      date: "2026-06-30",
      status: "taken",
      barrier: null,
      recordedAt: "2026-06-30T08:00:00.000Z"
    },
    {
      id: "dose-brent-8",
      patientId: "patient-brent",
      medicationId: "med-amlodipine",
      date: "2026-06-30",
      status: "taken",
      barrier: null,
      recordedAt: "2026-06-30T08:00:00.000Z"
    },
    {
      id: "dose-brent-9",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      date: "2026-06-30",
      status: "taken",
      barrier: null,
      recordedAt: "2026-06-30T08:00:00.000Z"
    },
    {
      id: "dose-brent-10",
      patientId: "patient-brent",
      medicationId: "med-lisinopril",
      date: "2026-07-01",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-01T08:15:00.000Z"
    },
    {
      id: "dose-brent-11",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      date: "2026-07-01",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-01T08:15:00.000Z"
    },
    {
      id: "dose-brent-12",
      patientId: "patient-brent",
      medicationId: "med-lisinopril",
      date: "2026-07-02",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-02T07:50:00.000Z"
    },
    {
      id: "dose-brent-13",
      patientId: "patient-brent",
      medicationId: "med-amlodipine",
      date: "2026-07-02",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-02T07:50:00.000Z"
    },
    {
      id: "dose-brent-metformin-0702",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      date: "2026-07-02",
      status: "skipped",
      barrier: "cost",
      recordedAt: "2026-07-02T20:30:00.000Z"
    },
    {
      id: "dose-brent-14",
      patientId: "patient-brent",
      medicationId: "med-lisinopril",
      date: "2026-07-03",
      status: "skipped",
      barrier: "forgot",
      recordedAt: "2026-07-03T12:00:00.000Z"
    },
    {
      id: "dose-brent-15",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      date: "2026-07-03",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-03T08:05:00.000Z"
    },
    {
      id: "dose-brent-16",
      patientId: "patient-brent",
      medicationId: "med-lisinopril",
      date: "2026-07-04",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-04T08:00:00.000Z"
    },
    {
      id: "dose-brent-17",
      patientId: "patient-brent",
      medicationId: "med-amlodipine",
      date: "2026-07-04",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-04T08:00:00.000Z"
    },
    {
      id: "dose-brent-18",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      date: "2026-07-04",
      status: "taken",
      barrier: null,
      recordedAt: "2026-07-04T08:00:00.000Z"
    }
  ],
  doseReminder: { ...DEFAULT_DOSE_REMINDER },
  medicationFills: [
    {
      id: "fill-brent-metformin-1",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      medicationName: "Metformin",
      dateOfService: "2026-01-05",
      daysSupply: 30,
      source: "patient_reported"
    },
    {
      id: "fill-brent-metformin-2",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      medicationName: "Metformin",
      dateOfService: "2026-02-20",
      daysSupply: 30,
      source: "patient_reported"
    },
    {
      id: "fill-brent-metformin-3",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      medicationName: "Metformin",
      dateOfService: "2026-04-10",
      daysSupply: 30,
      source: "patient_reported"
    },
    {
      id: "fill-brent-metformin-4",
      patientId: "patient-brent",
      medicationId: "med-metformin",
      medicationName: "Metformin",
      dateOfService: "2026-06-01",
      daysSupply: 30,
      source: "patient_reported"
    }
  ],
  assessmentEvents: [],
  screeningGaps: [
    {
      id: "gap-brent-dr",
      condition: "diabetes",
      status: "overdue",
      lastScreeningDate: "2024-12-01"
    }
  ],
  screeningResults: [],
  referrals: [],
  recallReminders: [],
  family: null
};

export const defaultDemoState: AppState = brentState;
