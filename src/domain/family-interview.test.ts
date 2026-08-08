import { describe, expect, it } from "vitest";
import { SAMPLE_CAREGIVER_TEXT, SAMPLE_CAREGIVER_TEXT_ES, schoolAgeFamilyState } from "./family-fixtures";
import {
  analyzeFamilyNarrative,
  buildMockFollowUps,
  extractFamilyInterviewMock,
  familyFactStatus,
  familyInterviewInputSchema,
  parseFamilyInterviewPayload,
  reconcileFamilyInterviewResult,
  shouldRaiseFamilyRegressionFlag
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

const F06_TEXT =
  "Sam is seven. He already goes to speech and occupational therapy. I need a break sometimes, his sister needs support too, and I’d like a sports or recreation program where they both feel welcome. Reading long pages is hard for me, so please keep it short.";

const L01_TEXT =
  "Este mes la maestra dice que las transiciones siguen siendo difíciles, pero Sofía está usando más palabras con una amiga.";

const SERVICE_STATUS_CASES = [
  ["He already goes to speech and occupational therapy.", "en", "excluded_only"],
  ["Ya va a terapia del habla y terapia ocupacional.", "es", "excluded_only"],
  ["He currently receives speech and occupational therapy.", "en", "excluded_only"],
  ["Actualmente recibe terapia del habla y terapia ocupacional.", "es", "excluded_only"],
  ["He goes to speech and occupational therapy.", "en", "excluded_only"],
  ["Va a terapia del habla y terapia ocupacional.", "es", "excluded_only"],
  ["I go to speech therapy.", "en", "excluded_only"],
  ["Voy a terapia del habla.", "es", "excluded_only"],
  ["I see a speech therapist.", "en", "excluded_only"],
  ["Veo a una terapeuta del habla.", "es", "excluded_only"],
  ["I am in speech therapy.", "en", "excluded_only"],
  ["Estoy en terapia del habla.", "es", "excluded_only"],
  ["He currently needs occupational therapy.", "en", "supported"],
  ["Actualmente necesita terapia ocupacional.", "es", "supported"],
  ["My child currently needs occupational therapy.", "en", "supported"],
  ["Mi hijo actualmente necesita terapia del habla.", "es", "supported"],
  ["My child needs speech and occupational therapy.", "en", "supported"],
  ["Mi hijo necesita terapia del habla y terapia ocupacional.", "es", "supported"],
  ["We currently need speech therapy.", "en", "supported"],
  ["Actualmente necesitamos terapia del habla.", "es", "supported"],
  ["We now need speech therapy.", "en", "supported"],
  ["Ahora necesitamos terapia del habla.", "es", "supported"],
  ["He already needs occupational therapy.", "en", "supported"],
  ["Ya necesita terapia ocupacional.", "es", "supported"],
  ["He completed occupational therapy last year and does not need it now.", "en", "excluded_only"],
  ["Terminó terapia ocupacional el año pasado y ya no la necesita.", "es", "excluded_only"],
  ["His therapist stopped coming because he no longer needs therapy.", "en", "excluded_only"],
  ["Su terapeuta dejó de venir porque ya no necesita terapia.", "es", "excluded_only"],
  ["His therapist stopped coming, and he no longer needs therapy.", "en", "excluded_only"],
  ["Su terapeuta dejó de venir, y ya no necesita terapia.", "es", "excluded_only"],
  ["His therapist stopped coming, but he no longer needs therapy.", "en", "excluded_only"],
  ["Su terapeuta dejó de venir, pero ya no necesita terapia.", "es", "excluded_only"],
  ["His therapist stopped coming. He no longer needs therapy.", "en", "supported"],
  ["Su terapeuta dejó de venir. Ya no necesita terapia.", "es", "supported"],
  ["His speech therapist stopped coming, but I no longer need my own speech therapy.", "en", "supported"],
  ["Su terapeuta del habla dejó de venir, pero yo ya no necesito mi propia terapia del habla.", "es", "supported"],
  ["His speech therapist stopped coming, but I no longer need it.", "en", "supported"],
  ["Su terapeuta del habla dejó de venir, pero yo ya no la necesito.", "es", "supported"],
  ["My speech therapist stopped coming.", "en", "excluded_only"],
  ["Mi terapeuta del habla dejó de venir.", "es", "excluded_only"],
  ["My speech therapist stopped coming, but I no longer need it.", "en", "excluded_only"],
  ["Mi terapeuta del habla dejó de venir, pero ya no la necesito.", "es", "excluded_only"],
  ["My child's speech therapist stopped coming.", "en", "supported"],
  ["La terapeuta del habla de mi hijo dejó de venir.", "es", "supported"],
  ["Su terapeuta del habla dejó de venir, pero ya no la necesito.", "es", "supported"],
  ["His speech and physical therapist stopped coming, but he no longer needs speech therapy.", "en", "supported"],
  ["Su terapeuta del habla y terapia física dejó de venir, pero ya no necesita terapia del habla.", "es", "supported"],
  ["She had speech therapy as a toddler.", "en", "excluded_only"],
  ["Recibió terapia del habla cuando era pequeña.", "es", "excluded_only"],
  ["I completed speech therapy.", "en", "excluded_only"],
  ["Terminé terapia del habla.", "es", "excluded_only"],
  ["I had speech therapy.", "en", "excluded_only"],
  ["Tuve terapia del habla.", "es", "excluded_only"],
  ["The therapy service was lost.", "en", "supported"],
  ["El servicio de terapia se perdió.", "es", "supported"],
  ["The doctor said speech therapy could help.", "en", "supported"],
  ["La médica recomendó terapia del habla porque podría ayudar.", "es", "supported"],
  ["He gets speech therapy, but it is not enough.", "en", "supported"],
  ["Recibe terapia del habla, pero no es suficiente.", "es", "supported"],
  ["He currently receives speech therapy, but we still need it.", "en", "supported"],
  ["Actualmente recibe terapia del habla, pero todavía la necesitamos.", "es", "supported"],
  ["He currently receives speech therapy, but he still needs it.", "en", "supported"],
  ["Actualmente recibe terapia del habla, pero él todavía la necesita.", "es", "supported"],
  ["He currently receives speech therapy but needs occupational therapy.", "en", "supported"],
  ["Actualmente recibe terapia del habla pero necesita terapia ocupacional.", "es", "supported"],
  ["He currently receives speech therapy and needs occupational therapy.", "en", "supported"],
  ["Actualmente recibe terapia del habla y necesita terapia ocupacional.", "es", "supported"],
  ["I currently receive speech therapy but need occupational therapy.", "en", "excluded_only"],
  ["Actualmente recibo terapia del habla pero necesito terapia ocupacional.", "es", "excluded_only"],
  ["I get speech therapy but need occupational therapy.", "en", "excluded_only"],
  ["Recibo terapia del habla pero necesito terapia ocupacional.", "es", "excluded_only"],
  ["I already receive speech therapy but need occupational therapy.", "en", "excluded_only"],
  ["Ya recibo terapia del habla pero necesito terapia ocupacional.", "es", "excluded_only"],
  ["I get speech therapy but still need occupational therapy.", "en", "excluded_only"],
  ["Recibo terapia del habla pero todavía necesito terapia ocupacional.", "es", "excluded_only"],
  ["I get speech therapy but currently need occupational therapy.", "en", "excluded_only"],
  ["Recibo terapia del habla pero actualmente necesito terapia ocupacional.", "es", "excluded_only"],
  ["I get speech therapy but am looking for occupational therapy.", "en", "excluded_only"],
  ["Recibo terapia del habla pero estoy buscando terapia ocupacional.", "es", "excluded_only"],
  ["He receives speech therapy and also needs occupational therapy.", "en", "supported"],
  ["Recibe terapia del habla y también necesita terapia ocupacional.", "es", "supported"],
  ["I get speech therapy and also need occupational therapy.", "en", "excluded_only"],
  ["Recibo terapia del habla y también necesito terapia ocupacional.", "es", "excluded_only"],
  ["He receives speech therapy and already needs occupational therapy.", "en", "supported"],
  ["Recibe terapia del habla y ya necesita terapia ocupacional.", "es", "supported"],
  ["I get speech therapy and already need occupational therapy.", "en", "excluded_only"],
  ["Recibo terapia del habla y ya necesito terapia ocupacional.", "es", "excluded_only"],
  ["I get speech therapy but need occupational therapy for my son.", "en", "supported"],
  ["Recibo terapia del habla pero necesito terapia ocupacional para mi hija.", "es", "supported"],
  ["I get speech therapy but need OT for my son.", "en", "supported"],
  ["Recibo terapia del habla pero necesito terapia ocupacional para mi hijo.", "es", "supported"],
  ["I get speech therapy but need my child's OT.", "en", "supported"],
  ["Recibo terapia del habla pero necesito la terapia ocupacional de mi hija.", "es", "supported"],
  ["I get speech therapy but need occupational therapy for Alex.", "en", "supported"],
  ["Recibo terapia del habla pero necesito terapia ocupacional para Alex.", "es", "supported"],
  ["I have trouble walking but need physical therapy.", "en", "excluded_only"],
  ["Tengo dificultad para caminar pero necesito terapia física.", "es", "excluded_only"],
  ["I have trouble walking but need physical therapy for him.", "en", "supported"],
  ["Tengo dificultad para caminar pero necesito terapia física para mi hijo.", "es", "supported"],
  ["He has trouble walking but needs physical therapy.", "en", "supported"],
  ["Él tiene dificultad para caminar pero necesita terapia física.", "es", "supported"],
  ["Needs support with speech and therapy.", "en", "supported"],
  ["Necesita apoyo con el habla y terapia.", "es", "supported"],
  ["His therapist stopped coming and we still need OT.", "en", "supported"],
  ["Su terapeuta dejó de venir y todavía necesitamos terapia ocupacional.", "es", "supported"],
  ["He already sees a therapist, and we need another therapist.", "en", "supported"],
  ["Ya ve a una terapeuta y necesitamos otra.", "es", "supported"],
  ["He currently sees a therapist, but we need another one.", "en", "supported"],
  ["Actualmente ve a una terapeuta, pero necesitamos otra.", "es", "supported"],
  ["Speech therapy was recommended but has not started.", "en", "supported"],
  ["Le recomendaron terapia del habla, pero todavía no ha empezado.", "es", "supported"],
  ["We need speech therapy.", "en", "supported"],
  ["Necesitamos terapia del habla.", "es", "supported"],
  ["He is looking for OT.", "en", "supported"],
  ["Ella está buscando terapia ocupacional.", "es", "supported"],
  ["We need speech and occupational therapy.", "en", "supported"],
  ["Necesitamos terapia del habla y terapia ocupacional.", "es", "supported"],
  ["I need my child's speech therapy.", "en", "supported"],
  ["Necesito la terapia del habla de mi hija.", "es", "supported"],
  ["I need my child's OT.", "en", "supported"],
  ["Necesito la terapia ocupacional de mi hija.", "es", "supported"],
  ["I need OT for my son.", "en", "supported"],
  ["Necesito terapia ocupacional para mi hijo.", "es", "supported"],
  ["I need my speech therapy.", "en", "excluded_only"],
  ["Necesito mi terapia del habla.", "es", "excluded_only"],
  ["I need my own speech therapy.", "en", "excluded_only"],
  ["Necesito mi propia terapia del habla.", "es", "excluded_only"],
  ["I need my OT.", "en", "excluded_only"],
  ["Necesito mi terapia ocupacional.", "es", "excluded_only"],
  ["I need help finding his speech therapy.", "en", "supported"],
  ["Necesito ayuda para encontrar terapia del habla para mi hijo.", "es", "supported"],
  ["I am looking for speech therapy for him.", "en", "supported"],
  ["Busco terapia del habla para él.", "es", "supported"],
  ["I am looking for OT for my son.", "en", "supported"],
  ["Busco terapia ocupacional para mi hijo.", "es", "supported"],
  ["I need help finding his speech therapy and the forms are hard for me.", "en", "supported"],
  ["Necesito ayuda para encontrar terapia del habla para mi hijo y los formularios son difíciles para mí.", "es", "supported"],
  ["I need help finding his speech therapy and reading long pages is hard for me.", "en", "supported"],
  ["Necesito ayuda para encontrar terapia del habla para mi hijo y me cuesta leer páginas largas.", "es", "supported"],
  ["I need his speech therapy and forms for me.", "en", "supported"],
  ["Necesito su terapia del habla y formularios para mí.", "es", "supported"],
  ["I am looking for speech therapy for myself.", "en", "excluded_only"],
  ["Busco terapia del habla para mí.", "es", "excluded_only"],
  ["I need my own speech therapist to coordinate with his therapist.", "en", "excluded_only"],
  ["Necesito mi propia terapeuta del habla para coordinar con su terapeuta.", "es", "excluded_only"],
  ["I need my own speech therapy so I can advocate for Alex.", "en", "excluded_only"],
  ["Necesito mi propia terapia del habla para poder abogar por Alex.", "es", "excluded_only"],
  ["I need a ride to speech therapy.", "en", "absent"],
  ["Necesito transporte para ir a terapia del habla.", "es", "absent"],
  ["Speech therapy is unavailable in our county.", "en", "supported"],
  ["La terapia del habla no está disponible.", "es", "supported"],
  ["We cannot access speech therapy in our county.", "en", "supported"],
  ["No podemos acceder a terapia del habla en nuestro condado.", "es", "supported"],
  ["He currently receives speech therapy, and I need a ride.", "en", "excluded_only"],
  ["Actualmente recibe terapia del habla y necesito un descanso.", "es", "excluded_only"],
  ["He currently receives speech therapy, but I cannot find a ride.", "en", "excluded_only"],
  ["Actualmente recibe terapia del habla, pero no puedo encontrar transporte.", "es", "excluded_only"],
  ["He currently receives speech therapy but I cannot find a ride.", "en", "excluded_only"],
  ["Actualmente recibe terapia del habla pero no puedo encontrar transporte.", "es", "excluded_only"],
  ["Speech therapy.", "en", "absent"],
  ["Terapia del habla.", "es", "absent"],
  ["She is using more words with a friend.", "en", "excluded_only"],
  ["Está usando más palabras con una amiga.", "es", "excluded_only"],
  ["She is using more words and still needs a ride.", "en", "excluded_only"],
  ["Ella está usando más palabras y todavía necesita transporte.", "es", "excluded_only"],
  ["She is using more words and still needs help talking.", "en", "supported"],
  ["Ella está usando más palabras y todavía necesita ayuda para hablar.", "es", "supported"],
  ["She is using more words, but still cannot tell us what she needs.", "en", "supported"],
  ["Está usando más palabras, pero todavía no puede decir lo que necesita.", "es", "supported"],
  ["She is using more words, but her communication is still difficult.", "en", "supported"],
  ["Ella está usando más palabras, pero su comunicación no es suficiente.", "es", "supported"],
  ["Her communication is still difficult, but she is using more words.", "en", "supported"],
  ["Su comunicación no es suficiente, pero ella está usando más palabras.", "es", "supported"],
  ["She is using more words but still has trouble talking.", "en", "supported"],
  ["Ella está usando más palabras pero todavía tiene dificultad para hablar.", "es", "supported"],
  ["She still has trouble talking but is using more words.", "en", "supported"],
  ["Ella todavía tiene dificultad para hablar pero está usando más palabras.", "es", "supported"]
] as const;

const ACTOR_CASES = [
  ["Reading long pages is hard for me.", "en", "excluded_only"],
  ["Me cuesta leer páginas largas.", "es", "excluded_only"],
  ["La lectura es difícil para mí.", "es", "excluded_only"],
  ["Reading and homework are hard for him.", "en", "supported"],
  ["La lectura y la tarea son difíciles para él.", "es", "supported"],
  ["I need help with his school evaluation.", "en", "supported"],
  ["Necesito ayuda con la evaluación escolar de mi hija.", "es", "supported"]
] as const;

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

  it("does not turn current services or caregiver reading access into Sam's unmet need", () => {
    const profile = {
      childFirstName: "Sam",
      birthYear: 2019,
      schoolStage: "elementary" as const,
      county: "Fayette",
      diagnoses: []
    };
    const result = extractFamilyInterviewMock(F06_TEXT, profile, FIXED_NOW, "en");
    const analysis = analyzeFamilyNarrative(F06_TEXT, profile, FIXED_NOW, "en");

    expect(result.domains.map(({ domain }) => domain)).toEqual([
      "respite",
      "parent_support",
      "sibling_support",
      "recreation"
    ]);
    expect(analysis.support.therapies).toBe("excluded_only");
    expect(analysis.support.school_iep).toBe("excluded_only");
    expect(result.facts.some(({ label }) => label === "About talking")).toBe(false);
    expect(result.facts.some(({ label }) => label === "About school and learning")).toBe(false);
  });

  it("keeps a positive speech update as context while preserving its school concern", () => {
    const profile = {
      childFirstName: "Sofía",
      birthYear: 2018,
      schoolStage: "elementary" as const,
      county: "Jefferson",
      diagnoses: []
    };
    const result = extractFamilyInterviewMock(L01_TEXT, profile, FIXED_NOW, "es");
    const analysis = analyzeFamilyNarrative(L01_TEXT, profile, FIXED_NOW, "es");

    expect(result.domains.map(({ domain }) => domain)).toEqual(["school_iep"]);
    expect(analysis.support.therapies).toBe("excluded_only");
    expect(result.facts.some(({ label }) => label === "Sobre el habla")).toBe(false);
  });

  it.each(SERVICE_STATUS_CASES)(
    "classifies therapy direction without turning context into a need: %s",
    (text, language, expected) => {
      const profile = {
        childFirstName: "Alex",
        birthYear: 2016,
        schoolStage: "elementary" as const,
        county: "Fayette",
        diagnoses: []
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      const domains = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      ).domains.map(({ domain }) => domain);

      expect(analysis.support.therapies).toBe(expected);
      expect(domains.includes("therapies")).toBe(expected === "supported");
    }
  );

  it.each([
    ["Mary Jane currently needs OT.", "Mary Jane", "en", "supported"],
    ["Mary Jane needs OT.", "Mary Jane", "en", "supported"],
    [
      "María José actualmente necesita terapia del habla.",
      "María José",
      "es",
      "supported"
    ],
    [
      "María José necesita terapia del habla.",
      "María José",
      "es",
      "supported"
    ],
    [
      "Mary Jane currently needs speech and occupational therapy.",
      "Mary Jane",
      "en",
      "supported"
    ],
    [
      "María José actualmente necesita terapia del habla y terapia ocupacional.",
      "María José",
      "es",
      "supported"
    ],
    ["Mary Jane is looking for OT.", "Mary Jane", "en", "supported"],
    ["María José busca terapia del habla.", "María José", "es", "supported"],
    ["Mary Jane needs OT for Alex.", "Alex", "en", "supported"],
    [
      "María José necesita terapia del habla para Alex.",
      "Alex",
      "es",
      "supported"
    ],
    ["Mary Jane currently needs OT.", "Alex", "en", "excluded_only"],
    ["Mary Jane needs OT.", "Alex", "en", "excluded_only"],
    [
      "Mary Jane currently needs speech and occupational therapy.",
      "Alex",
      "en",
      "excluded_only"
    ],
    [
      "María José actualmente necesita terapia del habla.",
      "Alex",
      "es",
      "excluded_only"
    ],
    [
      "María José necesita terapia del habla.",
      "Alex",
      "es",
      "excluded_only"
    ],
    [
      "María José actualmente necesita terapia del habla y terapia ocupacional.",
      "Alex",
      "es",
      "excluded_only"
    ],
    ["Mary Jane is looking for OT.", "Alex", "en", "excluded_only"],
    ["María José busca terapia del habla.", "Alex", "es", "excluded_only"]
  ] as const)(
    "honors exact named-subject and child-beneficiary service ownership: %s",
    (text, childFirstName, language, expected) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        childFirstName
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      );

      expect(analysis.support.therapies).toBe(expected);
      expect(
        result.domains.some(({ domain }) => domain === "therapies")
      ).toBe(expected === "supported");
    }
  );

  it.each(ACTOR_CASES)(
    "keeps caregiver accessibility separate from the child's school need: %s",
    (text, language, expected) => {
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      expect(analysis.support.school_iep).toBe(expected);
    }
  );

  it.each([
    [
      "He needs occupational therapy and currently receives speech therapy.",
      "en",
      ["therapies"]
    ],
    [
      "Necesita terapia ocupacional y actualmente recibe terapia del habla.",
      "es",
      ["therapies"]
    ],
    [
      "He already receives speech therapy and needs occupational therapy.",
      "en",
      ["therapies"]
    ],
    [
      "Ya recibe terapia del habla y necesita terapia ocupacional.",
      "es",
      ["therapies"]
    ],
    [
      "He needs speech therapy and now receives occupational therapy.",
      "en",
      ["early_intervention", "therapies"]
    ],
    [
      "Necesita terapia del habla y ahora recibe terapia ocupacional.",
      "es",
      ["early_intervention", "therapies"]
    ],
    [
      "He also receives occupational therapy and needs speech therapy.",
      "en",
      ["early_intervention", "therapies"]
    ],
    [
      "También recibe terapia ocupacional y necesita terapia del habla.",
      "es",
      ["early_intervention", "therapies"]
    ],
    [
      "He needs occupational therapy and completed speech therapy last year.",
      "en",
      ["therapies"]
    ],
    [
      "Necesita terapia ocupacional y terminó terapia del habla el año pasado.",
      "es",
      ["therapies"]
    ],
    [
      "He needs speech therapy and completed occupational therapy last year.",
      "en",
      ["early_intervention", "therapies"]
    ],
    [
      "Necesita terapia del habla y terminó terapia ocupacional el año pasado.",
      "es",
      ["early_intervention", "therapies"]
    ],
    [
      "He completed speech therapy last year and needs occupational therapy.",
      "en",
      ["therapies"]
    ],
    [
      "Terminó terapia del habla el año pasado y necesita terapia ocupacional.",
      "es",
      ["therapies"]
    ],
    [
      "He completed occupational therapy last year and needs speech therapy.",
      "en",
      ["early_intervention", "therapies"]
    ],
    [
      "Terminó terapia ocupacional el año pasado y necesita terapia del habla.",
      "es",
      ["early_intervention", "therapies"]
    ]
  ] as const)(
    "keeps independently current or historical modalities separate from requests: %s",
    (text, language, expectedDomains) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age" as const
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      const domains = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      ).domains.map(({ domain }) => domain);

      expect(analysis.support.therapies).toBe("supported");
      expect(analysis.support.early_intervention).toBe(
        expectedDomains[0] === "early_intervention"
          ? "supported"
          : "excluded_only"
      );
      expect(domains).toEqual(expectedDomains);
    }
  );

  it.each([
    ["I need my own speech therapy and OT for my son.", "en", ["therapies"]],
    ["I need OT for my son and my own speech therapy.", "en", ["therapies"]],
    [
      "Necesito mi propia terapia del habla y terapia ocupacional para mi hijo.",
      "es",
      ["therapies"]
    ],
    [
      "Necesito terapia ocupacional para mi hijo y mi propia terapia del habla.",
      "es",
      ["therapies"]
    ],
    [
      "I need my own OT and speech therapy for my son.",
      "en",
      ["early_intervention", "therapies"]
    ],
    [
      "I need speech therapy for my son and my own OT.",
      "en",
      ["early_intervention", "therapies"]
    ],
    [
      "Necesito mi propia terapia ocupacional y terapia del habla para mi hijo.",
      "es",
      ["early_intervention", "therapies"]
    ],
    [
      "Necesito terapia del habla para mi hijo y mi propia terapia ocupacional.",
      "es",
      ["early_intervention", "therapies"]
    ],
    ["I need my own speech therapy and OT for Alex.", "en", ["therapies"]],
    ["I need OT for Alex and my own speech therapy.", "en", ["therapies"]],
    [
      "Necesito mi propia terapia del habla y terapia ocupacional para Alex.",
      "es",
      ["therapies"]
    ],
    [
      "Necesito terapia del habla para Alex y mi propia terapia ocupacional.",
      "es",
      ["early_intervention", "therapies"]
    ]
  ] as const)(
    "recomputes each coordinated service owner while carrying only request status: %s",
    (text, language, expectedDomains) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        childFirstName: "Alex",
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age" as const
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      const domains = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      ).domains.map(({ domain }) => domain);

      expect(analysis.support.therapies).toBe("supported");
      expect(analysis.support.early_intervention).toBe(
        expectedDomains[0] === "early_intervention"
          ? "supported"
          : "excluded_only"
      );
      expect(domains).toEqual(expectedDomains);
    }
  );

  it.each([
    [
      "I need my own speech therapy and OT for Mary Jane.",
      "en",
      "Mary Jane",
      ["therapies"]
    ],
    [
      "I need OT for Mary Jane and my own speech therapy.",
      "en",
      "Mary Jane",
      ["therapies"]
    ],
    [
      "Necesito mi propia terapia ocupacional y terapia del habla para María José.",
      "es",
      "María José",
      ["early_intervention", "therapies"]
    ],
    [
      "Necesito terapia del habla para María José y mi propia terapia ocupacional.",
      "es",
      "María José",
      ["early_intervention", "therapies"]
    ]
  ] as const)(
    "carries a bare request to an exact compound profile name: %s",
    (text, language, childFirstName, expectedDomains) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        childFirstName,
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age" as const
      };
      const domains = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      ).domains.map(({ domain }) => domain);

      expect(domains).toEqual(expectedDomains);
    }
  );

  it.each([
    ["I need my own speech therapy. OT for my son.", "en"],
    [
      "I need my own speech therapy, but forms are hard for me, and OT for my son.",
      "en"
    ],
    ["I need my own speech therapy and OT forms for my son.", "en"],
    ["I need my own speech therapy and OT appointments for my son.", "en"],
    ["I need my own speech therapy and OT paperwork for my son.", "en"],
    ["Necesito mi propia terapia del habla. Terapia ocupacional para mi hijo.", "es"],
    [
      "Necesito mi propia terapia del habla, pero los formularios son difíciles para mí, y terapia ocupacional para mi hijo.",
      "es"
    ],
    [
      "Necesito mi propia terapia del habla y formularios de terapia ocupacional para mi hijo.",
      "es"
    ],
    [
      "Necesito mi propia terapia del habla y citas de terapia ocupacional para mi hijo.",
      "es"
    ],
    [
      "Necesito mi propia terapia del habla y papeleo de terapia ocupacional para mi hijo.",
      "es"
    ]
  ] as const)(
    "does not carry request status across a sentence, unrelated clause, or service paperwork: %s",
    (text, language) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age" as const
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      const domains = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      ).domains.map(({ domain }) => domain);

      expect(analysis.support.therapies).toBe("excluded_only");
      expect(analysis.support.early_intervention).toBe("excluded_only");
      expect(domains).toEqual([]);
    }
  );

  it("does not read a clinician's verb as the child's speech evidence", () => {
    const result = extractFamilyInterviewMock(
      "His doctor says school is hard.",
      schoolAgeFamilyState.profile!,
      FIXED_NOW,
      "en"
    );
    expect(result.facts.some(({ label }) => label === "About talking")).toBe(false);
  });

  it("keeps a child clause from inheriting the adjacent clinician actor", () => {
    const text =
      "His doctor says speech therapy may help, but he says mama and no, and not much else.";
    const result = extractFamilyInterviewMock(
      text,
      {
        ...schoolAgeFamilyState.profile!,
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age"
      },
      FIXED_NOW,
      "en"
    );
    expect(
      result.facts.find(({ label }) => label === "About talking")
        ?.sourceSnippet
    ).toBe("he says mama and no");
  });

  it("keeps a caregiver-only clause from inheriting the adjacent child actor", () => {
    const analysis = analyzeFamilyNarrative(
      "He currently receives speech therapy, and reading long pages is hard for me.",
      schoolAgeFamilyState.profile!,
      FIXED_NOW,
      "en"
    );
    expect(analysis.support.therapies).toBe("excluded_only");
    expect(analysis.support.school_iep).toBe("excluded_only");
  });

  it.each([
    [
      "I say only a few words because of my own condition but he says hello.",
      "en",
      "About talking"
    ],
    [
      "Estoy diciendo pocas palabras por mi propia condición pero él dice hola.",
      "es",
      "Sobre el habla"
    ],
    [
      "He says hello but I only say a few words in English.",
      "en",
      "About talking"
    ],
    [
      "Él dice hola pero yo solo digo pocas palabras en español.",
      "es",
      "Sobre el habla"
    ]
  ] as const)(
    "does not lend unpunctuated caregiver limited-language context to a child clause: %s",
    (text, language, speechLabel) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      expect(result.facts.some(({ label }) => label === speechLabel)).toBe(false);
      expect(result.domains.some(({ domain }) => domain === "therapies")).toBe(
        false
      );
    }
  );

  it.each([
    ["I have anxiety and trouble sleeping.", "en", false],
    ["Tengo ansiedad y problemas para dormir.", "es", false],
    ["He has meltdowns and trouble sleeping.", "en", true],
    ["Él tiene berrinches y problemas para dormir.", "es", true]
  ] as const)(
    "attributes behavior and routine concerns to the child: %s",
    (text, language, expected) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const behaviorLabels = {
        en: "About behavior and routines",
        es: "Sobre el comportamiento y las rutinas"
      } as const;
      expect(
        result.facts.some(({ label }) => label === behaviorLabels[language])
      ).toBe(expected);
    }
  );

  it.each([
    [
      "I say hello, but not much else.",
      "en",
      "About talking",
      null,
      "excluded_only"
    ],
    [
      "Yo digo hola, pero nada más.",
      "es",
      "Sobre el habla",
      null,
      "excluded_only"
    ],
    [
      "He says hello, but not much else.",
      "en",
      "About talking",
      "He says hello",
      "supported"
    ],
    [
      "Él dice hola, pero nada más.",
      "es",
      "Sobre el habla",
      "Él dice hola",
      "supported"
    ]
  ] as const)(
    "binds an elliptical limited-language tail to its preceding actor: %s",
    (text, language, speechLabel, childSnippet, therapySupport) => {
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );

      expect(analysis.support.therapies).toBe(therapySupport);
      expect(
        result.facts.find(({ label }) => label === speechLabel)
          ?.sourceSnippet ?? null
      ).toBe(childSnippet);
      expect(
        result.domains.some(({ domain }) => domain === "therapies")
      ).toBe(therapySupport === "supported");
    }
  );

  it("keeps a direct motor observation beside a current speech service", () => {
    const profile = {
      ...schoolAgeFamilyState.profile!,
      birthYear: 2024,
      birthMonth: 8,
      schoolStage: "not_school_age" as const
    };
    const analysis = analyzeFamilyNarrative(
      "He currently receives speech therapy, and he still falls a lot when he walks.",
      profile,
      FIXED_NOW,
      "en"
    );
    expect(analysis.support.therapies).toBe("supported");
    expect(analysis.support.early_intervention).toBe("supported");
  });

  it.each([
    [
      "He currently receives speech therapy and I have trouble walking.",
      "en",
      "About moving",
      "About talking"
    ],
    [
      "Actualmente recibe terapia del habla y yo tengo dificultad para caminar.",
      "es",
      "Sobre el movimiento",
      "Sobre el habla"
    ]
  ] as const)(
    "keeps a caregiver observation separate from an unpunctuated child service: %s",
    (text, language, motorLabel, speechLabel) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      expect(result.facts.some(({ label }) => label === motorLabel)).toBe(false);
      expect(result.facts.some(({ label }) => label === speechLabel)).toBe(false);
      expect(result.domains.some(({ domain }) => domain === "therapies")).toBe(
        false
      );
    }
  );

  it.each([
    ["I am not walking.", "en", "About moving", false],
    ["No camino.", "es", "Sobre el movimiento", false],
    ["He is not walking.", "en", "About moving", true],
    ["Él no camina.", "es", "Sobre el movimiento", true]
  ] as const)(
    "binds direct motor difficulty to its subject: %s",
    (text, language, motorLabel, expected) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      expect(
        result.facts.some(({ label }) => label === motorLabel)
      ).toBe(expected);
      expect(result.domains.some(({ domain }) => domain === "therapies")).toBe(
        expected
      );
    }
  );

  it.each([
    [
      "He currently receives speech therapy and he still falls a lot when he walks.",
      "en",
      "About moving",
      "About talking"
    ],
    [
      "Actualmente recibe terapia del habla y él todavía se cae mucho cuando camina.",
      "es",
      "Sobre el movimiento",
      "Sobre el habla"
    ],
    [
      "He currently receives speech therapy and he has trouble walking.",
      "en",
      "About moving",
      "About talking"
    ],
    [
      "He currently receives speech therapy and he has difficulty walking.",
      "en",
      "About moving",
      "About talking"
    ],
    [
      "Actualmente recibe terapia del habla y él tiene dificultad para caminar.",
      "es",
      "Sobre el movimiento",
      "Sobre el habla"
    ]
  ] as const)(
    "keeps an unpunctuated child observation separate from current therapy: %s",
    (text, language, motorLabel, speechLabel) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age" as const
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      );
      expect(analysis.support.therapies).toBe("supported");
      expect(analysis.support.early_intervention).toBe("supported");
      expect(result.facts.some(({ label }) => label === motorLabel)).toBe(true);
      expect(result.facts.some(({ label }) => label === speechLabel)).toBe(false);
    }
  );

  it.each([
    [
      "He currently receives physical therapy and he has trouble talking.",
      "en",
      "About talking",
      "About moving"
    ],
    [
      "Actualmente recibe terapia física y él tiene dificultad para hablar.",
      "es",
      "Sobre el habla",
      "Sobre el movimiento"
    ],
    [
      "He currently receives physical therapy and he says mama and no but not much else.",
      "en",
      "About talking",
      "About moving"
    ],
    [
      "Actualmente recibe terapia física y él dice mamá y no pero nada más.",
      "es",
      "Sobre el habla",
      "Sobre el movimiento"
    ]
  ] as const)(
    "keeps unpunctuated speech evidence separate from current motor therapy: %s",
    (text, language, presentLabel, absentLabel) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age" as const
      };
      const result = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      );
      expect(result.facts.some(({ label }) => label === presentLabel)).toBe(true);
      expect(result.facts.some(({ label }) => label === absentLabel)).toBe(false);
      expect(result.domains.map(({ domain }) => domain)).toEqual([
        "early_intervention",
        "therapies"
      ]);
    }
  );

  it.each([
    [
      "He currently receives speech therapy because he has trouble sleeping.",
      "en",
      "excluded_only",
      false,
      false
    ],
    [
      "Actualmente recibe terapia del habla porque él tiene problemas para dormir.",
      "es",
      "excluded_only",
      false,
      false
    ],
    [
      "He currently receives speech therapy because he has trouble talking.",
      "en",
      "supported",
      true,
      false
    ],
    [
      "Actualmente recibe terapia del habla porque él tiene dificultad para hablar.",
      "es",
      "supported",
      true,
      false
    ],
    [
      "He currently receives speech therapy because he cannot walk.",
      "en",
      "supported",
      false,
      true
    ],
    [
      "Actualmente recibe terapia del habla porque él no puede caminar.",
      "es",
      "supported",
      false,
      true
    ]
  ] as const)(
    "binds a same-clause difficulty override to its named modality: %s",
    (text, language, therapySupport, hasSpeechFact, hasMotorFact) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const labels = {
        en: { speech: "About talking", motor: "About moving" },
        es: { speech: "Sobre el habla", motor: "Sobre el movimiento" }
      } as const;

      expect(analysis.support.therapies).toBe(therapySupport);
      expect(
        result.facts.some(({ label }) => label === labels[language].speech)
      ).toBe(hasSpeechFact);
      expect(
        result.facts.some(({ label }) => label === labels[language].motor)
      ).toBe(hasMotorFact);
    }
  );

  it.each([
    [
      "He has trouble talking and I am waiting for my own evaluation.",
      "en",
      "Evaluation status"
    ],
    [
      "Él tiene dificultad para hablar y yo estoy esperando mi propia evaluación.",
      "es",
      "Estado de la evaluación"
    ],
    [
      "I am waiting for my own evaluation and he has trouble talking.",
      "en",
      "Evaluation status"
    ],
    [
      "Yo estoy esperando mi propia evaluación y él tiene dificultad para hablar.",
      "es",
      "Estado de la evaluación"
    ],
    [
      "Alex has trouble talking and I am waiting for my own evaluation.",
      "en",
      "Evaluation status"
    ],
    [
      "Alex tiene dificultad para hablar y yo estoy esperando mi propia evaluación.",
      "es",
      "Estado de la evaluación"
    ],
    [
      "I am waiting for my own evaluation and Alex has trouble talking.",
      "en",
      "Evaluation status"
    ],
    [
      "Yo estoy esperando mi propia evaluación y Alex tiene dificultad para hablar.",
      "es",
      "Estado de la evaluación"
    ]
  ] as const)(
    "keeps an unpunctuated caregiver evaluation separate in either actor order: %s",
    (text, language, evaluationLabel) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        childFirstName: "Alex",
        birthYear: 2016,
        birthMonth: 1
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      );

      expect(analysis.support.therapies).toBe("supported");
      expect(analysis.support.school_iep).toBe("excluded_only");
      expect(
        result.facts.some(({ label }) => label === evaluationLabel)
      ).toBe(false);
      expect(result.domains.map(({ domain }) => domain)).toEqual(["therapies"]);
    }
  );

  it.each([
    ["I have trouble speaking and walking.", "en", []],
    ["Tengo dificultad para hablar y caminar.", "es", []],
    ["I am waiting for my own evaluation.", "en", []],
    ["Estoy esperando mi propia evaluación.", "es", []],
    ["He has trouble speaking and walking.", "en", ["therapies"]],
    ["Él tiene dificultad para hablar y caminar.", "es", ["therapies"]],
    ["We are waiting for his school evaluation.", "en", ["school_iep"]],
    ["Estamos esperando la evaluación escolar de mi hijo.", "es", ["school_iep"]]
  ] as const)(
    "keeps caregiver clinical context separate from the child's need: %s",
    (text, language, expected) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        birthYear: 2016,
        birthMonth: 1
      };
      const result = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      );
      expect(result.domains.map(({ domain }) => domain)).toEqual(expected);
    }
  );

  it.each([
    [
      "Speaking on the phone is hard for me when I call his school.",
      "en",
      "excluded_only",
      "excluded_only"
    ],
    [
      "Me cuesta hablar cuando llamo a su escuela.",
      "es",
      "excluded_only",
      "excluded_only"
    ],
    [
      "No puedo hablar cuando llamo a su escuela.",
      "es",
      "excluded_only",
      "excluded_only"
    ],
    [
      "Hablar por teléfono es difícil para mí cuando llamo a su escuela.",
      "es",
      "excluded_only",
      "excluded_only"
    ],
    [
      "I barely talk when I call his school.",
      "en",
      "excluded_only",
      "excluded_only"
    ],
    [
      "I am not talking when I call his school.",
      "en",
      "excluded_only",
      "excluded_only"
    ],
    [
      "Casi no hablo cuando llamo a su escuela.",
      "es",
      "excluded_only",
      "excluded_only"
    ],
    [
      "No hablo cuando llamo a su escuela.",
      "es",
      "excluded_only",
      "excluded_only"
    ],
    ["He is not talking.", "en", "supported", "absent"],
    ["Él no habla.", "es", "supported", "absent"],
    [
      "I am struggling to speak when his therapist says complicated things.",
      "en",
      "excluded_only",
      "absent"
    ],
    [
      "Estoy luchando para hablar cuando su terapeuta dice cosas complicadas.",
      "es",
      "excluded_only",
      "absent"
    ],
    [
      "I have trouble speaking when his therapist says complicated things.",
      "en",
      "excluded_only",
      "absent"
    ],
    [
      "Tengo dificultad para hablar cuando su terapeuta dice cosas complicadas.",
      "es",
      "excluded_only",
      "absent"
    ],
    [
      "His therapist said he has trouble speaking.",
      "en",
      "supported",
      "absent"
    ],
    [
      "Su terapeuta dijo que él tiene dificultad para hablar.",
      "es",
      "supported",
      "absent"
    ],
    [
      "I am waiting for my own evaluation so I can help him.",
      "en",
      "absent",
      "excluded_only"
    ],
    [
      "Estoy esperando mi propia evaluación para poder ayudar a mi hijo.",
      "es",
      "absent",
      "excluded_only"
    ],
    [
      "I am worried that he has trouble speaking.",
      "en",
      "supported",
      "absent"
    ],
    [
      "Me preocupa que él tenga dificultad para hablar.",
      "es",
      "supported",
      "absent"
    ]
  ] as const)(
    "binds a clinical predicate to its subject despite another actor referent: %s",
    (text, language, therapySupport, schoolSupport) => {
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      expect(analysis.support.therapies).toBe(therapySupport);
      expect(analysis.support.school_iep).toBe(schoolSupport);
    }
  );

  it.each([
    [
      "I currently receive speech therapy, but still have trouble talking.",
      "en",
      "excluded_only"
    ],
    [
      "I currently receive speech therapy but still have trouble talking.",
      "en",
      "excluded_only"
    ],
    [
      "I currently receive speech therapy and still have trouble talking.",
      "en",
      "excluded_only"
    ],
    [
      "He currently receives speech therapy, but still has trouble talking.",
      "en",
      "supported"
    ],
    [
      "He currently receives speech therapy and still has trouble talking.",
      "en",
      "supported"
    ],
    [
      "They currently receive speech therapy, but still have trouble talking.",
      "en",
      "supported"
    ],
    [
      "I currently receive speech therapy. Still have trouble talking.",
      "en",
      "supported"
    ],
    [
      "I currently receive speech therapy, but he still has trouble talking.",
      "en",
      "supported"
    ],
    [
      "I am worried that they currently receive speech therapy, but still have trouble talking.",
      "en",
      "supported"
    ],
    [
      "Actualmente recibo terapia del habla, pero todavía tengo dificultad para hablar.",
      "es",
      "excluded_only"
    ],
    [
      "Actualmente recibo terapia del habla y todavía tengo dificultad para hablar.",
      "es",
      "excluded_only"
    ],
    [
      "Actualmente recibe terapia del habla, pero todavía tiene dificultad para hablar.",
      "es",
      "supported"
    ],
    [
      "Actualmente recibe terapia del habla y todavía tiene dificultad para hablar.",
      "es",
      "supported"
    ],
    [
      "Actualmente recibo terapia del habla, pero él todavía tiene dificultad para hablar.",
      "es",
      "supported"
    ]
  ] as const)(
    "inherits only a bounded caregiver owner for an elided clinical predicate: %s",
    (text, language, expected) => {
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );

      expect(analysis.support.therapies).toBe(expected);
      expect(result.domains.some(({ domain }) => domain === "therapies")).toBe(
        expected === "supported"
      );
    }
  );

  it("does not make service-propagated physical therapy early-intervention eligible", () => {
    const profile = {
      ...schoolAgeFamilyState.profile!,
      birthYear: 2024,
      birthMonth: 8,
      schoolStage: "not_school_age" as const
    };
    const physical = analyzeFamilyNarrative(
      "We need physical therapy.",
      profile,
      FIXED_NOW,
      "en"
    );
    const speech = analyzeFamilyNarrative(
      "We need speech therapy.",
      profile,
      FIXED_NOW,
      "en"
    );

    expect(physical.support.therapies).toBe("supported");
    expect(physical.support.early_intervention).toBe("excluded_only");
    expect(speech.support.therapies).toBe("supported");
    expect(speech.support.early_intervention).toBe("supported");
    expect(
      extractFamilyInterviewMock(
        "We need physical therapy.",
        profile,
        FIXED_NOW,
        "en"
      ).domains.map(({ domain }) => domain)
    ).toEqual(["therapies"]);
  });

  it.each([
    [
      "He currently receives speech therapy, but we still need physical therapy.",
      "en"
    ],
    [
      "Actualmente recibe terapia del habla, pero todavía necesitamos terapia física.",
      "es"
    ],
    [
      "He currently receives speech therapy but we still need physical therapy.",
      "en"
    ],
    [
      "Actualmente recibe terapia del habla pero todavía necesitamos terapia física.",
      "es"
    ],
    [
      "He currently receives speech therapy and we still need physical therapy.",
      "en"
    ],
    [
      "Actualmente recibe terapia del habla y todavía necesitamos terapia física.",
      "es"
    ],
    [
      "I get speech therapy and am looking for occupational therapy for my son.",
      "en"
    ],
    [
      "Recibo terapia del habla y estoy buscando terapia ocupacional para mi hijo.",
      "es"
    ],
    ["He receives speech therapy and also needs occupational therapy.", "en"],
    ["Recibe terapia del habla y también necesita terapia ocupacional.", "es"],
    ["Recibo terapia del habla y busco terapia ocupacional para mi hijo.", "es"],
    ["He receives speech therapy and already needs occupational therapy.", "en"],
    ["Recibe terapia del habla y ya necesita terapia ocupacional.", "es"]
  ] as const)(
    "does not leak an unmet motor service onto current speech: %s",
    (text, language) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        birthYear: 2024,
        birthMonth: 8,
        schoolStage: "not_school_age" as const
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      expect(analysis.support.therapies).toBe("supported");
      expect(analysis.support.early_intervention).toBe("excluded_only");
      expect(
        extractFamilyInterviewMock(
          text,
          profile,
          FIXED_NOW,
          language
        ).domains.map(({ domain }) => domain)
      ).toEqual(["therapies"]);
    }
  );

  it.each([
    [
      "He used to talk while walking but now he no longer talks.",
      "en",
      "About moving",
      "Change you noticed"
    ],
    [
      "Antes hablaba mientras caminaba pero ya no habla.",
      "es",
      "Sobre el movimiento",
      "Cambio que notaste"
    ],
    [
      "He used to walk while talking but now he no longer walks.",
      "en",
      "About talking",
      "Change you noticed"
    ],
    [
      "Antes caminaba mientras hablaba pero ya no camina.",
      "es",
      "Sobre el habla",
      "Cambio que notaste"
    ]
  ] as const)(
    "targets the acquired skill rather than a contextual modality word: %s",
    (text, language, unrelatedLabel, regressionLabel) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      expect(
        result.facts.some(({ label }) => label === regressionLabel)
      ).toBe(true);
      expect(
        result.facts.some(({ label }) => label === unrelatedLabel)
      ).toBe(false);
    }
  );

  it.each([
    ["He lost skills.", "en", "Change you noticed"],
    ["Perdió habilidades.", "es", "Cambio que notaste"],
    ["He stopped pointing.", "en", "Change you noticed"],
    ["Dejó de señalar.", "es", "Cambio que notaste"]
  ] as const)(
    "keeps an ambiguous or non-domain regression generic: %s",
    (text, language, regressionLabel) => {
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );

      expect(
        result.facts.some(({ label }) => label === regressionLabel)
      ).toBe(true);
      expect(analysis.support.therapies).toBe("absent");
      expect(result.domains.some(({ domain }) => domain === "therapies")).toBe(
        false
      );
    }
  );

  it.each([
    ["He forgot how to climb the stairs.", "en"],
    ["Olvidó cómo subir las escaleras.", "es"]
  ] as const)(
    "maps a named non-walk motor regression without defaulting to speech: %s",
    (text, language) => {
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      expect(analysis.support.therapies).toBe("supported");
    }
  );

  it.each([
    [
      "I stopped talking after my stroke.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    [
      "I had a stroke and stopped talking.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    [
      "I had a stroke, and stopped talking.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    [
      "I had a stroke, and then stopped talking.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    ["I stopped saying words.", "en", "Change you noticed", "excluded_only"],
    ["I no longer talk.", "en", "Change you noticed", "excluded_only"],
    [
      "I used to talk but no longer do.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    [
      "He used to talk with me, but I no longer do.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    [
      "He used to talk with me, but now I no longer do.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    [
      "I currently receive speech therapy and stopped talking.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    ["I lost words.", "en", "Change you noticed", "excluded_only"],
    ["I lost skills.", "en", "Change you noticed", "absent"],
    ["I forgot how to walk.", "en", "Change you noticed", "excluded_only"],
    [
      "I stopped talking after my stroke while Alex waited at school.",
      "en",
      "Change you noticed",
      "excluded_only"
    ],
    [
      "Dejé de hablar después de mi derrame cerebral.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ],
    [
      "Tuve un derrame cerebral y dejé de hablar.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ],
    [
      "Tuve un derrame cerebral, y dejé de hablar.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ],
    [
      "Tuve un derrame cerebral, y luego dejé de hablar.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ],
    ["Dejé de decir palabras.", "es", "Cambio que notaste", "excluded_only"],
    ["Ya no hablo.", "es", "Cambio que notaste", "excluded_only"],
    [
      "Yo antes hablaba pero ya no.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ],
    [
      "Él antes hablaba conmigo, pero yo ya no.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ],
    [
      "Él antes hablaba conmigo, pero ahora yo ya no.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ],
    [
      "Actualmente recibo terapia del habla y dejé de hablar.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ],
    ["Perdí palabras.", "es", "Cambio que notaste", "excluded_only"],
    ["Perdí habilidades.", "es", "Cambio que notaste", "absent"],
    ["Olvidé cómo caminar.", "es", "Cambio que notaste", "excluded_only"],
    [
      "Dejé de hablar después de mi derrame mientras Alex esperaba en la escuela.",
      "es",
      "Cambio que notaste",
      "excluded_only"
    ]
  ] as const)(
    "does not turn caregiver first-person regression into child evidence: %s",
    (text, language, regressionLabel, therapySupport) => {
      const profile = {
        ...schoolAgeFamilyState.profile!,
        childFirstName: "Alex"
      };
      const analysis = analyzeFamilyNarrative(
        text,
        profile,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        profile,
        FIXED_NOW,
        language
      );

      expect(
        result.facts.some(({ label }) => label === regressionLabel)
      ).toBe(false);
      expect(analysis.support.therapies).toBe(therapySupport);
      expect(result.domains.some(({ domain }) => domain === "therapies")).toBe(
        false
      );
    }
  );

  it.each([
    ["He stopped talking.", "en", "Change you noticed"],
    ["He stopped saying words.", "en", "Change you noticed"],
    ["He no longer talks.", "en", "Change you noticed"],
    ["He used to talk but no longer does.", "en", "Change you noticed"],
    ["He lost words.", "en", "Change you noticed"],
    ["He forgot how to walk.", "en", "Change you noticed"],
    ["I am worried that he stopped talking.", "en", "Change you noticed"],
    ["I had a stroke and he stopped talking.", "en", "Change you noticed"],
    [
      "I currently receive speech therapy and he stopped talking.",
      "en",
      "Change you noticed"
    ],
    [
      "I currently receive speech therapy and they stopped talking.",
      "en",
      "Change you noticed"
    ],
    [
      "I currently receive speech therapy. Stopped talking.",
      "en",
      "Change you noticed"
    ],
    ["Dejó de hablar.", "es", "Cambio que notaste"],
    ["Dejó de decir palabras.", "es", "Cambio que notaste"],
    ["Ya no habla.", "es", "Cambio que notaste"],
    ["Antes hablaba pero ya no.", "es", "Cambio que notaste"],
    ["Perdió palabras.", "es", "Cambio que notaste"],
    ["Olvidó cómo caminar.", "es", "Cambio que notaste"],
    ["Me preocupa porque él dejó de hablar.", "es", "Cambio que notaste"],
    [
      "Tuve un derrame cerebral y él dejó de hablar.",
      "es",
      "Cambio que notaste"
    ],
    [
      "Actualmente recibo terapia del habla y él dejó de hablar.",
      "es",
      "Cambio que notaste"
    ],
    [
      "Actualmente recibo terapia del habla. Dejó de hablar.",
      "es",
      "Cambio que notaste"
    ]
  ] as const)(
    "keeps the parallel child regression supported: %s",
    (text, language, regressionLabel) => {
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );

      expect(
        result.facts.some(({ label }) => label === regressionLabel)
      ).toBe(true);
      expect(analysis.support.therapies).toBe("supported");
      expect(result.domains.some(({ domain }) => domain === "therapies")).toBe(
        true
      );
    }
  );

  it.each([
    [
      "I stopped talking, but he stopped walking.",
      "en",
      "he stopped walking.",
      "Change you noticed"
    ],
    [
      "He stopped walking, but I stopped talking.",
      "en",
      "He stopped walking",
      "Change you noticed"
    ],
    [
      "Dejé de hablar, pero él dejó de caminar.",
      "es",
      "él dejó de caminar.",
      "Cambio que notaste"
    ],
    [
      "Él dejó de caminar, pero yo dejé de hablar.",
      "es",
      "Él dejó de caminar",
      "Cambio que notaste"
    ],
    [
      "I used to talk with him, but he no longer talks.",
      "en",
      "he no longer talks.",
      "Change you noticed"
    ],
    [
      "I used to talk with him, but he no longer does.",
      "en",
      "I used to talk with him, but he no longer does.",
      "Change you noticed"
    ],
    [
      "I used to talk with him, but now he no longer does.",
      "en",
      "I used to talk with him, but now he no longer does.",
      "Change you noticed"
    ],
    [
      "Yo antes hablaba con él, pero él ya no habla.",
      "es",
      "él ya no habla.",
      "Cambio que notaste"
    ],
    [
      "Yo antes hablaba con él, pero él ya no.",
      "es",
      "Yo antes hablaba con él, pero él ya no.",
      "Cambio que notaste"
    ],
    [
      "Yo antes hablaba con él, pero ahora él ya no.",
      "es",
      "Yo antes hablaba con él, pero ahora él ya no.",
      "Cambio que notaste"
    ]
  ] as const)(
    "emits each mixed-actor regression clause without caregiver suppression: %s",
    (text, language, childSnippet, regressionLabel) => {
      const analysis = analyzeFamilyNarrative(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );

      expect(analysis.support.therapies).toBe("supported");
      expect(result.domains.map(({ domain }) => domain)).toEqual(["therapies"]);
      expect(
        result.facts.some(
          ({ label, sourceSnippet }) =>
            label === regressionLabel && sourceSnippet === childSnippet
        )
      ).toBe(true);
    }
  );

  it.each([
    [
      "He stopped walking, but he has trouble talking.",
      "en",
      "Change you noticed",
      "About talking"
    ],
    [
      "Él dejó de caminar, pero él tiene dificultad para hablar.",
      "es",
      "Cambio que notaste",
      "Sobre el habla"
    ]
  ] as const)(
    "keeps an independent observation beside clause-local regression: %s",
    (text, language, regressionLabel, speechLabel) => {
      const result = extractFamilyInterviewMock(
        text,
        schoolAgeFamilyState.profile!,
        FIXED_NOW,
        language
      );

      expect(result.facts.some(({ label }) => label === regressionLabel)).toBe(
        true
      );
      expect(result.facts.some(({ label }) => label === speechLabel)).toBe(
        true
      );
      expect(result.domains.map(({ domain }) => domain)).toEqual(["therapies"]);
    }
  );

  it.each([
    ["I stopped talking after my stroke.", "en", false],
    ["I stopped saying words.", "en", false],
    ["I no longer talk.", "en", false],
    ["I used to talk but no longer do.", "en", false],
    ["He used to talk with me, but I no longer do.", "en", false],
    ["He used to talk with me, but now I no longer do.", "en", false],
    ["I had a stroke, and then stopped talking.", "en", false],
    ["I currently receive speech therapy and stopped talking.", "en", false],
    ["Dejé de hablar.", "es", false],
    ["Ya no hablo.", "es", false],
    ["Yo antes hablaba pero ya no.", "es", false],
    ["Él antes hablaba conmigo, pero yo ya no.", "es", false],
    ["Él antes hablaba conmigo, pero ahora yo ya no.", "es", false],
    ["Actualmente recibo terapia del habla y dejé de hablar.", "es", false],
    ["He stopped talking.", "en", true],
    ["He stopped saying words.", "en", true],
    ["He no longer talks.", "en", true],
    ["He used to talk but no longer does.", "en", true],
    ["I had a stroke and he stopped talking.", "en", true],
    ["I currently receive speech therapy and he stopped talking.", "en", true],
    ["I currently receive speech therapy and they stopped talking.", "en", true],
    ["I currently receive speech therapy. Stopped talking.", "en", true],
    ["I stopped talking, but he stopped walking.", "en", true],
    ["He stopped walking, but I stopped talking.", "en", true],
    ["I used to talk with him, but he no longer talks.", "en", true],
    ["I used to talk with him, but he no longer does.", "en", true],
    ["I used to talk with him, but now he no longer does.", "en", true],
    ["Dejó de hablar.", "es", true],
    ["Ya no habla.", "es", true],
    ["Antes hablaba pero ya no.", "es", true],
    ["Tuve un derrame cerebral y él dejó de hablar.", "es", true],
    ["Actualmente recibo terapia del habla y él dejó de hablar.", "es", true],
    ["Actualmente recibo terapia del habla. Dejó de hablar.", "es", true],
    ["Dejé de hablar, pero él dejó de caminar.", "es", true],
    ["Él dejó de caminar, pero yo dejé de hablar.", "es", true],
    ["Yo antes hablaba con él, pero él ya no habla.", "es", true],
    ["Yo antes hablaba con él, pero él ya no.", "es", true],
    ["Yo antes hablaba con él, pero ahora él ya no.", "es", true]
  ] as const)(
    "raises the text regression flag only for supported child evidence: %s",
    (text, language, expected) => {
      expect(
        shouldRaiseFamilyRegressionFlag(
          text,
          schoolAgeFamilyState.profile!,
          language
        )
      ).toBe(expected);
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
        value: "You wrote about school and learning",
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
        value: "Escribiste sobre la escuela y el aprendizaje",
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

  it("adds neutral evaluation education to F03 without inventing a diagnosis", () => {
    const text =
      "Zoe is four. She covers her ears in busy places, avoids group play, and has trouble with back-and-forth language. She has no diagnosis. I want evidence about whether speech or occupational therapy and a developmental evaluation make sense; I do not want the app to put a label on her.";
    const result = extractFamilyInterviewMock(
      text,
      { ...schoolAgeFamilyState.profile!, childFirstName: "Zoe", birthYear: 2022 },
      new Date("2026-08-03T12:00:00Z")
    );

    expect(result.domains).toEqual(
      expect.arrayContaining([
        { domain: "therapies", rationale: expect.any(String) },
        {
          domain: "diagnosis_education",
          rationale:
            "You asked for checked information about evaluation options without applying a label."
        }
      ])
    );
    expect(result.facts.map(({ label }) => label)).not.toContain(
      "Reported diagnosis"
    );
    expect(JSON.stringify(result)).not.toMatch(/autism|adhd|dyslexia/i);
  });

  it.each([
    "She has no diagnosis.",
    "I wonder whether this could be autism.",
    "The school is concerned about dyslexia and ADHD, and we are waiting for an evaluation."
  ])("does not infer neutral evaluation education from %s", (text) => {
    const result = extractFamilyInterviewMock(
      text,
      schoolAgeFamilyState.profile!
    );
    expect(result.domains.map(({ domain }) => domain)).not.toContain(
      "diagnosis_education"
    );
  });

  it.each([
    ["What does a developmental evaluation look at?", "en"],
    [
      "She has no diagnosis; I want to understand the options without labeling her.",
      "en"
    ],
    [
      "Quiero información sobre lo que incluye una evaluación del desarrollo sin ponerle una etiqueta.",
      "es"
    ]
  ] as const)("preserves an explicit neutral education ask in %s", (text, language) => {
    const result = extractFamilyInterviewMock(
      text,
      schoolAgeFamilyState.profile!,
      new Date("2026-08-03T12:00:00Z"),
      language
    );
    expect(result.domains.map(({ domain }) => domain)).toContain(
      "diagnosis_education"
    );
  });

  it("drops an ungrounded live diagnosis-education domain", () => {
    const result = reconcileFamilyInterviewResult(
      {
        facts: [],
        domains: [
          {
            domain: "diagnosis_education",
            rationale: "The model guessed that education might help."
          }
        ],
        followUps: []
      },
      {
        rawText: "She has no diagnosis.",
        profile: schoolAgeFamilyState.profile!,
        language: "en",
        now: new Date("2026-08-03T12:00:00Z")
      }
    );

    expect(result.domains).toEqual([]);
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
        value: "You wrote about school and learning",
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
        value: "You wrote about school and learning",
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
