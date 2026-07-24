import { describe, expect, it } from "vitest";
import { decideFrontDoor } from "./front-door";
import { crisisGateCorpus } from "./crisis-red-flags.corpus";
import { CLASSIFIER_HREFS } from "./route-classifier";
import { MENU_GROUPS } from "@/components/menu-grid";
import { demoState } from "./fixtures";
import type { AppState } from "./types";

const en: AppState = demoState;
const es: AppState = { ...demoState, patient: { ...demoState.patient, language: "es" } };

describe("decideFrontDoor — safety first", () => {
  it("never routes a crisis-corpus positive to a feature screen", () => {
    const positives = crisisGateCorpus.filter((c) => c.expectedMatched);
    for (const c of positives) {
      const route = decideFrontDoor(c.text, en);
      expect(route.kind, `"${c.text}" must go to the Coach`).toBe("coach");
    }
  });

  it("routes dangerous readings and med-change requests to the Coach, not a feature", () => {
    expect(decideFrontDoor("my blood pressure is 190 over 120", en).kind).toBe("coach");
    expect(decideFrontDoor("should I stop taking my lisinopril", en).kind).toBe("coach");
    expect(decideFrontDoor("I have no food today", en).kind).toBe("coach");
  });

  it("tags a safety coach distinctly from a no-match coach, so only no-match reaches the LLM", () => {
    const crisis = decideFrontDoor("I want to die", en);
    const question = decideFrontDoor("what should I make for dinner tonight really", en);
    expect(crisis).toMatchObject({ kind: "coach", reason: "safety" });
    expect(question).toMatchObject({ kind: "coach", reason: "no_match" });
  });

  it("routes the caregiver demo disclosure to safety instead of feature navigation", () => {
    expect(decideFrontDoor("honestly she's been saying she wants to die", en)).toMatchObject({
      kind: "coach",
      reason: "safety"
    });
  });

  it("keeps family help language behind the crisis gate", () => {
    expect(decideFrontDoor("help for my daughter, she says she wants to die", en)).toMatchObject({
      kind: "coach",
      reason: "safety"
    });
  });

  it("keeps a safety phrase containing a hub synonym with the Coach", () => {
    expect(decideFrontDoor("I want to die during this wellness check", en)).toMatchObject({
      kind: "coach",
      reason: "safety"
    });
  });
});

describe("decideFrontDoor — deterministic navigation (English)", () => {
  it("lands a write verb on the real feature screen (form commits, not a silent write)", () => {
    expect(decideFrontDoor("log my blood pressure", en)).toMatchObject({ kind: "navigate", href: "/numbers" });
    expect(decideFrontDoor("check if I took my medicine this morning", en)).toMatchObject({ kind: "navigate", href: "/medicines" });
  });

  it("navigates on an explicit nav verb or a short destination phrase", () => {
    expect(decideFrontDoor("show my visits", en)).toMatchObject({ kind: "navigate", href: "/visits" });
    expect(decideFrontDoor("food", en)).toMatchObject({ kind: "navigate", href: "/food" });
    expect(decideFrontDoor("open support", en)).toMatchObject({ kind: "navigate", href: "/support" });
    expect(decideFrontDoor("mood", en)).toMatchObject({ kind: "navigate", href: "/checkin/phq9" });
  });

  it("routes blood-sugar logging and browsing to the glucose screen", () => {
    expect(decideFrontDoor("log my blood sugar", en)).toMatchObject({ kind: "navigate", href: "/glucose" });
    expect(decideFrontDoor("blood sugar", en)).toMatchObject({ kind: "navigate", href: "/glucose" });
    expect(decideFrontDoor("glucose", en)).toMatchObject({ kind: "navigate", href: "/glucose" });
  });

  it("sends a blood-sugar question to the Coach, not the glucose screen", () => {
    expect(decideFrontDoor("how do I keep my blood sugar under control", en).kind).toBe("coach");
  });

  it("sends a genuine question to the Coach rather than a keyword screen", () => {
    expect(decideFrontDoor("why does my medicine even matter if I feel fine?", en).kind).toBe("coach");
  });

  it("routes eye-screening asks to the screening screen", () => {
    expect(decideFrontDoor("book my eye screening", en)).toMatchObject({ kind: "navigate", href: "/screening" });
    expect(decideFrontDoor("eye check", en)).toMatchObject({ kind: "navigate", href: "/screening" });
    expect(decideFrontDoor("show my eye exam options", en)).toMatchObject({ kind: "navigate", href: "/screening" });
    expect(decideFrontDoor("screening", en)).toMatchObject({ kind: "navigate", href: "/screening" });
  });

  it.each(["health check", "wellness check", "questionnaire"])("routes a health-check phrase to the hub: %s", (utterance) => {
    expect(decideFrontDoor(utterance, en)).toEqual({
      kind: "navigate",
      href: "/checkin",
      label: "Check-ins & screenings"
    });
  });

  it("routes retinopathy learning asks to the learning page, not the booking flow", () => {
    expect(decideFrontDoor("learn about diabetic eye disease", en)).toMatchObject({
      kind: "navigate",
      href: "/learn/retinopathy"
    });
    expect(decideFrontDoor("retinopathy", en)).toMatchObject({ kind: "navigate", href: "/learn/retinopathy" });
    expect(decideFrontDoor("book a retinopathy screening", en)).toMatchObject({ kind: "navigate", href: "/screening" });
  });

  it.each(["help for my daughter", "resources for my child", "support for my son"])(
    "routes family-specific help intent with the public navigator label: %s",
    (utterance) => {
      expect(decideFrontDoor(utterance, en)).toEqual({
        kind: "navigate",
        href: "/family",
        label: "Ladder — your child's development"
      });
    }
  );

  it.each([
    "how do I help my daughter with homework?",
    "help with our kid's homework",
    "I support my daughter at soccer"
  ])("does not steal ordinary parenting language for the family route: %s", (utterance) => {
    expect(decideFrontDoor(utterance, en)).toMatchObject({ kind: "coach", reason: "no_match" });
  });

  it("keeps bare resources on general support", () => {
    expect(decideFrontDoor("resources", en)).toMatchObject({ kind: "navigate", href: "/support" });
  });

  it("prefers general support when a family phrase names an SDOH need", () => {
    expect(decideFrontDoor("rent support for my son", en)).toEqual({
      kind: "navigate",
      href: "/support",
      label: "Support"
    });
  });

  it("routes explicit developmental intent in alternate word order", () => {
    expect(decideFrontDoor("help my child find developmental resources", en)).toEqual({
      kind: "navigate",
      href: "/family",
      label: "Ladder — your child's development"
    });
  });

  it.each(["help with our child", "resources for our daughter", "support with my kid"])(
    "routes canonical caregiver relationship help forms: %s",
    (utterance) => {
      expect(decideFrontDoor(utterance, en)).toMatchObject({ kind: "navigate", href: "/family" });
    }
  );
});

describe("decideFrontDoor — constrained classifier stage", () => {
  it("uses the classifier to bridge a synonym the lexicon misses", () => {
    expect(decideFrontDoor("take me to my prescription list", en)).toMatchObject({ kind: "navigate", href: "/medicines" });
  });

  it("still defers a concern to the Coach rather than a screen", () => {
    expect(decideFrontDoor("my prescriptions are confusing me", en).kind).toBe("coach");
  });

  it("never emits anything but coach or navigate — the front door cannot write", () => {
    const samples = ["log my blood pressure", "show my medicines", "why does this matter", "I want to die", "random gibberish", "take me to my prescriptions"];
    for (const sample of samples) {
      expect(["coach", "navigate"], `"${sample}"`).toContain(decideFrontDoor(sample, en).kind);
    }
  });

  it("keeps the classifier route set in lockstep with the menu (no dead destinations)", () => {
    const menuRoutes = new Set(MENU_GROUPS.flatMap((group) => group.items.map((item) => item.href)));
    expect(new Set(CLASSIFIER_HREFS)).toEqual(menuRoutes);
  });
});

describe("decideFrontDoor — Spanish", () => {
  it("routes Spanish commands deterministically for Spanish patients", () => {
    expect(decideFrontDoor("muéstrame mis medicinas", es)).toMatchObject({ kind: "navigate", href: "/medicines" });
    expect(decideFrontDoor("registré mi presión", es)).toMatchObject({ kind: "navigate", href: "/numbers" });
    expect(decideFrontDoor("comida", es)).toMatchObject({ kind: "navigate", href: "/food" });
  });

  it("keeps the eye check and the mood check-in apart in Spanish", () => {
    expect(decideFrontDoor("chequeo de ojos", es)).toMatchObject({ kind: "navigate", href: "/screening" });
    expect(decideFrontDoor("chequeo", es)).toMatchObject({ kind: "navigate", href: "/checkin/phq9" });
    expect(decideFrontDoor("chequeo de salud", es)).toEqual({
      kind: "navigate",
      href: "/checkin",
      label: "Chequeos y evaluaciones"
    });
  });

  it("routes Spanish retinopathy learning asks to the learning page", () => {
    expect(decideFrontDoor("aprender retinopatía diabética", es)).toMatchObject({
      kind: "navigate",
      href: "/learn/retinopathy"
    });
  });

  it.each(["ayuda para mi hija", "recursos para mi hijo"])(
    "routes Spanish family-specific help intent deterministically: %s",
    (utterance) => {
      expect(decideFrontDoor(utterance, es)).toMatchObject({ kind: "navigate", href: "/family" });
    }
  );

  it("does not steal ordinary Spanish parenting language for the family route", () => {
    expect(decideFrontDoor("ayuda con mi hija en fútbol", es)).toMatchObject({ kind: "coach", reason: "no_match" });
  });

  it("prefers general support when a Spanish family phrase names an SDOH need", () => {
    expect(decideFrontDoor("ayuda para mi hijo con la renta", es)).toEqual({
      kind: "navigate",
      href: "/support",
      label: "Apoyo"
    });
  });

  it("keeps generic child services on the family navigator", () => {
    expect(decideFrontDoor("servicios para mi hijo", es)).toEqual({
      kind: "navigate",
      href: "/family",
      label: "Ladder — el desarrollo de tu hijo o hija"
    });
  });

  it("routes Spanish public-utility help to general support", () => {
    expect(decideFrontDoor("ayuda para mi hijo con servicios públicos", es)).toEqual({
      kind: "navigate",
      href: "/support",
      label: "Apoyo"
    });
  });

  it("routes explicit Spanish developmental intent in alternate word order", () => {
    expect(decideFrontDoor("ayuda a mi hija a encontrar recursos de desarrollo", es)).toEqual({
      kind: "navigate",
      href: "/family",
      label: "Ladder — el desarrollo de tu hijo o hija"
    });
  });

  it("keeps Spanish family phrases isolated by patient language", () => {
    expect(decideFrontDoor("ayuda para mi hija", en)).toMatchObject({ kind: "coach", reason: "no_match" });
    expect(decideFrontDoor("ayuda para mi hija", es)).toMatchObject({ kind: "navigate", href: "/family" });
  });

  it("does not match the English lexicon for a Spanish patient", () => {
    expect(decideFrontDoor("show my medicines", es).kind).toBe("coach");
  });

  it("still routes crisis text to the Coach for a Spanish patient", () => {
    expect(decideFrontDoor("I want to die", es)).toMatchObject({ kind: "coach", reason: "safety" });
  });
});
