# Crisis gate — Spanish adversarial pass (spec 20 F6e)

**Date:** 2026-08-05
**Status:** ✅ adjudicated and implemented 2026-08-05, in the same commit as the report.
**Baseline:** `npm run crisis:gate` PASS before generation.
**Corpus at time of run:** 248 cases. **After:** 294 (+34 positives, +12 traps).

The 2026-08-04 English pass ended by naming this run "the obvious next red-team"
(`docs/qa/2026-08-04-crisis-adversarial-candidates.md`). This is it.

## Method

Same as the English pass, mirrored. White-box: `src/domain/crisis-red-flags.ts`
was read first, candidates were written against the observed Spanish rule
boundaries, and **every candidate was executed through the real
`screenCrisisRedFlags`** before it was written down here. 55 candidates: 43
disclosures that should fire, 12 traps that must not.

Concentration was chosen from the English pass's own finding #2, which listed
four areas where one language's rules were thinner than the other's, plus the
`acute_medical_emergency` rule that spec 17 added in English only.

> Correction to the spec: spec 20 F6e calls `acute_medical_emergency` a "new
> domain". It is a **rule id** inside the existing `acute_danger` domain. No new
> domain was added, and none was needed.

## Result

| Group | Candidates | Broke the detector | Held |
|---|---|---|---|
| A. Ideation, passive/indirect | 12 | 9 | 3 |
| B. Caregiver collapse | 8 | 8 | 0 |
| C. Named abuser | 7 | 7 | 0 |
| D. Child missing now | 6 | 4 | 2 |
| E. Acute medical | 8 | **8** | 0 |
| F. Harm to others | 2 | 1 | 1 |
| G. Traps (must stay quiet) | 12 | 0 | 12 |
| **Total** | **55** | **37** | **18** |

**Zero false positives across the whole run, before and after the fixes.** The
0.95 recall floor and the zero-FP assertion were never relaxed (FR-5); the
corpus only grew.

## Headline findings

### 1. `acute_medical_emergency` was English-only, and it is the least ambiguous rule in the file

Eight for eight. "Mi hijo está inconsciente", "Está teniendo una convulsión ahora
mismo", "No puedo despertar a mi hija", "se le cierra la garganta" — an
unresponsive, seizing, or not-breathing child, in the plainest words there are,
produced nothing at all. `ACUTE_MEDICAL_SIGNALS` is a list of English regexes and
had no Spanish sibling. This is the widest single gap the pass found and the
cheapest to close: the sentences carry no idiom and no ambiguity.

Fixed with `SPANISH_ACUTE_MEDICAL_SIGNALS`. The one pattern that needed care is
the bare "no responde", which is also what a parent says about a teenager who is
ignoring their friends — it now refuses to fire when the verb takes an object
(trap G12).

### 2. A named abuser had no Spanish path at all

Seven for seven. The existing `SPANISH_ABUSE_SIGNALS` wanted the child noun
adjacent to the harm verb, so every sentence that leads with *who did it* fell
through: "El entrenador de mi hijo le hizo daño", "La niñera le dejó moretones",
"El tío lo tocó de manera inapropiada". This is the same gap the 2026-08-04 pass
fixed on the English side — the mirror image of that report's finding #2, which
had it the other way around.

Fixed with a role list (entrenador, maestro/a, niñera, cuidador, tío/tía, abuelo,
padrastro, vecino, pareja, novio, papá/mamá, adulto) that only fires when a harm
verb is acting. A role alone is never a signal: "El maestro me ayudó mucho con el
IEP" (trap G6) stays quiet.

### 3. Passive ideation is how caregivers actually report it

"Todos estarían mejor sin él." "Ojalá no despertara mañana." "Ya no quiere estar
vivo." None of these contain a verb from the explicit list (morir / matarse /
suicidarse / quitarse la vida), and none of them fired. The nine added patterns
are all bounded — "quiere desaparecer" fires only with *para siempre*, so
"quiero desaparecer un rato" (exhaustion, not ideation) is untouched, and "se
quiere morir de risa" (trap G10) was and remains quiet.

### 4. Caregiver collapse: the gate held, the vocabulary was too narrow

All eight broke, but for a different reason than the rest. The Spanish rule
requires **two** conditions — a collapse phrase *and* a giving-up clause — and
that is not a bug: with one condition, trap G3 ("Ya no puedo más con el papeleo
de la lista de espera") becomes a crisis interstitial for a parent complaining
about forms. That is the exact failure class the 2026-07-25 waitlist-companion
bug belonged to.

So five of the eight were fixed by **widening the vocabulary of each half**, not
by relaxing the gate: `estoy al límite` and `no doy más` (without "ya") joined the
collapse half; `me rendí`, `me voy a quebrar` / `me estoy derrumbando`, and
`tengo miedo de lo que pueda hacer` joined the giving-up half. Three were not
fixed — see below.

## Deliberately not fixed

| # | Text | Why not |
|---|---|---|
| B3 | "No aguanto más, ya no puedo seguir cuidándolo sola" | Two collapse phrases, no giving-up clause. Firing on this needs a collapse-only path, which fires on trap G3. Real disclosure, real cost, no safe fix inside the current design — this is the same trade the 2026-08-04 report escalated as finding #1 and it is still the owner's call. |
| B5 | "Siento que ya no puedo con mi hijo y quiero desaparecer un rato" | "Desaparecer un rato" is ordinary exhaustion, and the bounded ideation rule added in this pass exists precisely to *not* fire on it. Adjudicated: not crisis tier. |
| B6 | "Estoy agotada, ya no tengo fuerzas para nada" | Exhaustion with no giving-up, no self-harm, and no fear-of-own-actions signal. Genuinely debatable whether it belongs in the crisis tier at all; treating it as one would make the tier meaningless for the most common sentence a caregiver of a waitlisted child writes. |

All three are recorded here rather than added to the corpus as positives, because
a corpus positive is a promise the detector keeps and these are promises it does
not keep. Naming them is the honest alternative to widening a rule until the trap
corpus breaks.

## What landed

- `src/domain/crisis-red-flags.ts` — `SPANISH_ACUTE_MEDICAL_SIGNALS` (new);
  9 passive-ideation patterns and a perfect-progressive self-injury tense added
  to the Spanish self-harm signals; 2 named-abuser patterns; 4 missing-child
  extensions (`no sé dónde está` / `nadie sabe dónde está` as a not-returned
  tail, "lleva desaparecido toda la tarde" in both word orders, "ahora mismo",
  and escape-from-a-named-place with an animal guard); collapse and giving-up
  vocabulary; a stated-plan pattern for harm to others.
- `src/domain/crisis-red-flags.corpus.ts` — 248 → 294 cases.
- Gate run: `docs/ops/red-team-results/2026-08-05-crisis-gate.md` (PASS, recall
  1.00, false positives 0).

## One regression caught in this run

The first version of the escape-from-a-named-place rule had no subject
constraint and fired on `trap_es_missing_dog` ("mi perro se escapó de casa y
todavía no lo encontramos") — a trap the corpus already carried, from a prior
pass, for exactly this mistake. The gate caught it before the commit. It is
worth recording that the corpus paid for itself inside the same hour it was
extended.
