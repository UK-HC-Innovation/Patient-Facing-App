import type { Language } from "@/i18n/strings";

/**
 * The lines the app hands GPT-Live to say.
 *
 * Kept out of `@/i18n/strings` on purpose: that table ships on the first load of both food
 * doors, and `/food/demo` has under a kilobyte of bundle headroom. These load with the Live
 * session, which only a mic tap starts.
 */
type LiveLineKey =
  | "score"
  | "bandEncourage"
  | "bandModerate"
  | "bandMinimize"
  | "betterOption"
  | "noCloseSwap"
  | "noScore"
  | "notFound"
  | "didYouMean"
  | "whichOne"
  | "or"
  | "couldNotCheck"
  | "onlyFoodOnScreen"
  | "nothingOnScreen"
  | "thisFood";

const LINES: Record<Language, Record<LiveLineKey, string>> = {
  en: {
    score: "{food} scores {score} out of 100.",
    bandEncourage: "That's a food to encourage.",
    bandModerate: "That's in the moderate range.",
    bandMinimize: "That's one to minimize.",
    betterOption: "{food} scores higher, at {score}.",
    noCloseSwap: "No close swap found.",
    noScore: "{food} has no score. It's outside the range the score covers.",
    notFound: "I couldn't find that one. You can type it.",
    didYouMean: "Did you mean {food}?",
    whichOne: "Which one was it: {options}?",
    or: "or",
    couldNotCheck: "I couldn't check that. You can type it.",
    onlyFoodOnScreen: "I can only speak to the food on screen.",
    nothingOnScreen: "Show me the food or type its name.",
    thisFood: "This food"
  },
  es: {
    score: "{food} obtiene {score} de 100.",
    bandEncourage: "Es un alimento recomendado.",
    bandModerate: "Está en el rango moderado.",
    bandMinimize: "Es mejor limitarlo.",
    betterOption: "{food} obtiene más: {score}.",
    noCloseSwap: "No encontré un cambio parecido.",
    noScore: "{food} no tiene puntaje. Queda fuera del rango del puntaje.",
    notFound: "No encontré ese. Puedes escribirlo.",
    didYouMean: "¿Quisiste decir {food}?",
    whichOne: "¿Cuál era: {options}?",
    or: "o",
    couldNotCheck: "No pude revisarlo. Puedes escribirlo.",
    onlyFoodOnScreen: "Solo puedo hablar de la comida en pantalla.",
    nothingOnScreen: "Muéstrame la comida o escribe su nombre.",
    thisFood: "Esta comida"
  }
};

export function liveLine(
  language: Language,
  key: LiveLineKey,
  vars?: Record<string, string | number>
): string {
  const template = LINES[language]?.[key] ?? LINES.en[key];
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}
