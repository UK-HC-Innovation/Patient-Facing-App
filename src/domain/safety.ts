import { screenCrisisRedFlags, type CrisisScreeningResult } from "./crisis-red-flags";

export type SafetyClassification = {
  level: "allowed" | "escalate" | "blocked";
  response: string;
};

// The public F4 crisis symbol: deterministic self-harm / acute-danger / vision
// red-flag screening that the safety gate and voice gate run before anything
// else. `classifySafety` stays a 3-level classifier because reading-note
// consumers depend on its exact semantics.
export function classifyCrisis(input: string): CrisisScreeningResult {
  return screenCrisisRedFlags(input);
}

const medicationChangePatterns = [
  /stop taking/i,
  /change my dose/i,
  /double my dose/i,
  /skip my medicine/i,
  /take extra/i,
  /should i increase my dose/i,
  /increase my dose/i,
  /can i take two/i,
  /stop for a day/i,
  /\bstop\b[^.?!]{0,30}\b(lisinopril|medicine|medication|pill|pills|dose|it)\b/i,
  /\bstop\b[^.?!]{0,30}\bfor a (day|week|while|few days)\b/i,
  /\b(pause|hold off on|quit|halve|cut back on)\b[^.?!]{0,25}\b(lisinopril|medicine|medication|pill|pills|dose)\b/i,
  /\b(come|get) off\b[^.?!]{0,20}\b(lisinopril|medicine|medication|pill|dose)\b/i,
  /\bdejar\s+de\s+tomar\b/i,
  /\b(?:suspender|suspenda|suspende|interrumpir|dejar)\b[^.?!]{0,30}\b(?:lisinopril|medicina|medicamento|pastilla|pastillas|dosis)\b/i,
  /\b(?:cambiar|cambie|duplicar|duplique|aumentar|aumente|reducir|reduzca)\b[^.?!]{0,20}\b(?:mi|la|su)?\s*dosis\b/i,
  /\b(?:puedo|debo|deberia)\s+tomar\s+(?:dos|otra|una\s+dosis\s+extra)\b/i,
  /\b(?:saltar|omitir)\b[^.?!]{0,20}\b(?:mi|la|una)?\s*(?:medicina|medicamento|pastilla|dosis)\b/i
];
const dangerousReadingWithSlashPattern = /(\d{2,3})\s*[\/\-]\s*(\d{2,3})/i;
const dangerousSystolicDiastolicPattern = /systolic\s*(?:is\s*)?(\d{2,3})\D{1,20}?diastolic\s*(?:is\s*)?(\d{2,3})/i;
type UrgentSymptomRule = {
  signal: RegExp;
  denial: RegExp;
};

// Each denial is tied to the symptom it negates. A clause such as "no chest
// pain, but I cannot breathe" must still escalate on the breathing disclosure.
const urgentSymptomRules: readonly UrgentSymptomRule[] = [
  {
    signal: /\b(?:chest\s+pain|dolor\s+(?:en|de)\s+(?:el\s+)?pecho)\b/i,
    denial:
      /\b(?:no|without|den(?:y|ies|ied)|(?:am|is|are|was|were)\s+not\s+(?:having|experiencing)|(?:do|does|did)\s+not\s+have|(?:don'?t|doesn'?t|didn'?t)\s+have|(?:have|has|had)\s+no)\s+(?:any\s+)?chest\s+pain\b|\b(?:no\s+(?:tengo|tiene|tenemos)|sin)\s+dolor\s+(?:en|de)\s+(?:el\s+)?pecho\b/i
  },
  {
    signal:
      /\b(?:i\s+(?:can'?t|cannot)\s+breathe|shortness\s+of\s+breath|trouble\s+breathing|no\s+puedo\s+respirar|me\s+falta\s+el\s+aire|falta\s+de\s+aire|dificultad\s+para\s+respirar)\b/i,
    denial:
      /\b(?:no|without|den(?:y|ies|ied)|(?:do|does|did)\s+not\s+have|(?:don'?t|doesn'?t|didn'?t)\s+have|(?:have|has|had)\s+no)\s+(?:any\s+)?(?:shortness\s+of\s+breath|trouble\s+breathing)\b|\bbreath(?:e|ing)(?:\s+is)?\s+normally\b|\b(?:no\s+(?:tengo|tiene)|sin)\s+(?:falta\s+de\s+aire|dificultad\s+para\s+respirar)\b|\b(?:puedo|puede)\s+respirar\s+bien\b/i
  },
  {
    signal: /\b(?:weakness\s+on\s+one\s+side|debilidad\s+en\s+un\s+lado)\b/i,
    denial:
      /\b(?:no|without|den(?:y|ies|ied)|(?:do|does|did)\s+not\s+have)\s+(?:any\s+)?weakness\s+on\s+one\s+side\b|\b(?:no\s+(?:tengo|tiene)|sin)\s+debilidad\s+en\s+un\s+lado\b/i
  },
  {
    signal: /\b(?:new\s+confusion|confusion\s+(?:nueva|repentina))\b/i,
    denial:
      /\b(?:no|without|den(?:y|ies|ied))\s+(?:any\s+)?new\s+confusion\b|\b(?:no|without|den(?:y|ies|ied)|(?:am|is|are|was|were)\s+not)\s+(?:newly\s+)?confused\b|\bno\s+(?:hay|tengo|tiene)\s+confusion\b/i
  },
  {
    signal: /\b(?:severe\s+headache|dolor\s+de\s+cabeza\s+(?:intenso|severo|muy\s+fuerte))\b/i,
    denial:
      /\b(?:no|without|den(?:y|ies|ied)|(?:do|does|did)\s+not\s+have)\s+(?:a\s+)?severe\s+headache\b|\b(?:no\s+(?:tengo|tiene)|sin)\s+dolor\s+de\s+cabeza\b/i
  },
  {
    signal: /\b(?:fainting|desmay(?:o|andome|andose))\b/i,
    denial:
      /\b(?:not|isn'?t|aren'?t|wasn'?t|weren'?t)\s+fainting\b|\b(?:no|without|den(?:y|ies|ied))\s+(?:any\s+)?fainting\b|\bno\s+(?:me\s+|se\s+)?(?:desmayo|esta\s+desmayando)\b/i
  }
];

function normalizeSafetyInput(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function hasUrgentSymptom(input: string): boolean {
  return urgentSymptomRules.some(({ signal, denial }) => {
    const flags = denial.flags.includes("g") ? denial.flags : `${denial.flags}g`;
    const withoutDeniedSpans = input.replace(new RegExp(denial.source, flags), " ");
    return signal.test(withoutDeniedSpans);
  });
}

// A glucose utterance only escalates when an explicit blood-sugar cue is present,
// so a bare "180" is never misread as a systolic. Severe low (<54) is a
// standalone emergency; a very high reading (>=250) escalates only alongside a
// diabetic-ketoacidosis symptom cue — a high number alone stays clinic education.
const glucoseCuePattern = /blood sugar|glucose|mg\s*\/?\s*dl|finger\s*stick|sugar (?:is|was|reading|of|at|hit)|azucar\s+en\s+(?:la\s+)?sangre|glucosa|medicion\s+de\s+azucar/i;
const dkaCuePattern = /nausea|vomit|throwing up|fruity breath|deep breathing|very thirsty|can'?t stop drinking|new confusion|confused|nauseas?|vomit(?:o|ando)|aliento afrutado|respiracion profunda|mucha sed|confusion/i;

function hasDangerousBloodPressure(systolic: number, diastolic: number): boolean {
  const plausibleReading = systolic >= 50 && systolic <= 260 && diastolic >= 20 && diastolic <= 160;

  if (!plausibleReading) {
    return false;
  }

  return systolic >= 180 || diastolic >= 120 || systolic < 90 || diastolic < 60;
}

const SPOKEN_NUMBER_WORD =
  "zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";
const SPOKEN_ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9
};
const SPOKEN_TEENS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19
};
const SPOKEN_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

function parseTwoDigitWords(words: string[]): number | null {
  if (words.length === 0) {
    return null;
  }
  let total = 0;
  for (const word of words) {
    if (SPOKEN_TEENS[word] !== undefined) total += SPOKEN_TEENS[word];
    else if (SPOKEN_TENS[word] !== undefined) total += SPOKEN_TENS[word];
    else if (SPOKEN_ONES[word] !== undefined) total += SPOKEN_ONES[word];
    else if (/^\d{1,3}$/.test(word)) total += Number(word);
    else return null;
  }
  return total;
}

function parseSpokenNumber(phrase: string): number | null {
  const words = phrase.trim().toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) {
    return null;
  }
  if (words.length === 1 && /^\d{2,3}$/.test(words[0])) {
    return Number(words[0]);
  }
  if (words.includes("hundred")) {
    const index = words.indexOf("hundred");
    const before = words.slice(0, index);
    const after = words.slice(index + 1);
    const hundreds = before.length === 0 ? 1 : before.length === 1 && SPOKEN_ONES[before[0]] !== undefined ? SPOKEN_ONES[before[0]] : NaN;
    if (Number.isNaN(hundreds)) {
      return null;
    }
    const rest = after.length === 0 ? 0 : parseTwoDigitWords(after);
    return rest === null ? null : hundreds * 100 + rest;
  }
  if (words.length >= 2 && SPOKEN_ONES[words[0]] !== undefined && SPOKEN_ONES[words[0]] <= 2) {
    const rest = parseTwoDigitWords(words.slice(1));
    return rest === null ? null : SPOKEN_ONES[words[0]] * 100 + rest;
  }
  return parseTwoDigitWords(words);
}

// Rewrites spoken blood-pressure phrases into the "S/D" digit form the numeric
// safety patterns already understand. Fixes both the live-voice path and the
// today-broken typed "200 over 130". Only rewrites when both sides parse to
// numbers, so ordinary "over" prose is left untouched.
export function normalizeSpokenReading(input: string): string {
  const numberToken = `(?:\\b(?:${SPOKEN_NUMBER_WORD})\\b|\\d{1,3})`;
  const numberPhrase = `${numberToken}(?:[\\s-]+${numberToken})*`;
  const pattern = new RegExp(`(${numberPhrase})\\s+over\\s+(${numberPhrase})`, "gi");

  return input.replace(pattern, (match: string, left: string, right: string) => {
    const systolic = parseSpokenNumber(left);
    const diastolic = parseSpokenNumber(right);
    if (systolic === null || diastolic === null) {
      return match;
    }
    return `${systolic}/${diastolic}`;
  });
}

function hasDangerousReading(input: string): boolean {
  const normalized = normalizeSpokenReading(input);
  const slashMatch = dangerousReadingWithSlashPattern.exec(normalized);

  if (slashMatch) {
    const systolic = Number.parseInt(slashMatch[1], 10);
    const diastolic = Number.parseInt(slashMatch[2], 10);

    return hasDangerousBloodPressure(systolic, diastolic);
  }

  const wordMatch = dangerousSystolicDiastolicPattern.exec(normalized);

  if (!wordMatch) {
    return false;
  }

  const systolic = Number.parseInt(wordMatch[1], 10);
  const diastolic = Number.parseInt(wordMatch[2], 10);

  return hasDangerousBloodPressure(systolic, diastolic);
}

export function extractGlucose(input: string): number | null {
  const match = input.match(/\b(\d{2,3})\b/);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

export function hasDangerousGlucose(input: string): boolean {
  const normalized = normalizeSafetyInput(input);
  if (!glucoseCuePattern.test(normalized)) {
    return false;
  }
  const value = extractGlucose(normalized);
  if (value === null || value < 20 || value > 900) {
    return false;
  }
  return value < 54 || (value >= 250 && dkaCuePattern.test(normalized));
}

export function classifySafety(input: string): SafetyClassification {
  const normalized = normalizeSafetyInput(input);
  if (
    hasUrgentSymptom(normalized) ||
    hasDangerousReading(normalized) ||
    hasDangerousGlucose(normalized)
  ) {
    return {
      level: "escalate",
      response:
        "Some signs need urgent medical attention. If this may be an emergency, seek urgent help now. I can help you summarize what is happening for your care team."
    };
  }

  if (medicationChangePatterns.some((pattern) => pattern.test(normalized))) {
    return {
      level: "blocked",
      response:
        "I cannot tell you to stop, start, or change a medication dose. I can help you write a short message to your care team with your concern, symptoms, and recent readings."
    };
  }

  return {
    level: "allowed",
    response: ""
  };
}
