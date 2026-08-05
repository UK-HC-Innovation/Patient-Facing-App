import { isFamilyFlagWithdrawn } from "./family-facts";
import { getFamilyResourceById } from "./family-resources";
import { isFamilyReportedNeed } from "./family-screen";
import type {
  ChildDiagnosis,
  DevDiagnosis,
  FamilyFact,
  FamilyInterview,
  FamilyNavigatorState
} from "./types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

export type PacketQuestion = { id: string; labelKey: FamilyStringKey };

/**
 * A fixed starter list, in print order. Custom questions belong to the
 * interview surface — the packet only carries things the family tapped.
 */
export const PACKET_QUESTIONS: readonly PacketQuestion[] = [
  { id: "results_school", labelKey: "packetQResultsSchool" },
  { id: "coordinates_next", labelKey: "packetQCoordinatesNext" },
  { id: "therapy_start", labelKey: "packetQTherapyStart" },
  { id: "waiver_effect", labelKey: "packetQWaiverEffect" },
  { id: "school_share", labelKey: "packetQSchoolShare" },
  { id: "second_visit", labelKey: "packetQSecondVisit" },
  { id: "home_help", labelKey: "packetQHomeHelp" },
  { id: "regression_meaning", labelKey: "packetQRegressionMeaning" },
  { id: "siblings_risk", labelKey: "packetQSiblingsRisk" },
  { id: "who_to_call", labelKey: "packetQWhoToCall" }
];

const DIAGNOSIS_LABEL_KEYS: Record<DevDiagnosis, FamilyStringKey> = {
  autism: "diagnosisAutism",
  adhd: "diagnosisAdhd",
  dyslexia: "diagnosisDyslexia",
  speech_language: "diagnosisSpeechLanguage",
  developmental_delay: "diagnosisDevelopmentalDelay",
  intellectual_disability: "diagnosisIntellectualDisability",
  down_syndrome: "diagnosisDownSyndrome",
  other: "diagnosisOther"
};

function locale(language: Language): string {
  return language === "es" ? "es" : "en-US";
}

// The caregiver's own words for "other" beat the generic label; everything else
// is the same catalog label the profile form showed them.
function diagnosisDisplayLabel(diagnosis: ChildDiagnosis, language: Language): string {
  const otherLabel = diagnosis.otherLabel?.trim() ?? "";
  if (diagnosis.label === "other" && otherLabel.length > 0) {
    return otherLabel;
  }
  return tFamily(language, DIAGNOSIS_LABEL_KEYS[diagnosis.label]);
}

function isoMonthLabel(timestamp: string, language: Language): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  return date.toLocaleDateString(locale(language), { month: "long", year: "numeric" });
}

function interviewMonth(
  fact: FamilyFact,
  interviews: FamilyInterview[],
  language: Language
): string {
  const interview = fact.interviewId
    ? interviews.find(({ id }) => id === fact.interviewId)
    : undefined;
  return interview ? isoMonthLabel(interview.createdAt, language) : "";
}

function factTimestamp(fact: FamilyFact, interviews: FamilyInterview[]): number | null {
  const interview = fact.interviewId
    ? interviews.find(({ id }) => id === fact.interviewId)
    : undefined;
  if (interview === undefined) {
    return null;
  }
  const value = new Date(interview.createdAt).valueOf();
  return Number.isNaN(value) ? null : value;
}

// Oldest first — the packet is a trajectory, not a feed. Undated facts (screen
// answers) trail the dated ones, and ties keep catalog order so the same state
// always renders the same string.
function sortFactsByInterviewDate(facts: FamilyFact[], interviews: FamilyInterview[]): FamilyFact[] {
  return facts
    .map((fact, index) => ({ fact, index, at: factTimestamp(fact, interviews) }))
    .sort((left, right) => {
      if (left.at === right.at) return left.index - right.index;
      if (left.at === null) return 1;
      if (right.at === null) return -1;
      return left.at - right.at;
    })
    .map(({ fact }) => fact);
}

/**
 * The visit packet as plain text, built only from on-device state: catalog
 * names, the family's stored verbatim snippets, fixed strings, and dates. No
 * model prose reaches this string, and the same state always builds the same
 * one. Nothing is sent anywhere by this function.
 */
export function buildFamilyVisitSummary(
  family: FamilyNavigatorState,
  language: Language,
  now: Date
): string {
  const t = (key: FamilyStringKey, vars?: Record<string, string | number>) =>
    tFamily(language, key, vars);
  const lines: string[] = [t("packetHeading")];

  const profile = family.profile;
  if (profile) {
    const childLine = [
      profile.childFirstName?.trim() ?? "",
      t("packetBornLine", { year: profile.birthYear }),
      profile.county
    ]
      .filter((part) => part.length > 0)
      .join(" · ");
    // Basics the app read out of the description, and nobody has confirmed yet,
    // say so on the sheet the clinician reads.
    lines.push(
      family.profileProvenance === "extracted"
        ? `${childLine} ${t("packetBasicsExtracted")}`
        : childLine
    );
    for (const diagnosis of profile.diagnoses) {
      const when = diagnosis.diagnosedAt ? ` (${diagnosis.diagnosedAt})` : "";
      lines.push(`- ${diagnosisDisplayLabel(diagnosis, language)}${when}`);
    }
  }

  // "Our guess" facts stay in the journal but never print: the packet is
  // testimony, not inference. Neither does anything the caregiver has marked
  // wrong — that is them saying we misheard them, and the packet is what they
  // said (F2c).
  const included = family.facts.filter(
    (fact) =>
      fact.includeInSummary !== false && fact.status !== "inferred" && fact.status !== "rejected"
  );
  // Everything in quotation marks below is a caregiver sentence, verbatim. A fact
  // with no interview behind it came from the yes/no screen, where the "source"
  // is our own question — those print as label and value, never quoted, and a no
  // or a decline is not something we noticed, so it does not print at all.
  const noticedLines = sortFactsByInterviewDate(included, family.interviews).flatMap((fact) => {
    if (fact.interviewId === undefined) {
      return isFamilyReportedNeed(fact.value) ? [`- ${fact.label}: ${fact.value}`] : [];
    }
    const when = interviewMonth(fact, family.interviews, language);
    return [`- ${when.length > 0 ? `${when}: ` : ""}"${fact.sourceSnippet}"`];
  });
  if (noticedLines.length > 0) {
    lines.push("", t("packetNoticedHeading"), ...noticedLines);
  }

  // Every flag belongs in the packet, acknowledged or not — the clinic wants the
  // history, not just what is still blinking on the phone. Except one a
  // caregiver has retracted: when every sentence behind it has been marked
  // wrong, "Possible loss of skills" was our reading of words they say we
  // misheard, and it comes out of the printed sheet (F2c).
  const standingFlags = family.flags.filter((flag) => !isFamilyFlagWithdrawn(flag, family.facts));
  if (standingFlags.length > 0) {
    lines.push("", t("packetFlagsHeading"));
    for (const flag of standingFlags) {
      lines.push(`- ${t("packetFlagRegression", { month: isoMonthLabel(flag.raisedAt, language) })}`);
    }
  }

  const inMotion = family.steps.filter(
    ({ status }) => status === "in_touch" || status === "enrolled"
  );
  if (inMotion.length > 0) {
    const serviceLines = inMotion.flatMap((step) => {
      const resource = getFamilyResourceById(step.resourceId);
      if (resource === undefined) {
        return [];
      }
      const status = t(step.status === "enrolled" ? "packetStatusEnrolled" : "packetStatusInTouch");
      return [`- ${resource.name} — ${status} (${isoMonthLabel(step.updatedAt, language)})`];
    });
    if (serviceLines.length > 0) {
      lines.push("", t("packetServicesHeading"), ...serviceLines);
    }
  }

  const picked = PACKET_QUESTIONS.filter(({ id }) => family.packetQuestionIds.includes(id));
  if (picked.length > 0) {
    lines.push("", t("packetQuestionsHeading"));
    for (const question of picked) {
      lines.push(`- ${t(question.labelKey)}`);
    }
  }

  if (family.appointments.some((appointment) => appointment.barriers.includes("ride"))) {
    lines.push("", t("packetRideLine"));
  }

  lines.push("", t("packetFooter", { date: now.toLocaleDateString(locale(language)) }));
  return lines.join("\n");
}
