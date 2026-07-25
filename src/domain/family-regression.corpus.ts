/**
 * The regression-cue contract, in the vignette-gate tier: deterministic, zero
 * env, build-breaking, and run inside `npm test`.
 *
 * Recall is not the goal here — the monthly probe backstops every phrasing the
 * lexicon misses. What this corpus protects is precision. A false "we think your
 * child is losing skills" is the most expensive sentence this app can say, so
 * every trap below is a phrasing a real caregiver writes for an ordinary or even
 * happy reason. If a pattern edit ever makes a trap fire, this file breaks the
 * build before a family ever sees it.
 */
export type RegressionCase = {
  id: string;
  language: "en" | "es";
  text: string;
  expectCue: boolean;
};

export const REGRESSION_CASES: RegressionCase[] = [
  {
    id: "stopped_words",
    language: "en",
    text: "He stopped saying the words he knew, like more and mama.",
    expectCue: true
  },
  {
    id: "lost_words",
    language: "en",
    text: "She has lost words she used to say every day.",
    expectCue: true
  },
  {
    id: "used_to_now",
    language: "en",
    text: "He used to wave bye bye but now he doesn't.",
    expectCue: true
  },
  {
    id: "no_longer_points",
    language: "en",
    text: "She no longer points at things she wants.",
    expectCue: true
  },
  {
    id: "forgot_how",
    language: "en",
    text: "It's like he forgot how to climb the stairs.",
    expectCue: true
  },
  {
    id: "es_dejo_hablar",
    language: "es",
    text: "Dejó de hablar casi por completo este mes.",
    expectCue: true
  },
  {
    id: "es_perdio_palabras",
    language: "es",
    text: "Perdió palabras que decía todos los días.",
    expectCue: true
  },
  {
    id: "es_ya_no_senala",
    language: "es",
    text: "Ya no señala lo que quiere.",
    expectCue: true
  },
  // Traps — MUST stay silent.
  {
    id: "lost_shoe",
    language: "en",
    text: "He lost his shoe at the park again.",
    expectCue: false
  },
  {
    id: "lost_track_time",
    language: "en",
    text: "We lost track of time at therapy.",
    expectCue: false
  },
  {
    id: "losing_my_mind",
    language: "en",
    text: "Honestly I am losing my mind with the paperwork.",
    expectCue: false
  },
  {
    id: "stopped_crying",
    language: "en",
    text: "She stopped crying at drop-off, which is a relief.",
    expectCue: false
  },
  {
    id: "no_longer_diapers",
    language: "en",
    text: "He no longer needs diapers at night.",
    expectCue: false
  },
  {
    id: "es_dejo_llorar",
    language: "es",
    text: "Dejó de llorar cuando la dejo en la escuela.",
    expectCue: false
  },
  {
    id: "es_ya_no_aguanto",
    language: "es",
    text: "Ya no aguanto tanto papeleo, necesito un respiro.",
    expectCue: false
  },
  // Gains wearing loss grammar. Every one of these fired before the branches were
  // anchored to a named skill verb; each is a sentence a delighted caregiver would
  // plausibly write during the wait, and each would have printed "Possible loss of
  // skills" into the clinician's copy of the visit packet.
  {
    id: "used_to_hate_now_loves",
    language: "en",
    text: "He used to hate the bath but now he loves it.",
    expectCue: false
  },
  {
    id: "used_to_need_nap",
    language: "en",
    text: "She used to need a nap but now she doesn't.",
    expectCue: false
  },
  {
    id: "used_to_be_tiny",
    language: "en",
    text: "He used to be tiny and now he is huge.",
    expectCue: false
  },
  {
    id: "stopped_us_at_door",
    language: "en",
    text: "He stopped us at the door to say hi.",
    expectCue: false
  },
  {
    id: "no_longer_uses_diapers",
    language: "en",
    text: "He no longer uses diapers during the day.",
    expectCue: false
  },
  {
    id: "es_antes_lloraba",
    language: "es",
    text: "Antes lloraba mucho en la escuela y ya no.",
    expectCue: false
  },
  {
    id: "es_ya_no_berrinches",
    language: "es",
    text: "Ya no hace berrinches por la mañana.",
    expectCue: false
  },
  {
    id: "es_ya_no_panales",
    language: "es",
    text: "Ya no usa pañales durante el día.",
    expectCue: false
  }
];
