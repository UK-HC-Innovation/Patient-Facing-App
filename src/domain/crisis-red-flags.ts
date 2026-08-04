export type CrisisDomain =
  | "vision"
  | "self_harm"
  | "acute_danger"
  | "logistics"
  | "caregiver_collapse"
  | "abuse"
  | "harm_to_others";
export type CrisisMatchSource = "deterministic" | "model_backstop" | "none";

export interface CrisisScreeningOptions {
  modelBackstopMatched?: boolean;
  modelBackstopLabel?: string;
}

export interface CrisisScreeningResult {
  matched: boolean;
  source: CrisisMatchSource;
  domain: CrisisDomain | null;
  ruleIds: string[];
  requiresRuleGapTicket: boolean;
  modelBackstopLabel?: string;
}

export interface CrisisCorpusCase {
  id: string;
  text: string;
  expectedMatched: boolean;
  domain: CrisisDomain;
}

export interface CrisisRecallReport {
  recall: number;
  totalExpectedPositive: number;
  truePositives: string[];
  falseNegatives: string[];
  falsePositives: string[];
}

interface CrisisRule {
  id: string;
  domain: Exclude<CrisisDomain, "logistics">;
  pattern?: RegExp;
  match?: (input: string) => boolean;
}

// An intentional-overdose disclosure only fires when BOTH the "took the whole
// supply" signal AND an intentionality signal are present, so honest medication
// logging ("I took all my metformin this morning") is not treated as a crisis.
function isIntentionalOverdose(input: string): boolean {
  const tookWholeSupply =
    /(?:took|taken|swallowed|downed)\s+(?:the\s+)?(?:whole\s+bottle|all\s+(?:of\s+)?(?:my|the|them|it))/i.test(input) ||
    /whole\s+bottle\s+of\s+(?:my\s+)?(?:lisinopril|metformin|amlodipine|pills?|medicine|medication)/i.test(input);
  const intentional =
    /on\s+purpose|deliberately|to\s+(?:die|end\s+it|hurt\s+myself|harm\s+myself|kill\s+myself)|because\s+i\s+wanted\s+to\s+die/i.test(
      input
    );
  return tookWholeSupply && intentional;
}

const REPORTED_IDEATION = /\b(?:says?|said|saying|tells?|telling|told me)\b[^.?!]{0,48}\bwant(?:s|ed)? to die\b/i;
const REFLEXIVE_HARM = /\b(?:kill|hurt|cut(?:ting)?)\s+(?:himself|herself|themself|themselves)\b/i;
const REFLEXIVE_INTENT =
  /\b(?:want(?:s|ed)? to|threaten(?:s|ed|ing)? to|plans? to|planned to|trying to|says? (?:he|she|they) (?:will|might)|told me (?:he|she|they) (?:will|might|want(?:s|ed)? to))\b[^.?!]{0,32}\b(?:kill|hurt|cut(?:ting)?)\s+(?:himself|herself|themself|themselves)\b/i;
const ONGOING_SELF_INJURY =
  /\b(?:has been|keeps?|continues? to)\b[^.?!]{0,24}\b(?:hurting|cutting)\s+(?:himself|herself|themself|themselves)\b/i;
const THIRD_PERSON_END_LIFE = /\bwant(?:s|ed)? to end (?:his|her|their) life\b(?!\s+(?:insurance|support)\b)/i;
const MISSING_CHILD =
  /\b(?:(?:my|our|the|a)\s+(?:child|kid|son|daughter|boy|girl|teen(?:ager)?)|he|she|they)\s+(?:ran away(?: from home)?|wandered off|got out of (?:the )?house)\b[^.?!]{0,64}\b(?:(?:we\s+)?(?:still\s+)?(?:can't|cannot|couldn't)\s+find|(?:is|are|still)\s+missing)\b/i;
const CAREGIVER_COLLAPSE =
  /\bcan't do this anymore\b[^.?!]{0,64}\b(?:want to give up|ending it|end it)\b|\b(?:want to give up|ending it|end it)\b[^.?!]{0,64}\bcan't do this anymore\b/i;
const CHILD_HARM_DISCLOSURE =
  /\b(?:someone|somebody)\s+(?:is\s+)?(?:hurting|harming|abusing)\s+(?:my|our)\s+(?:child|kid|son|daughter)\b|\b(?:my|our)\s+(?:child|kid|son|daughter)\b[^.?!]{0,24}\b(?:is\s+)?being abused\b/i;
const SPANISH_CHILD =
  "(?:mi|nuestro|nuestra|el|la)\\s+(?:hij[oa]|hijit[oa]|nin[oa]|nen[aeo]|pequen[oa]|bebe|adolescente|menor)";
const SPANISH_CHILD_WITH_AGE = `${SPANISH_CHILD}(?:\\s+de\\s+(?:[a-z0-9]+\\s+){1,3}anos)?`;

function normalizeSpanish(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function normalizeSpanishPreservingCase(input: string): string {
  return input.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function spanishClauses(input: string): string[] {
  return normalizeSpanish(input)
    .split(/[.!?;,:]+|\b(?:pero|sin embargo)\b/u)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function matchesAny(input: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(input));
}

const SPANISH_DIRECT_SELF_HARM_SIGNALS: readonly RegExp[] = [
  /\b(?:me\s+quiero\s+(?:morir(?:me)?|matar(?:me)?|suicidar(?:me)?|suisidar(?:me)?)|quiero\s+(?:morir(?:me)?\b(?!\s+de\s+(?:verguenza|risa|calor|hambre|sueno))|matarme|suicidarme|suisidarme|quitarme\s+la\s+vida(?!\s+(?:sedentaria|escolar)\b)|acabar\s+con\s+mi\s+vida(?!\s+escolar\b)))\b/u,
  /\b(?:estoy\s+pensando\s+en|pienso(?:\s+en)?|planeo)\s+(?:matarme|suicidarme|suisidarme|quitarme\s+la\s+vida(?!\s+(?:sedentaria|escolar)\b)|acabar\s+con\s+mi\s+vida(?!\s+escolar\b))\b/u,
  /\b(?:me\s+voy\s+a\s+(?:matar|suicidar|suisidar)|voy\s+a\s+(?:matarme|suicidarme|suisidarme|quitarme\s+la\s+vida(?!\s+(?:sedentaria|escolar)\b)))\b/u,
  /\b(?:ya\s+no\s+quiero\s+vivir|no\s+quiero\s+seguir\s+viviendo)\b(?!\s+(?:en|con)\b)/u,
  /\bno\s+quiero\s+despertar(?:\s+manana)?\b/u
];

const SPANISH_DIRECT_SELF_HARM_DENIALS: readonly RegExp[] = [
  /\b(?:no|nunca|jamas)\s+(?:me\s+quiero\s+(?:morir|matar|suicidar)|quiero\s+(?:morir(?:me)?|matarme|suicidarme|quitarme\s+la\s+vida|acabar\s+con\s+mi\s+vida))\b/u,
  /\b(?:no|nunca|jamas)\s+(?:me\s+voy\s+a|voy\s+a)\s+(?:matar|matarme|suicidar|suicidarme)\b/u,
  /\bno\s+es\s+cierto\s+que\s+(?:me\s+)?quiero\s+(?:morir|matar|suicidar)/u
];

const SPANISH_REPORTED_SELF_HARM_SIGNALS: readonly RegExp[] = [
  /\b(?:quiere|queria|quieren)\s+(?:morir(?:se)?\b(?!\s+de\s+(?:verguenza|risa|calor|hambre|sueno))|matarse|suicidarse|suisidarse|quitarse\s+la\s+vida(?!\s+(?:sedentaria|escolar)\b)|(?:acabar|terminar)\s+con\s+su\s+vida(?!\s+escolar\b))\b/u,
  /\bse\s+(?:quiere\s+(?:matar|suicidar|suisidar)|va\s+a\s+(?:matar|suicidar|suisidar))\b/u,
  /\b(?:ya\s+)?no\s+quiere(?:n)?\s+(?:vivir\b(?!\s+(?:en|con)\b)|seguir\s+viviendo\b)/u,
  /\b(?:piensa|esta\s+pensando)\s+(?:en\s+)?(?:matarse|suicidarse|suisidarse|quitarse\s+la\s+vida|(?:acabar|terminar)\s+con\s+su\s+vida(?!\s+escolar\b))\b/u,
  /\bva\s+a\s+(?:matarse|suicidarse|suisidarse|quitarse\s+la\s+vida)\b/u,
  /\b(?:amenaza|amenazo|amenazan|intento|trato)\s+(?:con\s+|de\s+)?(?:matarse|suicidarse|suisidarse|quitarse\s+la\s+vida)\b/u
];

const SPANISH_SELF_INJURY_SIGNALS: readonly RegExp[] = [
  /\b(?:amenaza|amenazo|amenazan|intento|trato)\s+(?:con\s+|de\s+)?(?:cortarse|hacerse\s+dano|lastimarse)\b/u,
  /\bse\s+(?:esta|estaba)\s+(?:cortando\b(?!\s+(?:(?:el\s+)?(?:pelo|cabello)|las?\s+(?:puntas|unas)))|haciendo(?:se)?\s+dano|lastimando)\b/u,
  /\b(?:esta|sigue|continua|ha\s+estado)\s+(?:cortandose\b(?!\s+(?:(?:el\s+)?(?:pelo|cabello)|las?\s+(?:puntas|unas)))|haciendose\s+dano|lastimandose)\b/u,
  /\bse\s+(?:corta\s+(?:los\s+brazos|las\s+piernas|la\s+piel)|hace\s+dano)\b/u,
  /\bse\s+(?:ha\s+cortado|corto(?:\s+\w+){0,3}|lastima|hirio|quemo)\s+a\s+proposito\b/u,
  /\b(?:volvio|empezo)\s+a\s+cortarse\b/u,
  /\bse\s+rasguna\s+hasta\s+sangrar\b/u,
  /\btiene\s+cortes\s+que\s+se\s+hizo\s+(?:el|ella)\s+mism[oa]\b/u
];

const SPANISH_REPORTED_SELF_HARM_DENIALS: readonly RegExp[] = [
  /\bno\s+(?:(?:me\s+)?(?:dice|dijo|ha\s+dicho|esta\s+diciendo)|(?:dice|dijo|ha\s+dicho|esta\s+diciendo))\b/u,
  /\b(?:nunca|jamas)\s+(?:(?:me\s+)?(?:dice|dijo|ha\s+dicho|esta\s+diciendo|amenaza|amenazo)|(?:ha\s+)?(?:dicho|amenazado))\b/u,
  /\bno\s+quiere(?:n)?\s+(?:morir(?:se)?|matarse|suicidarse|quitarse\s+la\s+vida)\b/u,
  /\b(?:no|nunca|jamas)\s+(?:se\s+)?(?:esta\s+(?:cortando|haciendo(?:se)?\s+dano|lastimando)|sigue\s+(?:cortandose|haciendose\s+dano)|amenaza\s+con)\b/u,
  /\b(?:no|nunca|jamas)\s+(?:piensa|esta\s+pensando|va\s+a)\s+(?:en\s+)?(?:matarse|suicidarse|quitarse\s+la\s+vida)\b/u,
  /\bno\s+es\s+cierto\s+que\b/u
];

function isSpanishDirectSelfHarm(input: string): boolean {
  return spanishClauses(input).some(
    (clause) =>
      !matchesAny(clause, SPANISH_DIRECT_SELF_HARM_DENIALS) &&
      matchesAny(clause, SPANISH_DIRECT_SELF_HARM_SIGNALS)
  );
}

function isSpanishReportedIdeation(input: string): boolean {
  return spanishClauses(input).some(
    (clause) =>
      !matchesAny(clause, SPANISH_REPORTED_SELF_HARM_DENIALS) &&
      matchesAny(clause, SPANISH_REPORTED_SELF_HARM_SIGNALS)
  );
}

function isSpanishOngoingSelfInjury(input: string): boolean {
  return spanishClauses(input).some(
    (clause) =>
      !matchesAny(clause, SPANISH_REPORTED_SELF_HARM_DENIALS) &&
      matchesAny(clause, SPANISH_SELF_INJURY_SIGNALS)
  );
}

const SPANISH_ELOPEMENT =
  "(?:se\\s+(?:escapo|fugo)(?:\\s+de\\s+casa)?|salio(?:\\s+de\\s+(?:la\\s+)?casa)?|se\\s+perdio|se\\s+fue\\s+de\\s+casa|desaparecio)";
const SPANISH_NOT_RETURNED =
  "(?:(?:todavia|aun)\\s+)?(?:no\\s+(?:(?:lo|la)\\s+)?(?:encontramos|encuentro|encuentran|podemos\\s+encontrar|puedo\\s+encontrar|aparece|regreso)|no\\s+ha\\s+vuelto|sigue\\s+(?:desaparecid[oa]|sin\\s+aparecer))";
const SPANISH_CHILD_LED_MISSING = new RegExp(
  `\\b${SPANISH_CHILD_WITH_AGE}\\b\\s+${SPANISH_ELOPEMENT}[^.?!]{0,96}${SPANISH_NOT_RETURNED}`,
  "u"
);
const SPANISH_REVERSED_CHILD_MISSING = new RegExp(
  `\\b${SPANISH_ELOPEMENT}\\s+${SPANISH_CHILD_WITH_AGE}\\b[^.?!]{0,96}${SPANISH_NOT_RETURNED}`,
  "u"
);
const SPANISH_NAMED_CHILD_MISSING = new RegExp(
  `\\b[A-Z][a-z]{1,30}\\s+${SPANISH_ELOPEMENT}[^.?!]{0,96}${SPANISH_NOT_RETURNED}`,
  "u"
);
const SPANISH_CURRENTLY_MISSING = new RegExp(
  `\\b${SPANISH_CHILD_WITH_AGE}\\b(?:\\s+(?:esta|sigue)\\s+(?:desaparecid[oa]|sin\\s+aparecer)|\\s+lleva\\s+(?:horas|dias|toda\\s+la\\s+noche)\\s+desaparecid[oa])\\b|\\b(?:todavia\\s+|aun\\s+)?no\\s+(?:encuentro|encontramos|puedo\\s+encontrar|podemos\\s+encontrar)\\s+a\\s+${SPANISH_CHILD}\\b|\\bno\\s+se\\s+donde\\s+esta\\s+${SPANISH_CHILD}\\s+desde\\s+(?:anoche|ayer|esta\\s+manana)\\b`,
  "u"
);
const SPANISH_CHILD_MISSING_BEFORE_ELOPEMENT = new RegExp(
  `\\b(?:todavia\\s+|aun\\s+)?no\\s+(?:encuentro|encontramos|puedo\\s+encontrar|podemos\\s+encontrar)\\s+a\\s+${SPANISH_CHILD}\\b[^.?!]{0,96}${SPANISH_ELOPEMENT}`,
  "u"
);
const SPANISH_RETURNED_CHILD =
  /\b(?:(?:ya|finalmente)\s+(?:volvio|regreso|aparecio|(?:lo|la)\s+encontramos)|volvio\s+hace\s+(?:una|dos|tres|\d+)\s+horas?|(?:ahora|ya)\s+esta\s+(?:conmigo|en\s+casa|a\s+salvo)|esta\s+conmigo\s+ahora)\b/u;
const SPANISH_MISSING_MEDIA_CONTEXT =
  /\b(?:en|segun)\s+(?:el|la|un|una)\s+(?:cuento|pelicula|libro|historia|serie|programa|noticia)\b/u;
const SPANISH_HYPOTHETICAL_QUESTION =
  /\b(?:que\s+(?:debo|deberia)\s+hacer\s+si|como\s+se\s+si)\b/u;

function isSpanishMissingChild(input: string): boolean {
  const normalized = normalizeSpanish(input);
  if (
    SPANISH_RETURNED_CHILD.test(normalized) ||
    SPANISH_MISSING_MEDIA_CONTEXT.test(normalized) ||
    SPANISH_HYPOTHETICAL_QUESTION.test(normalized)
  ) {
    return false;
  }

  return (
    SPANISH_CHILD_LED_MISSING.test(normalized) ||
    SPANISH_REVERSED_CHILD_MISSING.test(normalized) ||
    SPANISH_CURRENTLY_MISSING.test(normalized) ||
    SPANISH_CHILD_MISSING_BEFORE_ELOPEMENT.test(normalized) ||
    SPANISH_NAMED_CHILD_MISSING.test(normalizeSpanishPreservingCase(input))
  );
}

const SPANISH_ABUSE_SIGNALS: readonly RegExp[] = [
  new RegExp(
    `\\b(?:alguien|una\\s+persona)\\s+(?:esta\\s+)?(?:lastimando|maltratando|haciendole\\s+dano)\\s+a\\s+${SPANISH_CHILD}\\b`,
    "u"
  ),
  new RegExp(`\\b(?:estan|esta)\\s+abusando\\s+de\\s+${SPANISH_CHILD}\\b`, "u"),
  new RegExp(`\\babusaron\\s+de\\s+${SPANISH_CHILD}\\b`, "u"),
  new RegExp(
    `\\b${SPANISH_CHILD}\\b[^.?!]{0,24}(?:(?:si\\s+)?(?:esta\\s+siendo|ha\\s+sido|fue)\\s+)?(?:abusad[oa]|maltratad[oa])\\b`,
    "u"
  ),
  new RegExp(
    `\\b${SPANISH_CHILD}\\b[^.?!]{0,64}(?:(?:su\\s+)?(?:entrenador|cuidador|maestro|familiar)[^.?!]{0,16}(?:lo|la)\\s+esta\\s+(?:lastimando|golpeando)|alguien\\s+le\\s+(?:pega|golpea))\\b`,
    "u"
  ),
  new RegExp(
    `\\b${SPANISH_CHILD}\\b[^.?!]{0,56}(?:fue\\s+golpead[oa](?:\\s+por\\s+su\\s+(?:cuidador|entrenador|familiar))?|sufrio\\s+abuso\\s+sexual|(?:lo|la)\\s+tocaron\\s+inapropiadamente|esta\\s+recibiendo\\s+golpes)\\b`,
    "u"
  ),
  new RegExp(
    `\\b(?:el|la)\\s+(?:cuidador|entrenador|maestro|familiar)\\s+(?:maltrata|golpea|lastima)\\s+a\\s+${SPANISH_CHILD}\\b`,
    "u"
  ),
  new RegExp(
    `\\b(?:el|la)\\s+(?:novio|novia|pareja)\\s+de\\s+${SPANISH_CHILD}\\s+(?:lo|la)\\s+esta\\s+(?:golpeando|lastimando|maltratando)\\b`,
    "u"
  ),
  new RegExp(`\\b${SPANISH_CHILD}\\b[^.?!]{0,32}(?:lo|la)\\s+estan\\s+abusando\\b`, "u")
];
const SPANISH_ABUSE_DENIALS: readonly RegExp[] = [
  /\bno\s+es\s+cierto\s+que\b/u,
  /\bnadie\s+(?:esta\s+)?(?:abusando|maltratando|lastimando)\b/u,
  /\b(?:no|nunca|jamas)\s+(?:estan\s+|esta\s+)?(?:abusando|maltratando|lastimando)\b/u,
  /\bno\s+(?:esta\s+siendo|fue)\s+(?:abusad[oa]|maltratad[oa])\b/u,
  /\b(?:nunca|jamas)\s+ha\s+sido\s+(?:abusad[oa]|maltratad[oa])\b/u
];
const SPANISH_ABUSE_DISAVOWAL =
  /\b(?:pero|aunque)\s+(?:eso\s+)?no\s+es\s+cierto\b|\bsegun\s+(?:el|la)\s+(?:formulario|encuesta|guia)[^.?!]{0,96}\b(?:respuesta|resultado)[^.?!]{0,40}\b(?:error|incorrect[oa])\b/u;
const SPANISH_ABUSE_FORM_CONTEXT =
  /\b(?:la|esta|una)\s+(?:guia|encuesta|formulario|evaluacion)\b[^.?!]{0,40}\bpregunta\s+si\b/u;
const SPANISH_ABUSE_UNCERTAINTY =
  /\b(?:como\s+se\s+si|no\s+creo\s+que)\b/u;

function isSpanishChildHarmDisclosure(input: string): boolean {
  const normalized = normalizeSpanish(input);
  if (
    SPANISH_ABUSE_DISAVOWAL.test(normalized) ||
    SPANISH_ABUSE_FORM_CONTEXT.test(normalized) ||
    SPANISH_ABUSE_UNCERTAINTY.test(normalized)
  ) {
    return false;
  }

  return spanishClauses(input).some(
    (clause) => !matchesAny(clause, SPANISH_ABUSE_DENIALS) && matchesAny(clause, SPANISH_ABUSE_SIGNALS)
  );
}

const SPANISH_CAREGIVER_COLLAPSE =
  /\b(?:(?:ya\s+)?no\s+puedo\s+(?:hacer\s+esto(?:\s+mas)?|seguir(?:\s+asi)?|mas(?:\s+con\s+esto)?|con\s+esto)|no\s+aguanto\s+mas(?:\s+con\s+esto)?|ya\s+no\s+doy\s+mas)\b/u;
const SPANISH_GIVING_UP =
  /\b(?:(?:me\s+)?quiero\s+rendir(?:me)?|quiero\s+darme\s+por\s+vencid[oa]|me\s+rindo|voy\s+a\s+rendirme|quiero\s+abandonar\s+todo)\b/u;
const SPANISH_GIVING_UP_DENIALS: readonly RegExp[] = [
  /\b(?:no|nunca|jamas|tampoco)\s+(?:me\s+)?quiero\s+rendir(?:me)?\b/u,
  /\bno\s+quiero\s+darme\s+por\s+vencid[oa]\b/u,
  /\bde\s+ninguna\s+manera\s+(?:me\s+)?quiero\s+rendir(?:me)?\b/u,
  /\bno\s+(?:me\s+rindo|voy\s+a\s+rendirme|quiero\s+abandonar\s+todo)\b/u
];
const SPANISH_ORDINARY_TASK_CONTEXT =
  /\b(?:crucigrama|videojuego|dieta|rompecabezas|tarea|burocracia|solicitud|nivel|juego\s+de\s+mesa|ejercicio\s+de\s+practica)\b/u;

function isSpanishCaregiverCollapse(input: string): boolean {
  const normalized = normalizeSpanish(input);
  if (SPANISH_ORDINARY_TASK_CONTEXT.test(normalized)) return false;

  const hasCollapse = SPANISH_CAREGIVER_COLLAPSE.test(normalized);
  const hasPositiveGivingUpClause = spanishClauses(input).some(
    (clause) => SPANISH_GIVING_UP.test(clause) && !matchesAny(clause, SPANISH_GIVING_UP_DENIALS)
  );
  return hasCollapse && hasPositiveGivingUpClause;
}

// Caregiver-reported harm toward animals or other people. Every signal needs a
// harm verb acting ON its object, so a missing pet ("my dog ran away"), ordinary
// roughness, and the generic word "violence" in a school-discipline account stay
// out of the crisis tier — the last one matters because describing a suspension
// is the navigator's core content, not a red flag on its own.
const ANIMAL =
  "(?:animals?|pets?|cats?|kitten|dogs?|puppy|puppies|rabbits?|hamsters?|birds?|guinea\\s+pigs?)";
const OTHER_PERSON =
  "(?:another|other|the\\s+other|his|her|their)\\s+(?:kids?|child|children|students?|classmates?|siblings?|brother|sister|teacher|friends?|peers?)";
const HARM_VERB =
  "(?:hurt|hurts|hurting|harm|harms|harming|kill|kills|killed|killing|chok\\w+|strangl\\w+|stab\\w+|burn|burns|burned|burning|tortur\\w+|drown\\w+|attack|attacks|attacked|attacking|punch\\w+|beat\\s+up|beats\\s+up|beating\\s+up)";

const HARM_TO_OTHERS_SIGNALS: readonly RegExp[] = [
  new RegExp(
    `\\b(?:harmful|violent|cruel|aggressive)\\s+(?:to|towards?)\\s+(?:the\\s+|our\\s+|his\\s+|her\\s+|their\\s+|my\\s+)?${ANIMAL}\\b`,
    "i"
  ),
  new RegExp(`\\b${HARM_VERB}\\s+(?:(?:the|our|my|his|her|their|a|an)\\s+)?${ANIMAL}\\b`, "i"),
  new RegExp(`\\b${HARM_VERB}\\s+${OTHER_PERSON}\\b`, "i"),
  /\bthreaten(?:s|ed|ing)?\s+to\s+(?:kill|hurt|harm|stab|shoot|attack)\s+(?!himself|herself|themselves|themself|myself)/i,
  /\b(?:brought|took|taking|bringing|carried|carrying|snuck|sneaked)\s+(?:a|his|her|their|the)\s+(?:knife|gun|weapon|blade|box\s?cutter)\s+(?:to|into)\s+(?:school|class|daycare|the\s+bus)\b/i,
  // Reported threat without the word "threaten" ("he said he'd stab his brother").
  /\b(?:said|says)\s+(?:he|she|they)'?(?:d|ll)?\s+(?:would\s+)?(?:kill|hurt|harm|stab|shoot|attack)\s+(?!himself|herself|themselves|themself|myself)/i,
  // "hit" is deliberately NOT in HARM_VERB — it fires on "hit the ball", "hit his
  // head". It only counts against an infant, where it is never ordinary roughness.
  /\bhit(?:s|ting)?\s+(?:the|his|her|their|my|our)\s+(?:baby|infant|newborn|toddler)\b/i
];

const HARM_TO_OTHERS_DENIALS: readonly RegExp[] = [
  /\b(?:never|not|doesn'?t|does\s+not|didn'?t|did\s+not|wouldn'?t|would\s+not|hasn'?t|has\s+not|won'?t|will\s+not|no\s+longer)\b/i
];

function englishClauses(input: string): string[] {
  return input
    .split(/[.!?;,:]+|\b(?:but|however|although|though)\b/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

// A denial only counts when it sits immediately before the harm phrase itself.
// Scanning the whole clause would let unrelated wording ("...and I do not know
// what to do") cancel a real disclosure.
const DENIAL_WINDOW = 28;

function signalSurvivesDenial(clause: string, signals: readonly RegExp[], denials: readonly RegExp[]): boolean {
  return signals.some((pattern) => {
    const match = pattern.exec(clause);
    if (!match) return false;
    const preceding = clause.slice(Math.max(0, match.index - DENIAL_WINDOW), match.index);
    return !matchesAny(preceding, denials);
  });
}

function isHarmToOthers(input: string): boolean {
  return englishClauses(input).some((clause) =>
    signalSurvivesDenial(clause, HARM_TO_OTHERS_SIGNALS, HARM_TO_OTHERS_DENIALS)
  );
}

// ---------------------------------------------------------------------------
// English parity block (adjudicated 2026-08-04 from the spec 17 workstream A
// candidate report). The Spanish rules were built adversarially and the English
// ones corpus-first, so English was missing ideation, collapse, named-abuser and
// currently-missing-child phrasings that Spanish already caught. Each set below
// mirrors an existing Spanish rule.
// ---------------------------------------------------------------------------

// Phrases whose negation IS the disclosure ("I don't want to live"). Denial
// stripping must not touch these — the "don't" is the signal, not a retraction.
const ENGLISH_INHERENTLY_NEGATIVE_IDEATION: readonly RegExp[] = [
  /\b(?:don'?t|do\s+not|no\s+longer)\s+want\s+to\s+live\b/i,
  /\b(?:don'?t|do\s+not)\s+see\s+(?:the\s+|any\s+)?point\s+(?:in\s+|to\s+)?living\b/i,
  /\bno\s+(?:point|reason)\s+(?:in\s+|to\s+)?(?:living|go\s+on|going\s+on)\b/i
];

// Phrases a preceding negation genuinely cancels ("I would never wish I was dead").
const ENGLISH_DENIABLE_IDEATION: readonly RegExp[] = [
  /\bwish(?:ed)?\s+i\s+(?:was|were)\s+dead\b/i,
  /\bbetter\s+off\s+without\s+me\b/i,
  /\bwant\s+to\s+be\s+dead\b/i,
  /\bthinking\s+about\s+ending\s+(?:things|it)\b/i
];

const ENGLISH_IDEATION_DENIALS: readonly RegExp[] = [
  /\b(?:never|not|don'?t|doesn'?t|didn'?t|wouldn'?t|no\s+longer)\b/i
];

// Cheap pre-filters. Each is a strict superset of the signal set below it — every
// signal contains one of these tokens — so they change cost, never behavior. They
// exist because `screenCrisisRedFlags` runs on every keystroke of every composer
// in the app, and clause-splitting seven times per call is the wrong default.
const ENGLISH_IDEATION_PREFILTER = /\b(?:live|living|dead|better\s+off|ending|go(?:ing)?\s+on)\b/i;

function isEnglishDirectIdeation(input: string): boolean {
  if (!ENGLISH_IDEATION_PREFILTER.test(input)) return false;
  return englishClauses(input).some(
    (clause) =>
      matchesAny(clause, ENGLISH_INHERENTLY_NEGATIVE_IDEATION) ||
      signalSurvivesDenial(clause, ENGLISH_DENIABLE_IDEATION, ENGLISH_IDEATION_DENIALS)
  );
}

const ENGLISH_REPORTED_IDEATION_SIGNALS: readonly RegExp[] = [
  /\b(?:he|she|they)\s+wish(?:es|ed)?\s+(?:he|she|they)\s+(?:was|were)\s+dead\b/i,
  /\b(?:he|she|they)\s+(?:doesn'?t|does\s+not|don'?t|do\s+not|no\s+longer)\s+want(?:s)?\s+to\s+live\b/i,
  /\b(?:wanting|wants?)\s+to\s+be\s+dead\b/i,
  /\b(?:says?|said|tells?|told\s+me|keeps?\s+saying|keeps?\s+talking\s+about|talking\s+about)\b[^.?!]{0,48}\b(?:want(?:s|ing)?\s+to\s+be\s+dead|wish(?:es|ed)?\s+(?:he|she|they)\s+(?:was|were)\s+dead)\b/i
];

function isEnglishReportedIdeation(input: string): boolean {
  if (!/\b(?:dead|live)\b/i.test(input)) return false;
  return englishClauses(input).some((clause) =>
    signalSurvivesDenial(clause, ENGLISH_REPORTED_IDEATION_SIGNALS, ENGLISH_IDEATION_DENIALS)
  );
}

// Caregiver collapse: the old rule required the literal phrase "can't do this
// anymore" plus a giving-up phrase within 64 chars, which is far narrower than
// its Spanish twin. Both halves are still required — collapse alone is ordinary
// exhaustion — but each half now accepts the usual phrasings.
const ENGLISH_COLLAPSE_SIGNALS: readonly RegExp[] = [
  /\bcan'?t\s+do\s+this\s+(?:any\s?more|anymore)\b/i,
  /\bcan'?t\s+keep\s+(?:going|doing\s+this)\b/i,
  /\bcan'?t\s+take\s+(?:it|this)\s+(?:any\s?more|anymore)\b/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\b(?:have|got)\s+nothing\s+left\b/i,
  /\bnothing\s+left\s+to\s+give\b/i,
  /\bat\s+my\s+breaking\s+point\b/i
];

const ENGLISH_GIVING_UP_SIGNALS: readonly RegExp[] = [
  /\bwant\s+to\s+give\s+up\b/i,
  /\bgiving\s+up\s+on\s+everything\b/i,
  /\b(?:ending|end)\s+it\b/i,
  /\bwant\s+to\s+quit\s+everything\b/i,
  /\bready\s+to\s+give\s+up\b/i
];

const ENGLISH_GIVING_UP_DENIALS: readonly RegExp[] = [
  /\b(?:never|not|don'?t|won'?t|wouldn'?t|no\s+longer)\b/i
];

// Ordinary-task framing, mirroring SPANISH_ORDINARY_TASK_CONTEXT.
const ENGLISH_ORDINARY_TASK_CONTEXT =
  /\b(?:crossword|video\s?game|puzzle|diet|homework|board\s+game|practice\s+exercise|level|sudoku|the\s+treadmill)\b/i;

function isEnglishCaregiverCollapse(input: string): boolean {
  // Collapse is the rarer half, so test it first and skip the clause split when
  // it misses. Both halves are still required.
  if (!matchesAny(input, ENGLISH_COLLAPSE_SIGNALS)) return false;
  if (ENGLISH_ORDINARY_TASK_CONTEXT.test(input)) return false;
  return englishClauses(input).some((clause) =>
    signalSurvivesDenial(clause, ENGLISH_GIVING_UP_SIGNALS, ENGLISH_GIVING_UP_DENIALS)
  );
}

// Abuse by a named caregiver. Spanish already covered coach/caregiver/teacher as
// the actor; English required the word "someone" or "somebody".
const ENGLISH_ABUSER =
  "(?:coach|teacher|caregiver|care\\s?giver|sitter|babysitter|stepdad|step-?father|stepmom|step-?mother|uncle|aunt|cousin|neighbor|instructor|aide|bus\\s+driver|boyfriend|girlfriend|partner)";
const ENGLISH_ABUSE_HARM =
  "(?:hit|hits|hitting|beat|beats|beating|hurt|hurts|hurting|slapped|slaps|punched|punches|grabbed|grabs|choked|chokes|touched|touches|molested)";
const ENGLISH_CHILD = "(?:child|kid|son|daughter|boy|girl|teen(?:ager)?|baby|toddler)";

const ENGLISH_NAMED_ABUSE_SIGNALS: readonly RegExp[] = [
  new RegExp(
    `\\b(?:my|our)\\s+${ENGLISH_CHILD}'?s?\\s+${ENGLISH_ABUSER}\\s+${ENGLISH_ABUSE_HARM}\\b`,
    "i"
  ),
  new RegExp(
    `\\b(?:his|her|their|the)\\s+${ENGLISH_ABUSER}\\s+${ENGLISH_ABUSE_HARM}\\s+(?:him|her|them|my\\s+${ENGLISH_CHILD})\\b`,
    "i"
  ),
  new RegExp(
    `\\b(?:my|our)\\s+${ENGLISH_CHILD}\\b[^.?!]{0,48}\\b(?:his|her|their)\\s+${ENGLISH_ABUSER}\\s+${ENGLISH_ABUSE_HARM}\\s+(?:him|her|them)\\b`,
    "i"
  ),
  /\btouch(?:ed|es|ing)\s+(?:him|her|them|my\s+\w+)\s+inappropriately\b/i,
  new RegExp(`\\b(?:my|our)\\s+${ENGLISH_CHILD}\\s+(?:was|got)\\s+(?:hit|beaten|molested|abused)\\b`, "i")
];

const ENGLISH_ABUSE_DENIALS: readonly RegExp[] = [
  /\b(?:never|not|didn'?t|doesn'?t|hasn'?t|no\s+one|nobody)\b/i
];

const ENGLISH_ABUSE_HYPOTHETICAL =
  /\b(?:what\s+(?:should|do)\s+i\s+do\s+if|how\s+(?:do|would)\s+i\s+know\s+if|the\s+(?:form|survey|guide|questionnaire)\s+asks)\b/i;

const ENGLISH_ABUSE_PREFILTER = new RegExp(
  `${ENGLISH_ABUSER}|inappropriately|\\b(?:was|got)\\s+(?:hit|beaten|molested|abused)\\b`,
  "i"
);

function isEnglishNamedAbuse(input: string): boolean {
  if (!ENGLISH_ABUSE_PREFILTER.test(input)) return false;
  if (ENGLISH_ABUSE_HYPOTHETICAL.test(input)) return false;
  return englishClauses(input).some((clause) =>
    signalSurvivesDenial(clause, ENGLISH_NAMED_ABUSE_SIGNALS, ENGLISH_ABUSE_DENIALS)
  );
}

// Currently-missing child with no elopement verb. Spanish already had
// SPANISH_CURRENTLY_MISSING; English required "ran away"/"wandered off" first.
const ENGLISH_CURRENTLY_MISSING: readonly RegExp[] = [
  new RegExp(
    `\\b(?:my|our)\\s+${ENGLISH_CHILD}\\s+(?:has\\s+been|has'?s\\s+been|is|has\\s+gone)\\s+missing\\b`,
    "i"
  ),
  new RegExp(
    `\\b(?:don'?t|do\\s+not)\\s+know\\s+where\\s+(?:my|our)\\s+${ENGLISH_CHILD}\\s+is\\b[^.?!]{0,64}\\b(?:gone|missing|since)\\b`,
    "i"
  ),
  new RegExp(
    `\\b(?:my|our)\\s+${ENGLISH_CHILD}\\s+(?:has\\s+been|is)\\s+gone\\s+(?:since|for)\\b`,
    "i"
  )
];

const ENGLISH_MISSING_RETURNED =
  /\b(?:came\s+back|is\s+back|found\s+(?:him|her|them)|(?:he|she|they)\s+(?:is|are)\s+home\s+now|turned\s+up|safe\s+now)\b/i;
const ENGLISH_MISSING_MEDIA_CONTEXT =
  /\b(?:in|on)\s+(?:the|a|this)\s+(?:movie|book|story|show|series|news|episode)\b/i;

function isEnglishCurrentlyMissingChild(input: string): boolean {
  if (
    ENGLISH_MISSING_RETURNED.test(input) ||
    ENGLISH_MISSING_MEDIA_CONTEXT.test(input) ||
    ENGLISH_ABUSE_HYPOTHETICAL.test(input)
  ) {
    return false;
  }
  return matchesAny(input, ENGLISH_CURRENTLY_MISSING);
}

// Acute medical presentations with no rule at any tier before 2026-08-04. Severe
// hypoglycemia is the one that matters most here — this is a diabetes-first app
// and "unresponsive, sugar is 32" was reaching no gate at all.
const ACUTE_MEDICAL_SIGNALS: readonly RegExp[] = [
  /\b(?:is|are|him|her|them|he'?s|she'?s|they'?re)\s+unresponsive\b|\bunresponsive\s+(?:and|right\s+now)\b/i,
  /\b(?:not|isn'?t|aren'?t)\s+responding\b/i,
  /\bcan'?t\s+get\s+(?:him|her|them)\s+to\s+respond\b/i,
  /\bcan'?t\s+wake\s+(?:him|her|them|my\s+\w+|the\s+\w+)\s+up\b/i,
  /\b(?:won'?t|will\s+not|isn'?t|is\s+not)\s+wak(?:e|ing)\s+up\b/i,
  /\b(?:is|are|was|were)\s+having\s+(?:a\s+)?seizure|\bhaving\s+a\s+seizure\s+(?:right\s+)?now\b/i,
  /\bthroat\s+(?:is\s+)?clos(?:ing|ed)\b|\banaphyla/i,
  /\bchest\s+pain\b[^.?!]{0,48}\b(?:radiat\w+|down\s+(?:my|his|her)\s+(?:left\s+|right\s+)?arm|into\s+(?:my|his|her)\s+jaw)\b/i,
  /\bpassed\s+out\b[^.?!]{0,48}\b(?:can'?t\s+get\s+\w+\s+to\s+respond|unresponsive|won'?t\s+wake|still\s+out)\b/i
];

function isAcuteMedical(input: string): boolean {
  return matchesAny(input, ACUTE_MEDICAL_SIGNALS);
}

// ---------------------------------------------------------------------------
// False-positive narrowing (same adjudication). These rules were firing on this
// app's own everyday vocabulary — "I can't see the numbers on my meter" is what
// a low-vision diabetes patient types, not an acute vision loss.
// ---------------------------------------------------------------------------

// Bare "cannot see" now needs a vision-shaped object or a clause end. A named
// object ("the numbers", "the label", "where to tap") is a legibility complaint.
const VISION_CANNOT_SEE =
  /\b(?:loss\s+of\s+vision|vision\s+loss)\b|\b(?:cannot|can'?t|cant)\s+see\s+(?:anything|at\s+all|out\s+of|clearly|properly)\b|\b(?:cannot|can'?t|cant)\s+see\s*(?:$|[.!?,;])/i;

const EYE_PAIN = /\beye\s+pain\b/i;
const EYE_PAIN_DOWNGRADE: readonly RegExp[] = [
  /\b(?:no|not|without|denies|mild|slight|minor|little)\s*$/i
];
const EYE_PAIN_RESOLVED =
  /\b(?:gone|resolved|cleared\s+up|stopped|went\s+away|better\s+now|no\s+longer)\b/i;

function isEyePain(input: string): boolean {
  if (!EYE_PAIN.test(input)) return false;
  return englishClauses(input).some((clause) => {
    if (EYE_PAIN_RESOLVED.test(clause)) return false;
    return signalSurvivesDenial(clause, [EYE_PAIN], EYE_PAIN_DOWNGRADE);
  });
}

// A blinking LED on a meter or pump is not a photopsia report.
const FLASHES_OF_LIGHT = /\bflash(?:es|ing)?\s+(?:of\s+)?light/i;
const DEVICE_CONTEXT =
  /\b(?:on|from)\s+(?:my|the)\s+(?:meter|monitor|glucose\s+meter|pump|device|phone|screen|machine|sensor|reader)\b/i;

function isFlashesOfLight(input: string): boolean {
  return FLASHES_OF_LIGHT.test(input) && !DEVICE_CONTEXT.test(input);
}

const WENT_DARK = /\b(?:everything|my\s+vision|my\s+sight)\s+(?:went|going|turned)\s+(?:dark|black)\b/i;
const EXTERNAL_DARKNESS =
  /\b(?:power\s+(?:went\s+)?out|power\s+outage|lights?\s+went\s+out|blackout|storm|breaker|bulb|candle)\b/i;

function isVisionWentDark(input: string): boolean {
  return WENT_DARK.test(input) && !EXTERNAL_DARKNESS.test(input);
}

// "Am I going blind someday?" is the education question the corpus already traps
// in its "will I go blind" form; the present-participle form needs the same guard.
const GOING_BLIND = /\bgoing\s+blind\b/i;
const BLINDNESS_HYPOTHETICAL =
  /\b(?:scared\s+of|afraid\s+of|worried\s+about|worry\s+about|risk\s+of|chance(?:s)?\s+of|someday|eventually|will\s+i|am\s+i\s+going\s+to|is\s+that\s+likely|odds\s+of)\b/i;

function isGoingBlind(input: string): boolean {
  return GOING_BLIND.test(input) && !BLINDNESS_HYPOTHETICAL.test(input);
}

// "I want to die of embarrassment" — the Spanish corpus already trapped this
// idiom (trap_es_embarrassment_idiom); English never did.
const WANT_TO_DIE = /\bwant\s+to\s+die\b|\bend(?:ing)?\s+it\s+all\b/i;
const DYING_IDIOM =
  /\b(?:die|dying)\s+of\s+(?:embarrassment|shame|laughter|boredom|hunger|thirst|heat|cold)\b/i;

function isWantToDie(input: string): boolean {
  if (!WANT_TO_DIE.test(input)) return false;
  return englishClauses(input).some(
    (clause) => WANT_TO_DIE.test(clause) && !DYING_IDIOM.test(clause)
  );
}

// "hurt myself" in a physical-activity clause is injury avoidance, not self-harm.
const SELF_HARM_CORE = /(?:kill(?:ing)?\s+myself|suicid(?:e|al)|end\s+my\s+life)/i;
const HURT_MYSELF = /\bhurt\s+myself\b/i;
const PHYSICAL_ACTIVITY_CONTEXT =
  /\b(?:lift(?:ing)?|carry(?:ing)?|mov(?:e|ing)|bend(?:ing)?|exercis\w*|work(?:ing)?\s+out|the\s+gym|yoga|stretch\w*|running|walking|the\s+treadmill|wheelchair|groceries)\b/i;

function isSelfHarmPhrase(input: string): boolean {
  if (SELF_HARM_CORE.test(input)) return true;
  if (!HURT_MYSELF.test(input)) return false;
  return englishClauses(input).some(
    (clause) => HURT_MYSELF.test(clause) && !PHYSICAL_ACTIVITY_CONTEXT.test(clause)
  );
}

const SPANISH_ANIMAL =
  "(?:animal(?:es)?|mascotas?|gatos?|gatitos?|perros?|perritos?|conejos?|hamsters?|pajaros?)";
const SPANISH_HARM_TO_OTHERS_SIGNALS: readonly RegExp[] = [
  new RegExp(
    `\\b(?:lastim\\w+|hiere|hirio|mata|mato|matando|ahorc\\w+|quema|quemo|quemando|tortur\\w+|maltrat\\w+|golpe\\w+)\\s+(?:a\\s+)?(?:los|las|el|la|un|una|su|mi|nuestr[oa])?\\s*${SPANISH_ANIMAL}\\b`,
    "u"
  ),
  new RegExp(`\\b(?:cruel|violent[oa]|agresiv[oa])\\s+con\\s+(?:los|las|el|la|su|mi)?\\s*${SPANISH_ANIMAL}\\b`, "u"),
  new RegExp(`\\bhace\\s+dano\\s+a\\s+(?:los|las|el|la|su|mi)?\\s*${SPANISH_ANIMAL}\\b`, "u"),
  /\b(?:lastim\w+|golpe\w+|atac\w+|muerde|mordio)\s+a\s+(?:otr[oa]s?\s+)?(?:nin[oa]s?|companer[oa]s?|estudiantes?|su\s+herman[oa]|su\s+maestr[oa])\b/u,
  /\bamenaz\w+\s+con\s+(?:matar|lastimar|herir|golpear)\s+a\s+(?!si\s+mism)/u
];
const SPANISH_HARM_TO_OTHERS_DENIALS: readonly RegExp[] = [
  /\b(?:no|nunca|jamas|tampoco)\b/u,
  /\bes\s+cierto\s+que\b/u
];

function isSpanishHarmToOthers(input: string): boolean {
  return spanishClauses(input).some((clause) =>
    signalSurvivesDenial(clause, SPANISH_HARM_TO_OTHERS_SIGNALS, SPANISH_HARM_TO_OTHERS_DENIALS)
  );
}

const CRISIS_RULES: CrisisRule[] = [
  {
    id: "vision_sudden_loss",
    domain: "vision",
    pattern: /sudden(?:ly)?\s+(?:lost|loss|lose|cannot|can't|cant).{0,32}(?:see|vision)/i
  },
  {
    id: "vision_loss",
    domain: "vision",
    pattern: VISION_CANNOT_SEE
  },
  {
    id: "vision_sudden_changes",
    domain: "vision",
    pattern: /sudden(?:ly)?\s+vision\s+changes?/i
  },
  {
    id: "vision_curtain_shadow",
    domain: "vision",
    // Broadened beyond "curtain over my vision" to also catch the plainer
    // "curtain/shadow over my eye/sight" a patient is more likely to type.
    pattern: /(?:curtain|shadow).{0,32}(?:vision|eye|sight)/i
  },
  {
    id: "vision_flashes_floaters",
    domain: "vision",
    pattern: /(?:new\s+)?flashes?.{0,32}floaters?|(?:new\s+)?floaters?.{0,32}flashes?/i
  },
  {
    id: "vision_eye_pain",
    domain: "vision",
    match: isEyePain
  },
  // Plain-language acute-vision phrasings that the corpus-shaped patterns above
  // miss. Each requires a present/acute marker, so general education questions
  // ("will I go blind?", "will I lose my vision someday?") do NOT fire — only a
  // symptom report does. Verified zero false positives on the maintained corpus.
  {
    id: "vision_losing_sight",
    domain: "vision",
    pattern: /\b(?:losing|lost)\s+(?:my\s+)?(?:sight|vision)\b/i
  },
  {
    id: "vision_going_blind",
    domain: "vision",
    match: isGoingBlind
  },
  {
    id: "vision_new_floaters",
    domain: "vision",
    pattern: /\b(?:new|lots\s+of|bunch\s+of|shower\s+of|sudden|many)\s+(?:new\s+)?floaters?\b/i
  },
  {
    id: "vision_flashes_light",
    domain: "vision",
    match: isFlashesOfLight
  },
  {
    id: "vision_went_dark",
    domain: "vision",
    match: isVisionWentDark
  },
  {
    id: "self_harm_wake_up",
    domain: "self_harm",
    pattern: /(?:do\s+not|don't|dont)\s+want\s+to\s+wake\s+up/i
  },
  {
    id: "self_harm_suicide",
    domain: "self_harm",
    match: isSelfHarmPhrase
  },
  {
    id: "self_harm_dont_want_to_be_here",
    domain: "self_harm",
    pattern: /(?:do\s+not|don'?t)\s+want\s+to\s+be\s+here\b/i
  },
  {
    id: "self_harm_want_to_die",
    domain: "self_harm",
    match: isWantToDie
  },
  {
    id: "self_harm_english_direct_ideation",
    domain: "self_harm",
    match: isEnglishDirectIdeation
  },
  {
    id: "self_harm_english_reported_ideation",
    domain: "self_harm",
    match: isEnglishReportedIdeation
  },
  {
    id: "self_harm_overdose_disclosure",
    domain: "self_harm",
    match: isIntentionalOverdose
  },
  {
    id: "self_harm_reported_ideation",
    domain: "self_harm",
    pattern: REPORTED_IDEATION
  },
  {
    id: "self_harm_reflexive_intent",
    domain: "self_harm",
    match: (input) => REFLEXIVE_HARM.test(input) && REFLEXIVE_INTENT.test(input)
  },
  {
    id: "self_harm_ongoing_injury",
    domain: "self_harm",
    pattern: ONGOING_SELF_INJURY
  },
  {
    id: "self_harm_third_person_end_life",
    domain: "self_harm",
    pattern: THIRD_PERSON_END_LIFE
  },
  {
    id: "acute_missing_child",
    domain: "acute_danger",
    pattern: MISSING_CHILD
  },
  {
    id: "acute_english_currently_missing_child",
    domain: "acute_danger",
    match: isEnglishCurrentlyMissingChild
  },
  {
    id: "acute_medical_emergency",
    domain: "acute_danger",
    match: isAcuteMedical
  },
  {
    id: "caregiver_collapse_combined",
    domain: "caregiver_collapse",
    pattern: CAREGIVER_COLLAPSE
  },
  {
    id: "caregiver_collapse_english_broadened",
    domain: "caregiver_collapse",
    match: isEnglishCaregiverCollapse
  },
  {
    id: "abuse_child_harm_disclosure",
    domain: "abuse",
    pattern: CHILD_HARM_DISCLOSURE
  },
  {
    id: "abuse_english_named_perpetrator",
    domain: "abuse",
    match: isEnglishNamedAbuse
  },
  {
    id: "self_harm_spanish_direct",
    domain: "self_harm",
    match: isSpanishDirectSelfHarm
  },
  {
    id: "self_harm_spanish_reported_ideation",
    domain: "self_harm",
    match: isSpanishReportedIdeation
  },
  {
    id: "self_harm_spanish_ongoing_injury",
    domain: "self_harm",
    match: isSpanishOngoingSelfInjury
  },
  {
    id: "acute_spanish_missing_child",
    domain: "acute_danger",
    match: isSpanishMissingChild
  },
  {
    id: "abuse_spanish_child_harm_disclosure",
    domain: "abuse",
    match: isSpanishChildHarmDisclosure
  },
  {
    id: "caregiver_collapse_spanish_combined",
    domain: "caregiver_collapse",
    match: isSpanishCaregiverCollapse
  },
  {
    id: "acute_chest_breathing",
    domain: "acute_danger",
    pattern: /(?:crushing\s+)?chest\s+pain.{0,48}(?:cannot|can't|cant).{0,16}breathe/i
  },
  {
    id: "acute_stroke_signs",
    domain: "acute_danger",
    pattern: /(?:face\s+is\s+drooping|facial\s+droop|speech\s+is\s+slurred|slurred\s+speech)/i
  },
  {
    id: "acute_worst_headache",
    domain: "acute_danger",
    pattern: /worst\s+headache\s+of\s+my\s+life|thunderclap/i
  },
  // Listed last so a disclosure that is both self-directed and outward-directed
  // still reports self_harm — matchedRules[0] decides the domain.
  {
    id: "harm_to_others_reported",
    domain: "harm_to_others",
    match: isHarmToOthers
  },
  {
    id: "harm_to_others_spanish_reported",
    domain: "harm_to_others",
    match: isSpanishHarmToOthers
  }
];

// Negation is handled by stripping negated self-harm spans BEFORE the rules run,
// so a disclosure like "I said I'd never hurt myself but I want to die" still
// fires on the residual "I want to die" while "I would never hurt myself" clears.
const NEGATION_PATTERNS: RegExp[] = [
  /\b(?:would|will|could|do|did|am)\s+(?:not\s+)?never\s+(?:want\s+to\s+)?(?:hurt|harm|kill)\s+(?:myself|me)\b/gi,
  /\bnever\s+(?:want\s+to\s+)?(?:hurt|harm|kill)\s+(?:myself|me)\b/gi,
  /\b(?:not|never)\s+going\s+to\s+(?:hurt|harm|kill)\s+(?:myself|me)\b/gi,
  /\bno\s+thoughts?\s+of\s+(?:hurting|harming|killing)\s+(?:myself|me)\b/gi
];

function stripNegatedSpans(input: string): string {
  return NEGATION_PATTERNS.reduce((result, pattern) => result.replace(pattern, " "), input);
}

function ruleMatches(rule: CrisisRule, input: string): boolean {
  if (rule.match) {
    return rule.match(input);
  }
  return rule.pattern ? rule.pattern.test(input) : false;
}

export function screenCrisisRedFlags(
  input: string,
  options: CrisisScreeningOptions = {}
): CrisisScreeningResult {
  const scannable = stripNegatedSpans(input);
  const matchedRules = CRISIS_RULES.filter((rule) => ruleMatches(rule, scannable));

  if (matchedRules.length > 0) {
    return {
      matched: true,
      source: "deterministic",
      domain: matchedRules[0].domain,
      ruleIds: matchedRules.map((rule) => rule.id),
      requiresRuleGapTicket: false
    };
  }

  if (options.modelBackstopMatched) {
    return {
      matched: true,
      source: "model_backstop",
      domain: null,
      ruleIds: [],
      requiresRuleGapTicket: true,
      modelBackstopLabel: options.modelBackstopLabel
    };
  }

  return {
    matched: false,
    source: "none",
    domain: null,
    ruleIds: [],
    requiresRuleGapTicket: false
  };
}

export function measureCrisisRecall(cases: CrisisCorpusCase[]): CrisisRecallReport {
  const expectedPositive = cases.filter((testCase) => testCase.expectedMatched);
  const truePositives: string[] = [];
  const falseNegatives: string[] = [];
  const falsePositives: string[] = [];

  for (const testCase of cases) {
    const result = screenCrisisRedFlags(testCase.text);
    if (testCase.expectedMatched && result.matched) truePositives.push(testCase.id);
    if (testCase.expectedMatched && !result.matched) falseNegatives.push(testCase.id);
    if (!testCase.expectedMatched && result.matched) falsePositives.push(testCase.id);
  }

  return {
    recall: expectedPositive.length === 0 ? 1 : truePositives.length / expectedPositive.length,
    totalExpectedPositive: expectedPositive.length,
    truePositives,
    falseNegatives,
    falsePositives
  };
}

// Self-harm, caregiver-collapse, abuse, and harm-to-others disclosures route to
// the crisis tier; sudden vision loss (a hypertensive-emergency presentation)
// and acute danger route to the emergency tier. Logistics never reaches crisis
// handling.
export function crisisTierForDomain(domain: CrisisDomain | null): "crisis" | "emergency" | null {
  if (
    domain === "self_harm" ||
    domain === "caregiver_collapse" ||
    domain === "abuse" ||
    domain === "harm_to_others"
  ) {
    return "crisis";
  }
  if (domain === "vision" || domain === "acute_danger") {
    return "emergency";
  }
  return null;
}
