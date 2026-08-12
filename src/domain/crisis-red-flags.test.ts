import { describe, expect, it } from "vitest";
import { crisisGateCorpus, CRISIS_RECALL_FLOOR } from "./crisis-red-flags.corpus";
import { crisisTierForDomain, measureCrisisRecall, screenCrisisRedFlags } from "./crisis-red-flags";

describe("screenCrisisRedFlags", () => {
  it("detects sudden vision red flags (hypertensive-emergency presentation)", () => {
    expect(screenCrisisRedFlags("A curtain came over my vision").matched).toBe(true);
    expect(screenCrisisRedFlags("I suddenly cannot see out of one eye").matched).toBe(true);
    expect(screenCrisisRedFlags("I have new flashes and floaters").matched).toBe(true);
    expect(screenCrisisRedFlags("A curtain came over my vision").domain).toBe("vision");
  });

  it("detects plain-language acute vision symptoms the corpus patterns miss", () => {
    expect(screenCrisisRedFlags("I am losing my sight").domain).toBe("vision");
    expect(screenCrisisRedFlags("a curtain came over my eye").domain).toBe("vision");
    expect(screenCrisisRedFlags("lots of new floaters today").domain).toBe("vision");
    expect(screenCrisisRedFlags("I keep seeing flashes of light").domain).toBe("vision");
    expect(screenCrisisRedFlags("everything went dark for a minute").domain).toBe("vision");
    expect(screenCrisisRedFlags("I think I am going blind").domain).toBe("vision");
  });

  it("does not flag general vision-education questions as a crisis", () => {
    expect(screenCrisisRedFlags("will I go blind from diabetes?").matched).toBe(false);
    expect(screenCrisisRedFlags("will I lose my vision someday?").matched).toBe(false);
    expect(screenCrisisRedFlags("what is diabetic retinopathy?").matched).toBe(false);
  });

  it("detects self-harm and suicidal ideation", () => {
    const result = screenCrisisRedFlags("I do not want to wake up tomorrow");

    expect(result.matched).toBe(true);
    expect(result.domain).toBe("self_harm");
    expect(result.ruleIds.length).toBeGreaterThan(0);
  });

  it("detects the added self-harm phrasings", () => {
    expect(screenCrisisRedFlags("I don't want to be here anymore").domain).toBe("self_harm");
    expect(screenCrisisRedFlags("I want to die").domain).toBe("self_harm");
    expect(screenCrisisRedFlags("I feel like ending it all").domain).toBe("self_harm");
  });

  it("detects intentional overdose disclosures with the medicine named", () => {
    expect(screenCrisisRedFlags("I took the whole bottle of my lisinopril on purpose").domain).toBe("self_harm");
    expect(screenCrisisRedFlags("I swallowed all my metformin to end it").domain).toBe("self_harm");
    expect(screenCrisisRedFlags("I took all of my amlodipine because I wanted to die").domain).toBe("self_harm");
  });

  it("does not flag honest medication logging as an overdose", () => {
    expect(screenCrisisRedFlags("I took all my metformin this morning like I'm supposed to").matched).toBe(false);
    expect(screenCrisisRedFlags("I took the whole bottle home from the pharmacy").matched).toBe(false);
  });

  it("detects acute danger language that must not stay in routine coaching", () => {
    expect(screenCrisisRedFlags("I have crushing chest pain and cannot breathe").matched).toBe(true);
    expect(screenCrisisRedFlags("My face is drooping and my speech is slurred").matched).toBe(true);
    expect(screenCrisisRedFlags("worst headache of my life and my BP is 210 over 120").domain).toBe("acute_danger");
  });

  it("detects child breathing danger and age-modified missing-child reports", () => {
    expect(screenCrisisRedFlags("My child cannot breathe")).toMatchObject({
      matched: true,
      domain: "acute_danger"
    });
    expect(screenCrisisRedFlags("My 7-year-old daughter is missing")).toMatchObject({
      matched: true,
      domain: "acute_danger"
    });
  });

  it.each([
    ["my son says he wants to die", "self_harm"],
    ["honestly she's been saying she wants to die", "self_harm"],
    ["my daughter has been hurting herself", "self_harm"],
    ["he told me he wants to kill himself", "self_harm"],
    ["my kid ran away from home and we can't find her", "acute_danger"],
    ["I can't do this anymore, I want to give up", "caregiver_collapse"]
  ] as const)("classifies caregiver regression %s as %s", (text, domain) => {
    expect(screenCrisisRedFlags(text)).toMatchObject({ matched: true, domain });
  });

  it.each([
    ["my son wants to end his life", "self_harm"],
    ["my daughter threatens to hurt herself", "self_harm"],
    ["my son keeps cutting himself", "self_harm"],
    ["my child wandered off and we still cannot find them", "acute_danger"],
    ["my child got out of the house and is missing", "acute_danger"],
    ["someone is hurting my child", "abuse"],
    ["my daughter is being abused", "abuse"]
  ] as const)("classifies caregiver safety phrase %s as %s", (text, domain) => {
    expect(screenCrisisRedFlags(text)).toMatchObject({ matched: true, domain });
  });

  it.each([
    ["quiero morir", "self_harm"],
    ["me quiero matar", "self_harm"],
    ["ya no quiero vivir", "self_harm"],
    ["mi hijo dice que ya no quiere vivir", "self_harm"],
    ["mi hija se está cortando", "self_harm"],
    ["mi hija dice que quiere morir", "self_harm"],
    ["mi hijo me dijo que quiere matarse", "self_harm"],
    ["mi hija ha dicho que quiere quitarse la vida", "self_harm"],
    ["mi hijo no quiere seguir viviendo", "self_harm"],
    ["mi hija amenaza con hacerse daño", "self_harm"],
    ["mi hijo sigue cortándose", "self_harm"],
    ["mi hija ha estado haciéndose daño", "self_harm"],
    ["estoy pensando en matarme", "self_harm"],
    ["pienso quitarme la vida", "self_harm"],
    ["me voy a matar", "self_harm"],
    ["voy a suicidarme", "self_harm"],
    ["no quiero despertar mañana", "self_harm"],
    ["quiero acabar con mi vida", "self_harm"],
    ["mi hijo dice que piensa matarse", "self_harm"],
    ["mi hija me dijo que va a suicidarse", "self_harm"],
    ["mi hijo dijo que quiere acabar con su vida", "self_harm"],
    ["mi nena dice que quiere morir", "self_harm"],
    ["mi hijo piensa en matarse", "self_harm"],
    ["mi hijo está pensando en suicidarse", "self_harm"],
    ["mi hija amenaza con suicidarse", "self_harm"],
    ["mi hija intentó quitarse la vida", "self_harm"],
    ["mi nino dice que quiere morir", "self_harm"],
    ["mi hija nunca dijo que quería morir, pero ahora dice que quiere morir", "self_harm"],
    ["mi hija no dice que quiere morir; mi hijo sí dice que quiere morir", "self_harm"],
    ["mi hija no se está cortando, pero mi hijo sí se está cortando", "self_harm"],
    ["mi hija nunca amenazó con hacerse daño, pero hoy mi hijo amenaza con hacerse daño", "self_harm"],
    ["mi hijo dice que se quiere matar", "self_harm"],
    ["mi hija dice que se va a suicidar", "self_harm"],
    ["mi niño trató de matarse", "self_harm"],
    ["mi adolescente intentó cortarse", "self_harm"],
    ["mi niña amenaza con cortarse", "self_harm"],
    ["mi hijo quiere terminar con su vida", "self_harm"],
    ["mi hijo está cortándose", "self_harm"],
    ["mi hija se está haciendo daño", "self_harm"],
    ["mi hija se corta los brazos", "self_harm"],
    ["mi hijo se ha cortado a propósito", "self_harm"],
    ["mi hija se cortó ayer a propósito", "self_harm"],
    ["mi niño volvió a cortarse", "self_harm"],
    ["mi hija se hace daño", "self_harm"],
    ["mi hijo se lastima a propósito", "self_harm"],
    ["mi nena empezó a cortarse", "self_harm"],
    ["mi hijo se hirió a propósito", "self_harm"],
    ["mi hija se quemó a propósito", "self_harm"],
    ["mi adolescente se rasguña hasta sangrar", "self_harm"],
    ["mi hija se estaba cortando, pero ya dejó de hacerlo", "self_harm"],
    ["mi hija dice que quiere suisidarse", "self_harm"],
    ["mi hija tiene cortes que se hizo ella misma", "self_harm"],
    ["mi hijo se escapó de casa y todavía no lo encontramos", "acute_danger"],
    ["mi niña salió de la casa y sigue desaparecida", "acute_danger"],
    ["mi hijo está desaparecido", "acute_danger"],
    ["no encuentro a mi hijo; se escapó de casa", "acute_danger"],
    ["se escapó de casa mi hijo y no lo encontramos", "acute_danger"],
    ["mi hija se perdió y todavía no aparece", "acute_danger"],
    ["mi hijo salió de casa y no ha vuelto", "acute_danger"],
    ["mi nena se escapó de casa y no la encontramos", "acute_danger"],
    ["mi nina se escapo de casa y no la encontramos", "acute_danger"],
    ["mi pequeño se escapó de casa y no lo encuentro", "acute_danger"],
    ["mi bebé se perdió y todavía no aparece", "acute_danger"],
    ["mi hijito salió de casa y no ha vuelto", "acute_danger"],
    ["mi hija se fugó de casa y todavía no aparece", "acute_danger"],
    ["mi hijo desapareció y aún no lo encontramos", "acute_danger"],
    ["mi hijo lleva horas desaparecido", "acute_danger"],
    ["no sé dónde está mi hija desde anoche", "acute_danger"],
    ["mi hija de doce años salió y no regresó", "acute_danger"],
    ["Mateo se escapó de casa y todavía no lo encontramos", "acute_danger"],
    ["alguien está lastimando a mi hija", "abuse"],
    ["están abusando de mi hijo", "abuse"],
    ["están abusando de mi nene", "abuse"],
    ["abusaron de mi hija", "abuse"],
    ["mi hijo dice que su entrenador lo está lastimando", "abuse"],
    ["mi hijo dice que alguien le pega", "abuse"],
    ["mi niña fue golpeada por su cuidador", "abuse"],
    ["mi hijo sufrió abuso sexual", "abuse"],
    ["mi hija me contó que la tocaron inapropiadamente", "abuse"],
    ["mi menor está recibiendo golpes en casa", "abuse"],
    ["el cuidador maltrata a mi hijo", "abuse"],
    ["el novio de mi hija la está golpeando", "abuse"],
    ["mi hija dice que la están abusando", "abuse"],
    ["no están abusando de mi hija, pero están abusando de mi hijo", "abuse"],
    ["mi hija no está siendo abusada, pero mi hijo sí está siendo abusado", "abuse"],
    ["ya no puedo hacer esto, quiero rendirme", "caregiver_collapse"],
    ["no aguanto más con esto y me quiero rendir", "caregiver_collapse"],
    ["ya no puedo más, quiero rendirme", "caregiver_collapse"],
    ["no puedo con esto, quiero rendirme", "caregiver_collapse"],
    ["ya no doy más, quiero rendirme", "caregiver_collapse"],
    ["no puedo más, me rindo", "caregiver_collapse"],
    ["no aguanto más, voy a rendirme", "caregiver_collapse"],
    ["quiero abandonar todo porque ya no puedo más", "caregiver_collapse"]
  ] as const)("classifies Spanish caregiver safety phrase %s as %s", (text, domain) => {
    expect(screenCrisisRedFlags(text)).toMatchObject({ matched: true, domain });
  });

  it.each([
    "he hurt himself at recess yesterday",
    "this waitlist is killing me",
    "I give up trying to get her to eat vegetables",
    "she's dying to ride the horses",
    "he ran away with the soccer ball"
  ])("does not flag caregiver trap %s", (text) => {
    expect(screenCrisisRedFlags(text).matched).toBe(false);
  });

  it.each([
    "my father wants to end his life insurance policy",
    "she wants to end her life support",
    "my dog ran away from home and we still cannot find her",
    "my package got out of the house and is missing"
  ])("does not flag caregiver-context trap %s", (text) => {
    expect(screenCrisisRedFlags(text).matched).toBe(false);
  });

  it.each([
    "mi hija no quiere morir; quiere vivir",
    "mi hija no dice que quiere morir",
    "mi hija nunca ha dicho que quiere morir",
    "mi hija no está diciendo que quiere morir",
    "mi hija nunca amenaza con hacerse daño",
    "mi hija no se está cortando",
    "no están abusando de mi hijo",
    "no quiero vivir en Lexington",
    "mi hija no quiere vivir con su padre",
    "mi hija se está cortando el pelo",
    "mi hija sigue cortándose las puntas",
    "mi hija no está siendo abusada",
    "nadie está abusando de mi hijo",
    "mi hijo nunca ha sido maltratado",
    "mi hija no fue maltratada",
    "no es cierto que alguien está lastimando a mi hija",
    "mi hijo fue evaluado, no maltratado",
    "mi hijo está triste porque su perro se escapó de casa y todavía no lo encontramos",
    "mi hija busca a su gato que se perdió y no lo encontramos",
    "mi hijo dijo que mi perro se fue de casa y aún no lo encuentro",
    "mi hijo dijo que mi perro se perdió y no lo encuentro",
    "mi hijo se escapó de casa y no lo encontramos al principio, pero ya volvió",
    "no aguanto más con esto, pero jamás me quiero rendir",
    "ya no puedo hacer esto, pero tampoco quiero rendirme",
    "ya no puedo hacer esto, pero no quiero darme por vencida",
    "no aguanto más con esto, pero de ninguna manera quiero rendirme",
    "mi hijo nunca se haría daño",
    "se lastimó jugando al fútbol",
    "esta lista de espera me está matando",
    "mi hija se muere por montar a caballo",
    "mi hija dice que quiere morirse de vergüenza",
    "mi hijo sigue cortándose el pelo",
    "mi hijo quiere acabar con su vida escolar",
    "me rindo tratando de que coma verduras",
    "mi perro se escapó de casa y todavía no lo encontramos",
    "el programa está abusando de mi paciencia",
    "quiere cancelar su seguro de vida",
    "ya no puedo hacer esto, pero no quiero rendirme",
    "mi hija se escapó de casa y no la encontramos al principio; ahora está conmigo",
    "mi niño se perdió y todavía no aparece en el cuento",
    "en la película la nena se escapó de casa y no la encuentran",
    "la guía pregunta si mi hija está siendo abusada",
    "dijeron que mi hijo fue abusado, pero no es cierto",
    "mi hija fue abusada según el formulario, pero esa respuesta fue un error",
    "no aguanto más este crucigrama y quiero rendirme",
    "ya no puedo hacer esto en el videojuego, quiero rendirme",
    "no puedo seguir así con esta dieta, quiero rendirme",
    "quiero quitarme la vida sedentaria",
    "mi hijo salió de casa y no ha vuelto, pero volvió hace una hora",
    "¿qué debo hacer si mi hijo se escapó de casa y no lo encontramos?",
    "¿cómo sé si mi hijo está siendo abusado?",
    "no creo que mi hija esté siendo abusada",
    "no aguanto más con esta tarea y quiero rendirme",
    "no puedo más con la burocracia, quiero rendirme con la solicitud",
    "no aguanto más este nivel y me quiero rendir"
  ])("does not flag Spanish caregiver trap %s", (text) => {
    expect(screenCrisisRedFlags(text).matched).toBe(false);
  });

  it("strips negated self-harm spans but still fires on residual disclosures", () => {
    expect(screenCrisisRedFlags("I would never hurt myself").matched).toBe(false);
    expect(screenCrisisRedFlags("I'm not going to hurt myself, I just feel down").matched).toBe(false);
    expect(screenCrisisRedFlags("no thoughts of hurting myself").matched).toBe(false);
    // Negation strip removes only the negated span, so a later disclosure survives.
    expect(screenCrisisRedFlags("I said I'd never hurt myself but I want to die").matched).toBe(true);
  });

  it("does not flag figurative or logistics text", () => {
    expect(screenCrisisRedFlags("I need a Saturday appointment").matched).toBe(false);
    expect(screenCrisisRedFlags("Can someone help me find a ride?").matched).toBe(false);
    expect(screenCrisisRedFlags("this diet is killing me").matched).toBe(false);
    expect(screenCrisisRedFlags("the pharmacy is killing me with these prices").matched).toBe(false);
    expect(screenCrisisRedFlags("I need a ride to my eye appointment").matched).toBe(false);
  });

  it("hard-locks model-backstop-only hits and marks rule gaps", () => {
    const result = screenCrisisRedFlags("The model caught this but rules did not", {
      modelBackstopMatched: true
    });

    expect(result.matched).toBe(true);
    expect(result.source).toBe("model_backstop");
    expect(result.requiresRuleGapTicket).toBe(true);
  });
});

describe("harm-to-others disclosures", () => {
  it("detects caregiver-reported harm toward animals and other people", () => {
    for (const text of [
      "He has been harmful towards animals",
      "my son hurt the cat again and I do not know what to do",
      "he has been hurting other kids at school",
      "he threatened to hurt his teacher during the meltdown",
      "the school called because he brought a knife to school",
      "mi hijo lastima a los animales cuando se enoja"
    ]) {
      const result = screenCrisisRedFlags(text);
      expect(result.matched, text).toBe(true);
      expect(result.domain, text).toBe("harm_to_others");
    }
  });

  it("leaves roughness, denials, and a plain discipline record unmatched", () => {
    for (const text of [
      "he is rough with the dog sometimes and we are working on it",
      "she chased the cat around the yard all afternoon",
      "he has been kicked out of school several times for violence and acting out",
      "he would never hurt the dog, he adores her",
      "they fight over toys every single afternoon",
      "mi hijo no golpea a otros niños en la escuela"
    ]) {
      expect(screenCrisisRedFlags(text).matched, text).toBe(false);
    }
  });

  it("keeps self-harm precedence when a disclosure points both ways", () => {
    const result = screenCrisisRedFlags("he says he wants to die and he hurt the cat");
    expect(result.matched).toBe(true);
    expect(result.domain).toBe("self_harm");
    expect(result.ruleIds).toContain("harm_to_others_reported");
  });

  it("does not treat a reflexive threat as harm to others", () => {
    const result = screenCrisisRedFlags("he threatened to hurt himself again last night");
    expect(result.matched).toBe(true);
    expect(result.domain).toBe("self_harm");
    expect(result.ruleIds).not.toContain("harm_to_others_reported");
  });
});

describe("crisisTierForDomain", () => {
  it("routes self-harm to crisis and vision/acute to emergency", () => {
    expect(crisisTierForDomain("self_harm")).toBe("crisis");
    expect(crisisTierForDomain("caregiver_collapse")).toBe("crisis");
    expect(crisisTierForDomain("abuse")).toBe("crisis");
    expect(crisisTierForDomain("harm_to_others")).toBe("crisis");
    expect(crisisTierForDomain("vision")).toBe("emergency");
    expect(crisisTierForDomain("acute_danger")).toBe("emergency");
    expect(crisisTierForDomain("logistics")).toBeNull();
    expect(crisisTierForDomain(null)).toBeNull();
  });
});

describe("measureCrisisRecall", () => {
  it("meets the recall floor with zero false positives on the maintained corpus", () => {
    const report = measureCrisisRecall(crisisGateCorpus);

    expect(report.recall).toBeGreaterThanOrEqual(CRISIS_RECALL_FLOOR);
    expect(report.falseNegatives).toEqual([]);
    expect(report.falsePositives).toEqual([]);
    expect(report.totalExpectedPositive).toBeGreaterThan(0);

    for (const testCase of crisisGateCorpus.filter((entry) => entry.expectedMatched)) {
      expect(screenCrisisRedFlags(testCase.text).domain, testCase.id).toBe(testCase.domain);
    }
  });
});
