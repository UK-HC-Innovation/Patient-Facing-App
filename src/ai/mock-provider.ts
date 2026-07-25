import { openLocalCoachSession } from "./local-coach-session";
import { gradeStringKey } from "@/domain/dr-triage";
import { tScreening } from "@/i18n/strings";
import type { HomeReading, IdentifiedFood, Medication } from "@/domain/types";
import type {
  HealthAiProvider,
  HealthAiRequest,
  HealthAiResponse,
  LiveSessionHandle,
  LiveSessionInit
} from "./types";

const ACE_ARB_NAMES = [
  "lisinopril",
  "enalapril",
  "ramipril",
  "benazepril",
  "losartan",
  "valsartan",
  "olmesartan",
  "spironolactone",
  "eplerenone",
  "amiloride",
  "triamterene"
];

const SALT_SUBSTITUTE_PATTERN = /salt substitute|lite salt|potassium chloride|no.?salt/i;

const EYE_REPORT_ASK_PATTERN =
  /eye (report|screening|result|check|photo)|retinopathy|reporte de (mis )?ojos|examen de (mis )?ojos|chequeo de ojos/i;

function findAceInhibitor(medications: Medication[]): Medication | null {
  return (
    medications.find((medication) =>
      ACE_ARB_NAMES.some((name) => medication.name.toLowerCase().includes(name))
    ) ?? null
  );
}

function getLatestReadingId(readings: HomeReading[]): string | null {
  if (readings.length === 0) {
    return null;
  }
  return [...readings].sort(
    (a, b) => new Date(b.measuredAt).valueOf() - new Date(a.measuredAt).valueOf()
  )[0].id;
}

function buildWhyAnswer(medication: Medication): string {
  return `${medication.name} is in your plan because ${medication.purpose} ${medication.preventionBenefit} Blood pressure and blood sugar can cause harm even when you feel fine. ${medication.safetyNote}`;
}

function buildTroubleAnswer(patientInput: string): string {
  if (/cost|afford|expensive|price/i.test(patientInput)) {
    return "Ask your pharmacy or care team whether a lower-cost generic, a longer refill, or an assistance program could help you stay on the prescribed plan. They can tell you which option fits your medicine and coverage.";
  }

  if (/ran out|refill|pharmacy|pick.?up|fill/i.test(patientInput)) {
    return "Contact your pharmacy or care team and tell them the medicine name and what kept the refill from happening. Ask what to do next rather than changing the plan on your own.";
  }

  if (/forgot|remember|routine/i.test(patientInput)) {
    return "Choose one daily cue you already do, such as breakfast or brushing your teeth, and place a reminder there. If a dose was already missed and you are unsure what to do, ask your pharmacist or care team.";
  }

  if (/confus|scared|afraid|worried/i.test(patientInput)) {
    return "Write down what feels confusing or scary and share those words with your care team. They can explain the plan and answer the concern without you changing the medicine on your own.";
  }

  return "Tell me what got in the way — for example cost, a refill problem, forgetting, confusion, or a concern about how you felt — and I can help turn it into a question for your care team.";
}

function buildFoodAnswer(food: IdentifiedFood | undefined, aceMedication: Medication | null): string {
  if (!food) {
    return "Point your camera at any food and ask me about it — for example how many carbs or how much sodium it has — and I'll tell you how it fits your plan.";
  }

  const label = food.brand ? `${food.brand} ${food.name}` : food.name;
  const sodium = food.nutrition?.sodiumMg ?? null;
  const parts: string[] = [];

  if (sodium !== null) {
    const percent = Math.round((sodium / 1500) * 100);
    parts.push(`${label} has ${sodium} mg of sodium — about ${percent}% of your daily target.`);
    if (percent >= 30) {
      parts.push("That is a lot in one serving, and your recent readings are trending up, so a lower-sodium option would be a better pick.");
    }
  } else {
    parts.push(`I could not read the sodium for ${label}, so treat this as an estimate.`);
  }

  const potassium = food.nutrition?.potassiumMg ?? null;
  const looksLikeSaltSubstitute = SALT_SUBSTITUTE_PATTERN.test(`${label} ${food.category ?? ""}`);
  if (aceMedication && (looksLikeSaltSubstitute || (potassium !== null && potassium >= 400))) {
    parts.push(`Because you take ${aceMedication.name}, check with your care team before using high-potassium salt substitutes.`);
  }

  return parts.join(" ");
}

export class MockHealthAiProvider implements HealthAiProvider {
  async respond(request: HealthAiRequest): Promise<HealthAiResponse> {
    const lowercasedInput = request.patientInput.toLowerCase();
    const requestedMedication = request.state.medications.find((medication) =>
      lowercasedInput.includes(medication.name.toLowerCase())
    );
    const hasSingleMedication = request.state.medications.length === 1;
    const medication = requestedMedication ?? (hasSingleMedication ? request.state.medications[0] : null);

    if (request.mode === "food") {
      const content = buildFoodAnswer(request.identifiedFood, findAceInhibitor(request.state.medications));
      const sources = [request.state.carePlan.id];
      // The trend sentence cites the readings it summarizes, so grounding sees the
      // reading behind "your recent readings are trending up".
      if (/recent readings are trending up/i.test(content)) {
        const latestReadingId = getLatestReadingId(request.state.readings);
        if (latestReadingId) {
          sources.push(latestReadingId);
        }
      }
      return {
        content,
        safety: "allowed",
        sources
      };
    }

    // "What did my eye report say?" answers strictly from the confirmed
    // screening result — the LOCKED copy with the report date, cited so the
    // grounding verifier can check it.
    if (EYE_REPORT_ASK_PATTERN.test(lowercasedInput)) {
      const latestResult = request.state.screeningResults.at(-1);
      const language = request.state.patient.language;
      if (latestResult) {
        const gradeCopy = tScreening(
          language,
          gradeStringKey({
            grade: latestResult.grade,
            dmePresent: latestResult.dmePresent,
            ungradable: latestResult.outcome === "ungradable"
          })
        );
        return {
          content: tScreening(language, "coachReportAnswer", {
            date: new Date(latestResult.confirmedAt).toLocaleDateString(language === "es" ? "es-US" : "en-US"),
            gradeCopy
          }),
          safety: "allowed",
          sources: [latestResult.id]
        };
      }
      return {
        content:
          language === "es"
            ? "Todavía no tengo un reporte de examen de ojos confirmado en tus registros. Cuando confirmes uno, puedo decirte exactamente qué dice."
            : "I don't have a confirmed eye screening report in your records yet. Once you confirm one, I can tell you exactly what it says.",
        safety: "allowed",
        sources: []
      };
    }

    if (request.mode === "why") {
      if (!medication && !hasSingleMedication) {
        return {
          content:
            "I see multiple medications in your plan. Please tell me which one you mean, for example by name, and I can explain that one.",
          safety: "allowed",
          sources: []
        };
      }

      if (medication) {
        return {
          content: buildWhyAnswer(medication),
          safety: "allowed",
          sources: [medication.id]
        };
      }
    }

    if (request.mode === "trouble") {
      return {
        content: buildTroubleAnswer(request.patientInput),
        safety: "allowed",
        sources: [request.state.carePlan.id]
      };
    }

    if (request.mode === "today" && /forgot|remember|routine/i.test(request.patientInput)) {
      return {
        content: buildTroubleAnswer(request.patientInput),
        safety: "allowed",
        sources: [request.state.carePlan.id]
      };
    }

    if (request.mode === "visit") {
      return {
        content:
          "Bring your recent home readings, any missed doses, side effects, and the top question you want answered. Your plan says the next visit is to review readings and medication barriers.",
        safety: "allowed",
        sources: [request.state.carePlan.id]
      };
    }

    return {
      content: "I can help explain your plan, prepare questions, summarize readings, or organize what to share with your care team.",
      safety: "allowed",
      sources: [request.state.carePlan.id]
    };
  }

  // Route through the full safety gate (crisis + grounding) via the shared local
  // coach loop instead of calling respond directly — this closes the mock voice
  // bypass so the mock path enforces the same guarantees as the live path.
  async openLiveSession(init: LiveSessionInit): Promise<LiveSessionHandle> {
    return openLocalCoachSession(init, this);
  }
}
