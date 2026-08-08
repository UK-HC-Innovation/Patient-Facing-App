import { describe, expect, it } from "vitest";
import { schoolAgeFamilyState } from "./family-fixtures";
import { PACKET_QUESTIONS, buildFamilyVisitSummary } from "./family-visit-packet";
import type {
  FamilyAppointment,
  FamilyFact,
  FamilyInterview,
  FamilyNavigatorState,
  FamilyResourceStep
} from "./types";

const NOW = new Date("2026-07-17T12:00:00.000Z");

function interview(id: string, createdAt: string): FamilyInterview {
  return {
    id,
    rawText: "Note text for the packet fixture.",
    source: "typed",
    createdAt,
    extraction: "mock",
    kind: "note"
  };
}

function fact(id: string, overrides: Partial<FamilyFact> = {}): FamilyFact {
  return {
    id,
    label: "What we noticed",
    value: "reading is hard",
    status: "patient_reported",
    sourceSnippet: "reading is really hard for him",
    ...overrides
  };
}

function step(overrides: Partial<FamilyResourceStep> = {}): FamilyResourceStep {
  const plannedAt = overrides.plannedAt ?? overrides.updatedAt ?? "2026-05-04T12:00:00.000Z";
  return {
    id: "step-1",
    resourceId: "first_steps_statewide",
    domain: "early_intervention",
    status: "in_touch",
    plannedAt,
    updatedAt: plannedAt,
    ...overrides
  };
}

function appointment(overrides: Partial<FamilyAppointment> = {}): FamilyAppointment {
  return {
    id: "appointment-1",
    clinic: "UK Developmental Pediatrics",
    offeredSlots: [],
    status: "booked",
    barriers: [],
    barriersAsked: true,
    reminderAcks: [],
    createdAt: "2026-06-01T12:00:00.000Z",
    ...overrides
  };
}

/** Every section populated, so one fixture exercises the whole builder. */
const fatFamily: FamilyNavigatorState = {
  ...schoolAgeFamilyState,
  interviews: [
    interview("interview-may", "2026-05-09T12:00:00.000Z"),
    interview("interview-june", "2026-06-12T12:00:00.000Z")
  ],
  facts: [
    fact("fact-june", {
      interviewId: "interview-june",
      sourceSnippet: "he stopped asking for help at school"
    }),
    fact("fact-may", {
      interviewId: "interview-may",
      sourceSnippet: "reading is really hard for him"
    }),
    fact("fact-guess", {
      interviewId: "interview-may",
      status: "inferred",
      sourceSnippet: "maybe he needs an IEP"
    }),
    fact("fact-excluded", {
      interviewId: "interview-june",
      includeInSummary: false,
      sourceSnippet: "I said that wrong"
    }),
    // Screen rows carry no interview: their "source" is the app's own question.
    fact("fact-screen-yes", {
      label: "Family need — Respite",
      value: "Reported a need",
      sourceSnippet: "Would a break from caregiving or respite support help your family?"
    }),
    fact("fact-screen-no", {
      label: "Family need — Transportation",
      value: "No need reported",
      sourceSnippet: "Does transportation make it hard to get to services or appointments?"
    }),
    fact("fact-screen-declined", {
      label: "Family need — Therapies",
      value: "Declined to answer",
      sourceSnippet: "Would help finding speech, occupational, physical, or behavioral therapies be useful?"
    })
  ],
  flags: [
    { id: "flag-1", type: "regression", source: "probe", raisedAt: "2026-06-20T12:00:00.000Z" }
  ],
  steps: [
    step({ id: "step-first-steps", status: "in_touch", updatedAt: "2026-06-02T12:00:00.000Z" }),
    step({
      id: "step-waiver",
      resourceId: "michelle_p_waiver",
      domain: "waivers_financial",
      status: "enrolled",
      updatedAt: "2026-07-01T12:00:00.000Z"
    }),
    step({
      id: "step-planned",
      resourceId: "ky_spin",
      domain: "parent_support",
      status: "planned",
      updatedAt: "2026-07-05T12:00:00.000Z"
    })
  ],
  appointments: [appointment({ barriers: ["ride"] })],
  packetQuestionIds: ["who_to_call", "results_school"]
};

describe("PACKET_QUESTIONS", () => {
  // F5 dropped "Should the siblings be checked too?" from the starter list:
  // offering it unprompted raises the possibility that a second child has a
  // problem, to a caregiver who came about the first one.
  it("is a fixed list of nine uniquely-identified starter questions", () => {
    expect(PACKET_QUESTIONS).toHaveLength(9);
    expect(PACKET_QUESTIONS.map(({ id }) => id)).not.toContain("siblings_risk");
    expect(new Set(PACKET_QUESTIONS.map(({ id }) => id)).size).toBe(9);
    expect(new Set(PACKET_QUESTIONS.map(({ labelKey }) => labelKey)).size).toBe(9);
  });
});

describe("buildFamilyVisitSummary", () => {
  it("prints only testimony — never a guess and never an excluded fact", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "en", NOW);

    expect(summary).toContain("What we noticed, over time");
    expect(summary).toContain('"reading is really hard for him"');
    expect(summary).toContain('"he stopped asking for help at school"');
    expect(summary).not.toContain("maybe he needs an IEP");
    expect(summary).not.toContain("I said that wrong");
  });

  it("dates the noticed lines by their note's month, oldest first", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "en", NOW);

    expect(summary).toContain('May 2026: "reading is really hard for him"');
    expect(summary).toContain('June 2026: "he stopped asking for help at school"');
    expect(summary.indexOf("reading is really hard")).toBeLessThan(
      summary.indexOf("he stopped asking for help")
    );
    // Screen answers carry no note and so no month; they trail the dated ones.
    expect(summary).toContain("- Family need — Respite: Reported a need");
    expect(summary.indexOf("he stopped asking for help")).toBeLessThan(
      summary.indexOf("Family need — Respite")
    );
  });

  it("quotes only sentences a caregiver actually wrote", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "en", NOW);
    const spoken = new Set(
      fatFamily.facts
        .filter(({ interviewId }) => interviewId !== undefined)
        .map(({ sourceSnippet }) => sourceSnippet)
    );
    const quoted = [...summary.matchAll(/"([^"]*)"/g)].map(([, inner]) => inner);

    expect(quoted.length).toBeGreaterThan(0);
    for (const quote of quoted) {
      expect(spoken).toContain(quote);
    }
  });

  it("prints a screen answer as label and value, never as words the family said", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "en", NOW);

    expect(summary).toContain("- Family need — Respite: Reported a need");
    // The app's own question is what the screen fact stores as its source.
    expect(summary).not.toContain("Would a break from caregiving");
    expect(summary).not.toContain('"Family need — Respite');
  });

  it("leaves out screen rows the family answered no or declined", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "en", NOW);

    expect(summary).not.toContain("Family need — Transportation");
    expect(summary).not.toContain("No need reported");
    expect(summary).not.toContain("Family need — Therapies");
    expect(summary).not.toContain("Declined to answer");
  });

  it("skips the noticed heading when every remaining fact is a screen no", () => {
    const summary = buildFamilyVisitSummary(
      {
        ...schoolAgeFamilyState,
        facts: [
          fact("fact-screen-no", {
            label: "Family need — Transportation",
            value: "No need reported",
            sourceSnippet: "Does transportation make it hard to get to services or appointments?"
          })
        ]
      },
      "en",
      NOW
    );

    expect(summary).not.toContain("What we noticed, over time");
  });

  it("carries basics, flags, services in motion, picked questions, and the footer", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "en", NOW);

    expect(summary).toContain("Our visit packet");
    expect(summary).toContain("Riley · born 2017 · Scott");
    expect(summary).toContain("- Dyslexia (2026-05)");
    expect(summary).toContain("Changes you may want to discuss");
    expect(summary).toContain("Possible loss of skills, noticed June 2026");
    expect(summary).toContain("Services already in motion");
    expect(summary).toContain("- Kentucky First Steps — in touch (June 2026)");
    expect(summary).toContain("- Michelle P. Waiver — enrolled (July 2026)");
    // Planned steps are not "in motion" yet.
    expect(summary).not.toContain("KY-SPIN Parent Center");
    expect(summary).toContain("Questions we want to ask");
    expect(summary).toContain("- What do the results mean for school?");
    expect(summary).toContain("- Who do we call with questions after today?");
    expect(summary).toContain("We may need help with transportation.");
    expect(summary).toContain("Written from our own notes in Ladder · printed 7/17/2026 · not a medical record. A clinician has not reviewed this packet.");
  });

  // The clinician reads this sheet. Basics the app read out of a description and
  // nobody has confirmed must not arrive looking like the family's own answers.
  it("flags basics nobody has checked, and stays quiet once they have", () => {
    const extracted = buildFamilyVisitSummary(
      { ...fatFamily, profileProvenance: "extracted" },
      "en",
      NOW
    );
    expect(extracted).toContain(
      "Riley · born 2017 · Scott (read from your description — please check)"
    );

    const stated = buildFamilyVisitSummary({ ...fatFamily, profileProvenance: "stated" }, "en", NOW);
    expect(stated).toContain("Riley · born 2017 · Scott");
    expect(stated).not.toContain("read from your description");
  });

  it("flags unchecked basics in Spanish too", () => {
    const summary = buildFamilyVisitSummary(
      { ...fatFamily, profileProvenance: "extracted" },
      "es",
      NOW
    );

    expect(summary).toContain("(leído de tu descripción — por favor revísalo)");
  });

  it("prints picked questions in catalog order, not pick order", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "en", NOW);

    expect(summary.indexOf("What do the results mean for school?")).toBeLessThan(
      summary.indexOf("Who do we call with questions after today?")
    );
  });

  it("hides unpicked starter questions", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "en", NOW);

    expect(summary).not.toContain("What options should we consider, and why?");
  });

  it("builds the identical string from identical state", () => {
    expect(buildFamilyVisitSummary(fatFamily, "en", NOW)).toBe(
      buildFamilyVisitSummary(fatFamily, "en", NOW)
    );
  });

  // F2c. The packet's sharpest line, and until now the only caregiver
  // affordance was acknowledging the card — the sentence printed forever.
  describe("a retracted regression", () => {
    const regressionFact = fact("fact-regression", {
      interviewId: "interview-june",
      label: "Change you noticed",
      value: "Possible loss of skills — from your words",
      sourceSnippet: "He stopped saying more at dinner."
    });
    const spoken: FamilyNavigatorState = {
      ...schoolAgeFamilyState,
      interviews: [interview("interview-june", "2026-06-20T12:00:00.000Z")],
      facts: [regressionFact],
      flags: [
        {
          id: "flag-1",
          type: "regression",
          source: "text",
          raisedAt: "2026-06-20T12:00:00.000Z",
          interviewId: "interview-june"
        }
      ]
    };

    it("prints while the family stands behind the sentence", () => {
      const summary = buildFamilyVisitSummary(spoken, "en", NOW);

      expect(summary).toContain("Changes you may want to discuss");
      expect(summary).toContain("Possible loss of skills, noticed June 2026");
    });

    it("withdraws the line, and the sentence, once the family marks it wrong", () => {
      const summary = buildFamilyVisitSummary(
        { ...spoken, facts: [{ ...regressionFact, status: "rejected" }] },
        "en",
        NOW
      );

      expect(summary).not.toContain("Changes you may want to discuss");
      expect(summary).not.toContain("Possible loss of skills");
      expect(summary).not.toContain("He stopped saying more at dinner.");
    });

    // The flag itself is history. A probe tap is not something we misheard.
    it("keeps a probe flag standing — there is no sentence to retract", () => {
      const summary = buildFamilyVisitSummary(
        {
          ...spoken,
          facts: [{ ...regressionFact, status: "rejected" }],
          flags: [{ ...spoken.flags[0], source: "probe", interviewId: undefined }]
        },
        "en",
        NOW
      );

      expect(summary).toContain("Possible loss of skills, noticed June 2026");
    });
  });

  it("skips every empty section rather than printing a bare heading", () => {
    const summary = buildFamilyVisitSummary(schoolAgeFamilyState, "en", NOW);

    expect(summary).toContain("Our visit packet");
    expect(summary).toContain("Riley · born 2017 · Scott");
    expect(summary).not.toContain("What we noticed, over time");
    expect(summary).not.toContain("Changes you may want to discuss");
    expect(summary).not.toContain("Services already in motion");
    expect(summary).not.toContain("Questions we want to ask");
    expect(summary).not.toContain("We may need help with transportation.");
    expect(summary).toContain("not a medical record. A clinician has not reviewed this packet.");
  });

  it("skips the services heading when no in-motion step resolves to a catalog entry", () => {
    const summary = buildFamilyVisitSummary(
      {
        ...schoolAgeFamilyState,
        steps: [step({ resourceId: "retired_resource", status: "enrolled" })]
      },
      "en",
      NOW
    );

    expect(summary).not.toContain("Services already in motion");
  });

  it("prints the ride line only when a ride barrier is on record", () => {
    const noRide = buildFamilyVisitSummary(
      { ...fatFamily, appointments: [appointment({ barriers: ["work_schedule"] })] },
      "en",
      NOW
    );

    expect(noRide).not.toContain("We may need help with transportation.");
  });

  it("builds the Spanish packet with Spanish headings", () => {
    const summary = buildFamilyVisitSummary(fatFamily, "es", NOW);

    expect(summary).toContain("Nuestro paquete para la visita");
    expect(summary).toContain("Lo que notamos, con el tiempo");
    expect(summary).toContain("Cambios que quizás quieras comentar");
    expect(summary).toContain("Servicios ya en marcha");
    expect(summary).toContain("Preguntas que queremos hacer");
    expect(summary).toContain("Podríamos necesitar ayuda con el transporte.");
    expect(summary).toContain("no es un expediente médico. Ningún profesional clínico ha revisado este paquete.");
    // The family's own words are never translated.
    expect(summary).toContain('"reading is really hard for him"');
  });

  it("reads a screen answer saved in Spanish the same way", () => {
    const summary = buildFamilyVisitSummary(
      {
        ...schoolAgeFamilyState,
        facts: [
          fact("fact-screen-yes-es", {
            label: "Necesidad familiar — Relevo",
            value: "Necesidad reportada",
            sourceSnippet: "¿Un descanso del cuidado o apoyo de relevo ayudaría a su familia?"
          }),
          fact("fact-screen-no-es", {
            label: "Necesidad familiar — Transporte",
            value: "No se reportó una necesidad",
            sourceSnippet: "¿El transporte dificulta llegar a servicios o citas?"
          })
        ]
      },
      "es",
      NOW
    );

    expect(summary).toContain("- Necesidad familiar — Relevo: Necesidad reportada");
    expect(summary).not.toContain("Necesidad familiar — Transporte");
    expect(summary).not.toContain('"');
  });

  it("works without a profile and without inventing a child line", () => {
    const summary = buildFamilyVisitSummary(
      { ...schoolAgeFamilyState, profile: null },
      "en",
      NOW
    );

    expect(summary).toContain("Our visit packet");
    expect(summary).not.toContain("born 2017");
  });
});
