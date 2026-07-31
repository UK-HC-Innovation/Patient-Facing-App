import { describe, expect, it } from "vitest";
import { SAMPLE_CAREGIVER_TEXT, SAMPLE_CAREGIVER_TEXT_ES, schoolAgeFamilyState } from "./family-fixtures";
import {
  buildMockFollowUps,
  extractFamilyInterviewMock,
  familyFactStatus,
  familyInterviewInputSchema,
  parseFamilyInterviewPayload
} from "./family-interview";
import type { DevNeedDomain } from "./types";

const validPayload = {
  facts: [{ label: "Grade", value: "fourth grade", sourceSnippet: "fourth grade" }],
  domains: [{ domain: "school_iep", rationale: "The caregiver described school concerns." }],
  followUps: [{ question: "What support has the school offered?", options: ["Nothing yet", "A meeting is planned"] }]
};

const FIXED_NOW = new Date("2026-07-30T12:00:00.000Z");

const F01_TEXT =
  "Theo is two. He says mama and no, but not much else, and he still falls a lot when he walks. His doctor said speech and physical therapy could help. I’m his grandmother and I don’t drive, so we need a ride to appointments. I need somebody to tell me who to call first.";

const L03_TEXT =
  "Maya is ten and in fifth grade. Her teacher and I are concerned about dyslexia and ADHD, but she has not been diagnosed. Reading and homework take hours, and we are waiting for an evaluation.";

describe("family interview contract", () => {
  it("accepts only text from 10 through 5000 characters", () => {
    expect(familyInterviewInputSchema.safeParse("123456789").success).toBe(false);
    expect(familyInterviewInputSchema.safeParse("1234567890").success).toBe(true);
    expect(familyInterviewInputSchema.safeParse("x".repeat(5000)).success).toBe(true);
    expect(familyInterviewInputSchema.safeParse("x".repeat(5001)).success).toBe(false);
    expect(familyInterviewInputSchema.safeParse(" ".repeat(10)).success).toBe(false);
    expect(familyInterviewInputSchema.safeParse(` ${"x".repeat(4999)} `).success).toBe(false);
  });

  it("rejects unknown top-level and nested keys plus blank required strings", () => {
    expect(parseFamilyInterviewPayload({ ...validPayload, surprise: true })).toBeNull();
    expect(
      parseFamilyInterviewPayload({
        ...validPayload,
        facts: [{ ...validPayload.facts[0], confidence: "high" }]
      })
    ).toBeNull();
    expect(
      parseFamilyInterviewPayload({
        ...validPayload,
        domains: [{ ...validPayload.domains[0], resourceName: "A catalog row" }]
      })
    ).toBeNull();
    expect(parseFamilyInterviewPayload({ ...validPayload, facts: [{ label: "", value: "x", sourceSnippet: "x" }] })).toBeNull();
    expect(parseFamilyInterviewPayload({ ...validPayload, facts: [{ label: "x", value: "", sourceSnippet: "x" }] })).toBeNull();
    expect(parseFamilyInterviewPayload({ ...validPayload, facts: [{ label: "x", value: "x", sourceSnippet: "" }] })).toBeNull();
  });

  it("rejects domains outside the developmental need enum", () => {
    expect(
      parseFamilyInterviewPayload({
        ...validPayload,
        domains: [{ domain: "made_up", rationale: "No." }]
      })
    ).toBeNull();
  });

  it("enforces the strict follow-up question contract", () => {
    expect(parseFamilyInterviewPayload({ ...validPayload, followUps: ["What support has the school offered?"] })).toBeNull();
    expect(
      parseFamilyInterviewPayload({
        ...validPayload,
        followUps: Array.from({ length: 4 }, (_, index) => ({ question: `Question ${index}?`, options: [] }))
      })
    ).toBeNull();
    expect(
      parseFamilyInterviewPayload({
        ...validPayload,
        followUps: [{ question: "Question?", options: ["1", "2", "3", "4", "5"] }]
      })
    ).toBeNull();
    expect(
      parseFamilyInterviewPayload({
        ...validPayload,
        followUps: [{ question: "q".repeat(201), options: [] }]
      })
    ).toBeNull();
    expect(
      parseFamilyInterviewPayload({
        ...validPayload,
        followUps: [{ question: "Question?", options: ["o".repeat(61)] }]
      })
    ).toBeNull();
    expect(
      parseFamilyInterviewPayload({
        ...validPayload,
        followUps: [{ question: "Question?", options: [], advice: "Do this" }]
      })
    ).toBeNull();
  });
});

describe("deterministic family interview extraction", () => {
  it("uses Theo's direct words instead of a professional recommendation", () => {
    const profile = {
      childFirstName: "Theo",
      birthYear: 2024,
      birthMonth: 5,
      schoolStage: "not_school_age" as const,
      county: "Pike",
      diagnoses: []
    };
    const result = extractFamilyInterviewMock(F01_TEXT, profile, FIXED_NOW, "en");
    const talking = result.facts.find(({ label }) => label === "About talking");

    expect(result.domains.map(({ domain }) => domain)).toEqual([
      "early_intervention",
      "therapies",
      "transportation"
    ]);
    expect(talking?.sourceSnippet).toContain("mama and no");
    expect(talking?.sourceSnippet).not.toMatch(/doctor/i);
    expect(result.facts.some(({ label }) => label === "About moving")).toBe(true);
    expect(result.facts.some(({ label }) => label === "Reported diagnosis")).toBe(false);
  });

  it.each([
    [
      "The doctor says his speech is delayed. He says only a few words.",
      "en",
      "About talking",
      "He says only a few words.",
      /doctor/i
    ],
    [
      "La doctora dice que su habla está retrasada. Él dice pocas palabras.",
      "es",
      "Sobre el habla",
      "Él dice pocas palabras.",
      /doctora/i
    ]
  ] as const)(
    "keeps a clinician's words from outranking direct child speech: %s",
    (text, language, label, sourceSnippet, clinician) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const talking = result.facts.find((fact) => fact.label === label);

      expect(talking?.sourceSnippet).toBe(sourceSnippet);
      expect(talking?.sourceSnippet).not.toMatch(clinician);
    }
  );

  it("keeps Maya's burden and pending evaluation without inventing a diagnosis", () => {
    const profile = {
      childFirstName: "Maya",
      birthYear: 2016,
      schoolStage: "elementary" as const,
      county: "Fayette",
      diagnoses: []
    };
    const result = extractFamilyInterviewMock(L03_TEXT, profile, FIXED_NOW, "en");

    expect(result.domains.map(({ domain }) => domain)).toEqual(["school_iep"]);
    expect(result.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Grade", sourceSnippet: "fifth grade" }),
        expect.objectContaining({
          label: "Impact on daily life",
          sourceSnippet: "Reading and homework take hours"
        }),
        expect.objectContaining({
          label: "Evaluation status",
          sourceSnippet: "we are waiting for an evaluation."
        })
      ])
    );
    expect(
      result.facts.filter(({ label }) =>
        ["Impact on daily life", "Evaluation status"].includes(label)
      )
    ).toHaveLength(2);
    expect(result.facts.some(({ label }) => label === "Reported diagnosis")).toBe(false);
    expect(
      result.facts.every(({ sourceSnippet }) => L03_TEXT.includes(sourceSnippet))
    ).toBe(true);
  });

  it("keeps Spanish functional burden and pending-evaluation evidence", () => {
    const text =
      "La lectura y la tarea toman horas, y estamos esperando una evaluación.";
    const result = extractFamilyInterviewMock(
      text,
      {
        childFirstName: "Maya",
        birthYear: 2016,
        schoolStage: "elementary",
        county: "Fayette",
        diagnoses: []
      },
      FIXED_NOW,
      "es"
    );

    expect(result.domains.map(({ domain }) => domain)).toEqual(["school_iep"]);
    expect(result.facts).toEqual([
      {
        label: "Impacto en la vida diaria",
        value: "Las tareas escolares están tomando mucho tiempo",
        sourceSnippet: "La lectura y la tarea toman horas"
      },
      {
        label: "Estado de la evaluación",
        value: "Esperando una evaluación",
        sourceSnippet: "estamos esperando una evaluación."
      }
    ]);
  });

  it.each([
    [
      "The evaluation is not yet completed.",
      "en",
      "Evaluation status"
    ],
    [
      "La evaluación todavía no se ha completado.",
      "es",
      "Estado de la evaluación"
    ],
    [
      "The evaluation has not yet been completed.",
      "en",
      "Evaluation status"
    ],
    [
      "La evaluación aún no se ha completado.",
      "es",
      "Estado de la evaluación"
    ],
    [
      "The paperwork is not yet completed.",
      "en",
      null
    ],
    [
      "El formulario todavía no se ha completado.",
      "es",
      null
    ]
  ] as const)(
    "recognizes an evaluation that is not yet completed: %s",
    (text, language, expectedLabel) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const evaluationLabels = new Set([
        "Evaluation status",
        "Estado de la evaluación"
      ]);
      expect(
        result.facts.some(({ label }) => evaluationLabels.has(label))
      ).toBe(expectedLabel !== null);
      if (expectedLabel !== null) {
        expect(result.facts.map(({ label }) => label)).toEqual([expectedLabel]);
      }
      expect(
        result.domains.some(({ domain }) => domain === "school_iep")
      ).toBe(expectedLabel !== null);
    }
  );

  it("extracts an explicit grade and diagnosis plus a school concern quoted from the caregiver", () => {
    const profile = schoolAgeFamilyState.profile;
    expect(profile).not.toBeNull();
    const result = extractFamilyInterviewMock(SAMPLE_CAREGIVER_TEXT, profile!, new Date("2026-07-17T12:00:00Z"));

    expect(result.facts).toEqual([
      { label: "Grade", value: "second grade", sourceSnippet: "second grade" },
      {
        label: "Reported diagnosis",
        value: "dyslexia",
        sourceSnippet: "He was just diagnosed with dyslexia"
      },
      {
        label: "About school and learning",
        value: "School and learning may need support",
        sourceSnippet: "My son is in second grade and reading is really hard for him."
      }
    ]);
    expect(result.domains.map(({ domain }) => domain)).toEqual(["school_iep", "waivers_financial", "parent_support"]);
    expect(result.domains.every(({ rationale }) => !/Riley has|your child has|sounds like/i.test(rationale))).toBe(true);
    expect(result.followUps).toEqual([
      {
        question: "What has the school offered so far?",
        options: ["Nothing yet", "A meeting is planned", "An evaluation was done"]
      },
      {
        question: "Have you applied for any state programs yet?",
        options: ["Not yet", "Applied, still waiting", "Not sure"]
      },
      {
        question: "Who can take over for a few hours?",
        options: ["No one right now", "Family sometimes", "A paid helper"]
      }
    ]);
  });

  it("extracts the Spanish path with localized facts and rationales", () => {
    const result = extractFamilyInterviewMock(
      SAMPLE_CAREGIVER_TEXT_ES,
      schoolAgeFamilyState.profile!,
      new Date("2026-07-17T12:00:00Z"),
      "es"
    );

    expect(result.facts).toEqual([
      { label: "Grado", value: "segundo grado", sourceSnippet: "segundo grado" },
      {
        label: "Diagnóstico informado",
        value: "dislexia",
        sourceSnippet: "A mi hijo le diagnosticaron dislexia"
      },
      {
        label: "Sobre la escuela y el aprendizaje",
        value: "La escuela y el aprendizaje podrían necesitar apoyo",
        sourceSnippet: "Mi hijo está en segundo grado y le cuesta mucho leer."
      }
    ]);
    expect(result.domains).toEqual([
      {
        domain: "school_iep",
        rationale: "Mencionaste la escuela, un IEP o ayuda con la lectura."
      },
      {
        domain: "waivers_financial",
        rationale: "Preguntaste por exenciones o ayuda para pagar."
      },
      {
        domain: "parent_support",
        rationale: "Dijiste que te sientes abrumada o que no sabes por dónde empezar."
      }
    ]);
    expect(result.followUps).toEqual([
      {
        question: "¿Qué ha ofrecido la escuela hasta ahora?",
        options: ["Nada todavía", "Hay una reunión planeada", "Ya hicieron una evaluación"]
      },
      {
        question: "¿Has solicitado algún programa estatal?",
        options: ["Todavía no", "Solicité y sigo esperando", "No estoy seguro"]
      },
      {
        question: "¿Quién puede encargarse por unas horas?",
        options: ["Nadie por ahora", "A veces la familia", "Una persona de apoyo pagada"]
      }
    ]);
  });

  it("returns two generic orientation questions when no domain matches", () => {
    expect(extractFamilyInterviewMock("We would like some guidance.", schoolAgeFamilyState.profile!).followUps).toEqual([
      {
        question: "What part of a typical day is hardest?",
        options: ["Mornings", "Afternoons", "Bedtime"]
      },
      {
        question: "Who helps your family right now?",
        options: ["No one", "Family or friends", "A professional"]
      }
    ]);
    expect(extractFamilyInterviewMock("Nos gustaría recibir orientación.", schoolAgeFamilyState.profile!, new Date(), "es").followUps).toEqual([
      {
        question: "¿Qué parte de un día típico es la más difícil?",
        options: ["Las mañanas", "Las tardes", "La hora de dormir"]
      },
      {
        question: "¿Quién ayuda a tu familia ahora?",
        options: ["Nadie", "Familiares o amigos", "Un profesional"]
      }
    ]);
  });

  it("keeps every canned question and chip isolated to its own domain and free of organization names", () => {
    const cases: Array<{ domains: DevNeedDomain[]; allowed: DevNeedDomain[] }> = [
      { domains: ["school_iep"], allowed: ["school_iep"] },
      { domains: ["therapies"], allowed: ["therapies"] },
      { domains: ["waivers_financial"], allowed: ["waivers_financial"] },
      { domains: ["respite"], allowed: ["respite", "parent_support"] },
      { domains: [], allowed: [] }
    ];

    for (const language of ["en", "es"] as const) {
      for (const { domains, allowed } of cases) {
        const followUps = buildMockFollowUps(domains, language);
        for (const text of followUps.flatMap(({ question, options }) => [question, ...options])) {
          const rematched = extractFamilyInterviewMock(text, schoolAgeFamilyState.profile!, new Date(), language).domains.map(
            ({ domain }) => domain
          );
          expect(rematched.every((domain) => allowed.includes(domain))).toBe(true);
          expect(text).not.toMatch(/First Steps|KY-SPIN|Michelle P\.|kynect|\b211\b/i);
        }
      }
    }
  });

  it.each([
    ["necesita apoyo con el habla y terapia", ["early_intervention", "therapies"]],
    ["necesito ayuda con la escuela, el IEP y la lectura", ["school_iep"]],
    ["preguntas sobre exenciones y apoyo económico", ["waivers_financial"]],
    ["estoy agotada y necesito un descanso", ["respite", "parent_support"]],
    ["apoyo para su hermana", ["sibling_support"]],
    ["necesitamos transporte para las citas", ["transportation"]],
    ["transición a la adultez y tutela", ["future_planning"]],
    ["clubes, deportes y recreación", ["recreation"]],
    ["no sé por dónde empezar", ["parent_support"]]
  ])("maps Spanish interview %s to the required domains", (text, expected) => {
    const profile = { ...schoolAgeFamilyState.profile!, birthYear: 2024, birthMonth: 1 };
    expect(
      extractFamilyInterviewMock(text, profile, new Date("2026-07-17T12:00:00Z"), "es").domains.map(
        ({ domain }) => domain
      )
    ).toEqual(expected);
  });

  it.each([
    ["speech and talking", ["early_intervention", "therapies"]],
    ["school IEP reading", ["school_iep"]],
    ["waiver money afford", ["waivers_financial"]],
    ["I need a break and feel exhausted and overwhelmed", ["respite", "parent_support"]],
    ["support for a sibling", ["sibling_support"]],
    ["a ride and transportation", ["transportation"]],
    ["adult transition, guardianship, and ABLE", ["future_planning"]],
    ["clubs, sports, and horses", ["recreation"]]
  ])("maps %s to the required domains", (text, expected) => {
    const profile = { ...schoolAgeFamilyState.profile!, birthYear: 2024, birthMonth: 1 };
    expect(extractFamilyInterviewMock(text, profile, new Date("2026-07-17T12:00:00Z")).domains.map(({ domain }) => domain)).toEqual(expected);
  });

  it("adds early intervention for a toddler speech concern but not for an older child", () => {
    const toddler = { ...schoolAgeFamilyState.profile!, birthYear: 2024, birthMonth: 8 };
    const older = { ...schoolAgeFamilyState.profile!, birthYear: 2017, birthMonth: 8 };

    expect(extractFamilyInterviewMock("My child has trouble talking.", toddler, new Date("2026-07-17T12:00:00Z")).domains.map(({ domain }) => domain)).toEqual([
      "early_intervention",
      "therapies"
    ]);
    expect(extractFamilyInterviewMock("My child has trouble talking.", older, new Date("2026-07-17T12:00:00Z")).domains.map(({ domain }) => domain)).toEqual(["therapies"]);
  });

  it("adds early intervention only for toddler speech or talking concerns, not therapy alone", () => {
    const toddler = { ...schoolAgeFamilyState.profile!, birthYear: 2024, birthMonth: 8 };
    const now = new Date("2026-07-17T12:00:00Z");

    expect(extractFamilyInterviewMock("We need physical therapy.", toddler, now).domains.map(({ domain }) => domain)).toEqual(["therapies"]);
    expect(extractFamilyInterviewMock("We need speech therapy.", toddler, now).domains.map(({ domain }) => domain)).toEqual([
      "early_intervention",
      "therapies"
    ]);
  });

  it("does not turn a concern into a diagnosis fact", () => {
    const result = extractFamilyInterviewMock("I wonder whether this could be autism.", schoolAgeFamilyState.profile!);
    expect(result.facts).toEqual([]);
  });

  it("extracts numeric grades and Oxford-comma diagnosis lists from explicit statements", () => {
    const result = extractFamilyInterviewMock(
      "My daughter is in 4th grade. She was diagnosed with dyslexia, ADHD, and autism.",
      schoolAgeFamilyState.profile!
    );
    expect(result.facts).toEqual([
      { label: "Grade", value: "4th grade", sourceSnippet: "4th grade" },
      {
        label: "Reported diagnosis",
        value: "dyslexia, ADHD, and autism",
        sourceSnippet: "She was diagnosed with dyslexia, ADHD, and autism"
      },
      {
        label: "About school and learning",
        value: "School and learning may need support",
        sourceSnippet: "My daughter is in 4th grade."
      }
    ]);
  });

  it("extracts grade-number order and the profile child's explicit diagnosis without suffix collisions", () => {
    const profile = { ...schoolAgeFamilyState.profile!, childFirstName: "Riley" };
    expect(extractFamilyInterviewMock("Riley is in grade 4. Riley was diagnosed with dyslexia.", profile).facts).toEqual([
      { label: "Grade", value: "grade 4", sourceSnippet: "grade 4" },
      {
        label: "Reported diagnosis",
        value: "dyslexia",
        sourceSnippet: "Riley was diagnosed with dyslexia"
      },
      {
        label: "About school and learning",
        value: "School and learning may need support",
        sourceSnippet: "Riley is in grade 4."
      }
    ]);
    expect(extractFamilyInterviewMock("NotRiley was diagnosed with dyslexia.", profile).facts).toEqual([]);
  });

  it.each([
    [
      "he is almost 3 and still not saying real words. we have tried everything.",
      "About talking",
      "he is almost 3 and still not saying real words."
    ],
    [
      "My kid melts down every single morning before we leave the house.",
      "About behavior and routines",
      "My kid melts down every single morning before we leave the house."
    ],
    [
      "She is 2 and still not walking on her own.",
      "About moving",
      "She is 2 and still not walking on her own."
    ]
  ])("quotes the caregiver's own words for arbitrary concerns: %s", (text, label, snippet) => {
    const facts = extractFamilyInterviewMock(text, schoolAgeFamilyState.profile!).facts;
    const concern = facts.find((fact) => fact.label === label);

    expect(concern).toBeDefined();
    expect(concern!.sourceSnippet).toBe(snippet);
    // A verbatim quote is what earns the "From your words" badge rather than "Our guess".
    expect(familyFactStatus(concern!.sourceSnippet, text)).toBe("patient_reported");
  });

  it("caps concern facts at two and never invents a snippet the caregiver did not write", () => {
    const text =
      "Reading is hard for him at school. He barely talks. He melts down at bedtime. He still cannot walk up stairs.";
    const facts = extractFamilyInterviewMock(text, schoolAgeFamilyState.profile!).facts;
    const concerns = facts.filter((fact) => fact.label.startsWith("About "));

    expect(concerns).toHaveLength(2);
    for (const concern of concerns) {
      expect(text).toContain(concern.sourceSnippet);
    }
  });

  it("escapes punctuation in a profile child name before diagnosis matching", () => {
    const profile = { ...schoolAgeFamilyState.profile!, childFirstName: "Ri.ley" };
    expect(extractFamilyInterviewMock("Ri.ley was diagnosed with ADHD.", profile).facts).toEqual([
      {
        label: "Reported diagnosis",
        value: "ADHD",
        sourceSnippet: "Ri.ley was diagnosed with ADHD"
      }
    ]);
  });

  it("treats hyphenated child names as whole names instead of suffix matches", () => {
    const annProfile = { ...schoolAgeFamilyState.profile!, childFirstName: "Ann" };
    const joAnnProfile = { ...schoolAgeFamilyState.profile!, childFirstName: "Jo-Ann" };
    const text = "Jo-Ann was diagnosed with ADHD.";

    expect(extractFamilyInterviewMock(text, annProfile).facts).toEqual([]);
    expect(extractFamilyInterviewMock(text, joAnnProfile).facts).toEqual([
      {
        label: "Reported diagnosis",
        value: "ADHD",
        sourceSnippet: "Jo-Ann was diagnosed with ADHD"
      }
    ]);
  });
});

describe("family fact evidence", () => {
  it("marks only a nonempty case-sensitive verbatim substring as patient reported", () => {
    expect(familyFactStatus("fourth grade", "She is in fourth grade.")).toBe("patient_reported");
    expect(familyFactStatus("Fourth grade", "She is in fourth grade.")).toBe("inferred");
    expect(familyFactStatus("", "She is in fourth grade.")).toBe("inferred");
    expect(familyFactStatus("invented", "She is in fourth grade.")).toBe("inferred");
  });
});
