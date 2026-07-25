# Ladder Waitlist Companion — Implementation Plan (15)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement spec 13 (`docs/specs/13-ladder-waitlist-companion.md`): make the ~12-month wait longitudinal — wait-status header with a single "next rung", observation journal over the existing interview surface, printable Visit Packet, tracked next-steps with verified deadline clocks, monthly check-in with skill-loss watch + one-question pulse, while-you-wait guides, and the earlier-visit list.

**Architecture:** Everything extends the `family` slice and `/ladder` page. New pure logic in `src/domain/family-journey.ts` (touch/engagement/rung), `src/domain/family-clocks.ts`, `src/domain/family-visit-packet.ts`, `src/domain/family-guides.ts`, and a regression-cue layer in `family-interview.ts` gated by a new corpus. All new free text routes through the existing family interview surface (crisis gate inherited — FR-14). UI is four new section components on `/ladder` plus small prop additions to existing components. Demo-first: localStorage only, honest "(demo)" labels, time-travel controls per the established backdate pattern.

**Tech Stack:** Next.js 15 / React 19 / TS strict / Vitest + Testing Library / Playwright. No new dependencies.

## Global Constraints

- **Code identifiers stay `family*`**; brand strings say Ladder. No route changes in this plan.
- **Every user-facing string ships en + es together** in `src/i18n/family-strings.ts` (informal `tú`; brand "Ladder" untranslated). The `Record<FamilyStringKey, string>` typing enforces parity at compile time.
- **No new free-text surface class.** Notes and check-in text are the existing `FamilyOrientationInterview` box. New turns use fixed buttons only. `npm run crisis:gate` and the deterministic vignette tiers must pass **unchanged** — any movement means something leaked; stop and investigate, never adjust a gate.
- **One ask at a time.** At most one open question on the page: the follow-up turn, check-in parts, and sooner-list turn are mutually exclusive by the gating rules in Tasks 8–12; the header renders pointers, never questions.
- **Determinism where the family relies on it.** Packet builder, clocks, rung priority, guide matching, and regression cues are pure functions with unit tests. Model output authors nothing new in this plan.
- **Verified-dated-cited or absent.** Guide seeds must be fetch-verified at seed time (Task 11 has the procedure); the First Steps clock uses the already-verified 45-day catalog fact; **no school-evaluation day counts anywhere** (707 KAR 1:300 unverified — spec Open Question 1).
- **Storage discipline (plan 14 precedent):** new fields validate as optional, sanitizer backfills, guards enforce semantic coherence, `resetDemo`/`deleteDemoData` behavior is covered by extending `emptyFamilyState`. Old saves must never reset.
- **TS strict, no `any`, `const` first.** Match surrounding idiom and comment density.
- **Path-scoped commits** (`git add <exact paths>` — never `-A`); shared tree may hold other sessions' edits (`docs/food-lens-demo.md` is currently modified — leave it alone).
- **Do not push.** Ship is a separate user-triggered step (this project has **no GitHub auto-deploy**; prod ships via `vercel --prod --archive=tgz`).
- Verification commands: `npm run test -- <paths>`, `npm run lint`, `npm run check`, `npm run crisis:gate`, `npm run test:e2e -- family-navigator.spec.ts`.
- **e2e clock:** `family-navigator.spec.ts` freezes time at `FROZEN_NOW = 2026-07-17T12:00Z` via `page.clock.setFixedTime` in `beforeEach`; all new e2e assertions must be written against that instant.

---

### Task 1: Types + storage for the whole companion (P0 spine)

**Files:**
- Modify: `src/domain/types.ts` (family section, after `FamilySoonerList` insert point ~line 380–425)
- Modify: `src/state/store.tsx` (`emptyFamilyState`)
- Modify: `src/domain/family-fixtures.ts` (every `FamilyNavigatorState` literal)
- Modify: `src/state/storage.ts` (guards + sanitizer)
- Test: `src/state/storage.test.ts` (extend)

**Interfaces (produced — later tasks rely on these exact names):**

```ts
// FamilyInterview gains:
kind: "orientation" | "note" | "checkin";
// FamilyFact gains:
includeInSummary?: boolean;              // absent ⇒ true

export type FamilyStepStatus = "planned" | "tried" | "in_touch" | "enrolled" | "not_for_us";
export type FamilyResourceStep = {
  id: string;
  resourceId: string;
  domain: DevNeedDomain;
  status: FamilyStepStatus;
  plannedAt: string;
  updatedAt: string;
};
export type FamilyPulse = { at: string; score: 1 | 2 | 3 | 4 | 5 };
export type FamilyFlag = {
  id: string;
  type: "regression";
  source: "probe" | "text";
  raisedAt: string;
  acknowledgedAt?: string;
};
export type FamilySoonerConstraint =
  | "weekday_mornings" | "weekday_afternoons" | "any_weekday" | "needs_notice";
export type FamilySoonerList = { optedInAt: string; constraints: FamilySoonerConstraint[] };

// FamilyNavigatorState adds:
steps: FamilyResourceStep[];
pulses: FamilyPulse[];
flags: FamilyFlag[];
soonerList: FamilySoonerList | null;
packetQuestionIds: string[];             // picked starter-question ids (F3)
```

- [ ] **Step 1: Add the types** exactly as above in `src/domain/types.ts`. `kind` is **required** on `FamilyInterview` (persistence backfills; in-code constructors always set it).

- [ ] **Step 2: Keep the tree compiling.** `emptyFamilyState` in `src/state/store.tsx` gains:

```ts
steps: [],
pulses: [],
flags: [],
soonerList: null,
packetQuestionIds: [],
```

Every `FamilyNavigatorState` literal in `src/domain/family-fixtures.ts` gains the same five fields, and every `FamilyInterview` literal in fixtures/tests gains `kind: "orientation"`. Run `npm run build`; fix every literal the compiler names (expected: fixtures, a handful of tests) — mechanical additions only.

- [ ] **Step 3: Storage guards + sanitizer** in `src/state/storage.ts`, following the plan-14 semantic-coherence style (`isNonblankString`, `isExactIsoTimestamp`, `isObject`, `isArrayOfObjects` all exist):

```ts
const familyStepStatuses: FamilyStepStatus[] = ["planned", "tried", "in_touch", "enrolled", "not_for_us"];
const familySoonerConstraints: FamilySoonerConstraint[] = [
  "weekday_mornings", "weekday_afternoons", "any_weekday", "needs_notice"
];
const familyInterviewKinds = ["orientation", "note", "checkin"] as const;

function isFamilyResourceStep(value: unknown): value is FamilyResourceStep {
  return (
    isObject(value) &&
    isNonblankString(value.id) &&
    isNonblankString(value.resourceId) &&
    isDevNeedDomain(value.domain) &&
    typeof value.status === "string" &&
    familyStepStatuses.some((status) => status === value.status) &&
    isExactIsoTimestamp(value.plannedAt) &&
    isExactIsoTimestamp(value.updatedAt) &&
    new Date(value.updatedAt).valueOf() >= new Date(value.plannedAt).valueOf()
  );
}

function isFamilyPulse(value: unknown): value is FamilyPulse {
  return (
    isObject(value) &&
    isExactIsoTimestamp(value.at) &&
    typeof value.score === "number" &&
    Number.isInteger(value.score) &&
    value.score >= 1 &&
    value.score <= 5
  );
}

function isFamilyFlag(value: unknown): value is FamilyFlag {
  return (
    isObject(value) &&
    isNonblankString(value.id) &&
    value.type === "regression" &&
    (value.source === "probe" || value.source === "text") &&
    isExactIsoTimestamp(value.raisedAt) &&
    (value.acknowledgedAt === undefined ||
      (isExactIsoTimestamp(value.acknowledgedAt) &&
        new Date(value.acknowledgedAt).valueOf() >= new Date(value.raisedAt).valueOf()))
  );
}

function isFamilySoonerList(value: unknown): value is FamilySoonerList {
  return (
    isObject(value) &&
    isExactIsoTimestamp(value.optedInAt) &&
    Array.isArray(value.constraints) &&
    value.constraints.length > 0 &&
    value.constraints.every((entry) =>
      familySoonerConstraints.some((known) => known === entry)
    ) &&
    new Set(value.constraints).size === value.constraints.length
  );
}
```

`isFamilyInterview` extends: `kind` optional-in-storage — `(value.kind === undefined || familyInterviewKinds.some((kind) => kind === value.kind))`. `isFamilyFact` extends: `(value.includeInSummary === undefined || typeof value.includeInSummary === "boolean")`.

`isFamilyNavigatorState` gains optional clauses (mirroring `appointments`):

```ts
(value.steps === undefined || isArrayOfObjects(value.steps, isFamilyResourceStep)) &&
(value.pulses === undefined || isArrayOfObjects(value.pulses, isFamilyPulse)) &&
(value.flags === undefined || isArrayOfObjects(value.flags, isFamilyFlag)) &&
(value.soonerList === undefined || value.soonerList === null || isFamilySoonerList(value.soonerList)) &&
(value.packetQuestionIds === undefined || isArrayOfStrings(value.packetQuestionIds)) &&
```

`sanitizeFamilyNavigatorState` return gains (dedupe helpers mirror `uniqueFamilyAppointments`):

```ts
steps: Array.isArray(value.steps) ? uniqueById(value.steps.filter(isFamilyResourceStep)) : [],
pulses: Array.isArray(value.pulses) ? value.pulses.filter(isFamilyPulse) : [],
flags: Array.isArray(value.flags) ? uniqueById(value.flags.filter(isFamilyFlag)) : [],
soonerList: isFamilySoonerList(value.soonerList) ? value.soonerList : null,
packetQuestionIds: Array.isArray(value.packetQuestionIds)
  ? uniqueStrings(value.packetQuestionIds.filter((entry): entry is string => typeof entry === "string"))
  : [],
```

…and interviews map to backfill `kind: "orientation"` when absent; facts pass through with `includeInSummary` preserved. Add a generic `uniqueById<T extends { id: string }>(rows: T[]): T[]` next to `uniqueFamilyAppointments` (or reuse a shared one if you extract it — either is fine, keep it private).

- [ ] **Step 4: Tests** — append to `src/state/storage.test.ts` (file has `validFamily`, `demoState`, `saveStoredState`, `loadStoredState`, `STORAGE_KEY`):

```ts
it("backfills companion fields on saves written before spec 13", () => {
  const {
    steps: _s, pulses: _p, flags: _f, soonerList: _sl, packetQuestionIds: _q,
    ...legacyFamily
  } = validFamily;
  const legacyInterviews = validFamily.interviews.map(({ kind: _k, ...rest }) => rest);
  saveStoredState({
    ...demoState,
    family: { ...legacyFamily, interviews: legacyInterviews } as FamilyNavigatorState
  });
  const loaded = loadStoredState();
  expect(loaded.family).not.toBeNull();
  expect(loaded.family?.steps).toEqual([]);
  expect(loaded.family?.pulses).toEqual([]);
  expect(loaded.family?.flags).toEqual([]);
  expect(loaded.family?.soonerList).toBeNull();
  expect(loaded.family?.packetQuestionIds).toEqual([]);
  expect(loaded.family?.interviews.every((row) => row.kind === "orientation")).toBe(true);
});

it("drops incoherent companion rows without resetting the family slice", () => {
  saveStoredState({
    ...demoState,
    family: {
      ...validFamily,
      steps: [{ id: "s1", resourceId: "r", domain: "therapies", status: "sideways", plannedAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z" }],
      pulses: [{ at: "2026-07-01T00:00:00.000Z", score: 9 }],
      flags: [{ id: "f1", type: "regression", source: "probe", raisedAt: "2026-07-02T00:00:00.000Z", acknowledgedAt: "2026-07-01T00:00:00.000Z" }],
      soonerList: { optedInAt: "2026-07-01T00:00:00.000Z", constraints: [] }
    } as unknown as FamilyNavigatorState
  });
  const loaded = loadStoredState();
  expect(loaded.family).not.toBeNull();
  expect(loaded.family?.steps).toEqual([]);
  expect(loaded.family?.pulses).toEqual([]);
  expect(loaded.family?.flags).toEqual([]);
  expect(loaded.family?.soonerList).toBeNull();
});
```

(`validFamily` itself gains the five fields + `kind` on its interviews as part of Step 2's compile fixes.)

- [ ] **Step 5: Run + commit**

```bash
npm run test -- src/state/storage.test.ts
npm run build
git add src/domain/types.ts src/state/store.tsx src/state/storage.ts src/domain/family-fixtures.ts src/state/storage.test.ts
git add -u src
git commit -m "feat: companion data model — steps, pulses, flags, sooner list, interview kinds"
```

---

### Task 2: `family-journey.ts` — touch, engagement, check-in due-ness, next rung (P0)

**Files:**
- Create: `src/domain/family-journey.ts`
- Test: `src/domain/family-journey.test.ts`

**Interfaces (produced):**

```ts
export function familyLastTouchAt(family: FamilyNavigatorState): string | null;
export function familyTouches(family: FamilyNavigatorState, since: Date): number;
export const CHECKIN_DUE_DAYS = 30;
export function checkInDue(family: FamilyNavigatorState, now: Date): boolean;
export type FamilyRung =
  | { kind: "safety" } | { kind: "visit" } | { kind: "clinic_now" }
  | { kind: "clock"; weeksLeft: number } | { kind: "checkin" }
  | { kind: "step"; resourceId: string } | { kind: "journal" } | { kind: "quiet" };
export function nextFamilyRung(family: FamilyNavigatorState, now: Date): FamilyRung;
export function monthsOnList(referredAt: string, now: Date): number;
```

- [ ] **Step 1: Implement.** Touch = latest ISO among: `interviews[].createdAt`, `steps[].updatedAt`, `pulses[].at`, `flags[].raisedAt` and `acknowledgedAt`, `saved[].savedAt`, `appointments[].createdAt` and `reminderAcks[].acknowledgedAt`, `screenAnswers` have no timestamp (skip). `checkInDue` = profile exists AND lastTouch !== null AND `now - lastTouch > 30 days` (a brand-new family is not nagged — orientation just touched).

`nextFamilyRung` priority (spec F1, exactly this order — return the first hit):

```ts
export function nextFamilyRung(family: FamilyNavigatorState, now: Date): FamilyRung {
  if (pendingFamilySafetyEvent(family.safetyEvents) !== undefined) return { kind: "safety" };
  const appointment = activeFamilyAppointment(family.appointments);
  if (
    appointment !== undefined &&
    (dueFamilyReminder(appointment, now) !== null ||
      overdueFamilyAppointment(appointment, now) ||
      appointment.status === "offered" ||
      appointment.status === "missed")
  ) {
    return { kind: "visit" };
  }
  if (family.flags.some((flag) => flag.acknowledgedAt === undefined)) return { kind: "clinic_now" };
  const clock = family.profile ? firstStepsClock(family.profile, now, hasEnrolledFirstSteps(family)) : null;
  if (clock !== null && clock.weeksLeft <= CLOCK_WARNING_WEEKS) {
    return { kind: "clock", weeksLeft: clock.weeksLeft };
  }
  if (checkInDue(family, now)) return { kind: "checkin" };
  const staleStep = oldestStaleStep(family.steps, now);
  if (staleStep !== undefined) return { kind: "step", resourceId: staleStep.resourceId };
  const last = familyLastTouchAt(family);
  if (last !== null && daysBetween(new Date(last), now) >= 30) return { kind: "journal" };
  return { kind: "quiet" };
}
```

Notes: `firstStepsClock`/`CLOCK_WARNING_WEEKS`/`hasEnrolledFirstSteps` come from Task 8 — **until Task 8 lands, stub `firstStepsClock` here as `() => null` with a `// Task 8 replaces` comment and `CLOCK_WARNING_WEEKS = 8` so P0 compiles and tests pass**; Task 8 moves the real implementation into `family-clocks.ts` and this file imports it. `oldestStaleStep` = oldest `planned`/`tried` step whose `updatedAt` is >7 days before `now`. `checkin` and `journal` never both fire (checkin covers the >30d case when due; journal is the fallback if a check-in was just completed this session but interviews are older — in practice: `journal` fires only when checkInDue is false yet last-touch ≥30d, which happens when the check-in was skipped via the skip actions that still stamp a touch — see Task 10). `monthsOnList` = whole months between, floor, min 0.

- [ ] **Step 2: Tests** — `src/domain/family-journey.test.ts`, using `schoolAgeFamilyState` from `@/domain/family-fixtures` as the base and a fixed `NOW`. Cover: (a) lastTouch picks the max across every array type (build a state with one timestamp per source, assert the known max); (b) `checkInDue` false for fresh, true at 31 days, false with no profile; (c) rung priority — eight states, one test each, constructed minimally: pending safety event wins over everything; offered appointment beats flag; unacknowledged flag beats checkin; due checkin beats stale step; stale step beats journal; quiet when everything is fresh; (d) `monthsOnList("2026-03-10T…", 2026-07-17)` → 4.

- [ ] **Step 3: Run + commit**

```bash
npm run test -- src/domain/family-journey.test.ts
git add src/domain/family-journey.ts src/domain/family-journey.test.ts
git commit -m "feat: family journey selectors — last touch, check-in due, next rung"
```

---

### Task 3: "Your Ladder" wait-status header (P0)

**Files:**
- Modify: `src/i18n/family-strings.ts`
- Create: `src/components/family-wait-header.tsx`
- Modify: `src/components/family-experience.tsx` (render above the interview section when `family?.profile`)
- Test: `src/components/family-wait-header.test.tsx`

- [ ] **Step 1: Strings** (add keys to the union + both blocks):

```ts
// en
waitHeaderTitle: "Your Ladder",
waitHeaderOnList: "On the list at {clinic} since {month} — about {months} months so far.",
waitHeaderOnListFresh: "On the list at {clinic} since {month}.",
waitHeaderNoPrediction: "We can't predict the exact date — here's how to make the wait count.",
rungSafety: "Please look at the safety message above",
rungVisit: "Your evaluation visit needs a look",
rungClinicNow: "Something to tell the clinic — see below",
rungClock: "About {weeks} weeks left to start First Steps",
rungCheckin: "Monthly check-in (about 30 seconds)",
rungStep: "Quick follow-up on a step you planned",
rungJournal: "Add a 10-second note about your child",
waitChipNotes: "{count} notes",
waitChipSteps: "{count} steps in motion",
waitChipVisit: "Visit: {when}",
waitChipSooner: "On the earlier-visit list",
// es
waitHeaderTitle: "Tu Ladder",
waitHeaderOnList: "En la lista de {clinic} desde {month} — unos {months} meses hasta ahora.",
waitHeaderOnListFresh: "En la lista de {clinic} desde {month}.",
waitHeaderNoPrediction: "No podemos predecir la fecha exacta — así puedes aprovechar la espera.",
rungSafety: "Por favor mira el mensaje de seguridad de arriba",
rungVisit: "Tu visita de evaluación necesita atención",
rungClinicNow: "Algo que contarle a la clínica — mira abajo",
rungClock: "Quedan unas {weeks} semanas para empezar First Steps",
rungCheckin: "Chequeo mensual (unos 30 segundos)",
rungStep: "Seguimiento rápido de un paso que planeaste",
rungJournal: "Agrega una nota de 10 segundos sobre tu hijo o hija",
waitChipNotes: "{count} notas",
waitChipSteps: "{count} pasos en marcha",
waitChipVisit: "Visita: {when}",
waitChipSooner: "En la lista de visita anticipada",
```

- [ ] **Step 2: Component** — `FamilyWaitHeader({ family, language, now }: { family: FamilyNavigatorState; language: Language; now?: Date })`:

```tsx
"use client";

import React from "react";
import {
  familyLastTouchAt,
  monthsOnList,
  nextFamilyRung,
  type FamilyRung
} from "@/domain/family-journey";
import { activeFamilyAppointment, formatFamilySlot } from "@/domain/family-appointments";
import type { FamilyNavigatorState } from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const RUNG_TARGETS: Record<Exclude<FamilyRung["kind"], "quiet">, string> = {
  safety: "family-experience",
  visit: "family-appointment-card",
  clinic_now: "family-clinic-now",
  clock: "family-resources",
  checkin: "family-checkin",
  step: "family-followup",
  journal: "family-interview-title"
};

function rungLabel(rung: FamilyRung, language: Language): string | null {
  switch (rung.kind) {
    case "quiet": return null;
    case "clock": return tFamily(language, "rungClock", { weeks: rung.weeksLeft });
    default: {
      const keys: Record<string, FamilyStringKey> = {
        safety: "rungSafety", visit: "rungVisit", clinic_now: "rungClinicNow",
        checkin: "rungCheckin", step: "rungStep", journal: "rungJournal"
      };
      return tFamily(language, keys[rung.kind]);
    }
  }
}

export function FamilyWaitHeader({ family, language, now = new Date() }: {
  family: FamilyNavigatorState; language: Language; now?: Date;
}) {
  const rung = nextFamilyRung(family, now);
  const label = rungLabel(rung, language);
  const referral = family.referral;
  const months = referral ? monthsOnList(referral.referredAt, now) : 0;
  const monthName = referral
    ? new Date(referral.referredAt).toLocaleDateString(language === "es" ? "es" : "en-US", { month: "long", year: "numeric" })
    : "";
  const notes = family.interviews.filter(({ kind }) => kind !== "orientation").length;
  const stepsInMotion = family.steps.filter(({ status }) => status !== "not_for_us" && status !== "enrolled").length;
  const appointment = activeFamilyAppointment(family.appointments);
  const visitWhen = appointment?.scheduledFor ? formatFamilySlot(appointment.scheduledFor, language) : null;

  return (
    <section data-testid="family-wait-header" aria-labelledby="family-wait-title"
      className="rounded-control border border-care/20 bg-white p-4">
      <h2 id="family-wait-title" className="text-xl font-semibold">{tFamily(language, "waitHeaderTitle")}</h2>
      {referral ? (
        <p className="mt-1 text-sm leading-6 text-ink/80">
          {months >= 1
            ? tFamily(language, "waitHeaderOnList", { clinic: referral.clinic, month: monthName, months })
            : tFamily(language, "waitHeaderOnListFresh", { clinic: referral.clinic, month: monthName })}
        </p>
      ) : null}
      <p className="mt-1 text-sm leading-6 text-ink/60">{tFamily(language, "waitHeaderNoPrediction")}</p>
      {label !== null && rung.kind !== "quiet" ? (
        <a href={`#${RUNG_TARGETS[rung.kind]}`} data-testid="family-next-rung"
          className="mt-3 inline-flex min-h-12 items-center rounded-control bg-care px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care">
          {label}
        </a>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {notes > 0 ? <span className="rounded-full bg-calm px-3 py-1">{tFamily(language, "waitChipNotes", { count: notes })}</span> : null}
        {stepsInMotion > 0 ? <span className="rounded-full bg-calm px-3 py-1">{tFamily(language, "waitChipSteps", { count: stepsInMotion })}</span> : null}
        {visitWhen ? <span className="rounded-full bg-calm px-3 py-1">{tFamily(language, "waitChipVisit", { when: visitWhen })}</span> : null}
        {family.soonerList ? <span className="rounded-full bg-calm px-3 py-1">{tFamily(language, "waitChipSooner")}</span> : null}
      </div>
    </section>
  );
}
```

The anchor targets that don't exist yet (`family-clinic-now`, `family-checkin`, `family-followup`) are created with those ids in Tasks 9–10 and 8; an anchor to a missing id is a harmless no-op scroll in the interim. Wire into `family-experience.tsx` as the first section when `family?.profile` exists (above the interview section).

- [ ] **Step 3: Tests** — render with `schoolAgeFamilyState` variants: (a) referral present → on-list line contains the month and "months so far" once ≥1 month old (pass `now`); (b) no referral → no on-list line, header still renders; (c) a pending safety event state → rung label is the safety string and href is `#family-experience`; (d) quiet state → no `family-next-rung` element; (e) es renders "Tu Ladder".

- [ ] **Step 4: Run + commit**

```bash
npm run test -- src/components/family-wait-header.test.tsx
git add src/i18n/family-strings.ts src/components/family-wait-header.tsx src/components/family-wait-header.test.tsx src/components/family-experience.tsx
git commit -m "feat: Your Ladder wait-status header with single next-rung pointer"
```

---

### Task 4: Journal — note framing, all-facts render, include-toggle, durability honesty (P1)

**Files:**
- Modify: `src/domain/types.ts` — no (done in Task 1)
- Modify: `src/components/family-orientation-interview.tsx` (one prop)
- Modify: `src/components/family-experience.tsx` (kind tagging, journal section, nudge)
- Modify: `src/state/store.tsx` (one action)
- Modify: `src/i18n/family-strings.ts`
- Create: `src/components/family-journal.tsx`
- Test: `src/components/family-journal.test.tsx`, extend `src/state/store.test.ts`

- [ ] **Step 1: Kind tagging.** In `family-experience.tsx` `addInterview`, the constructed interview gains:

```ts
kind: (family?.interviews.length ?? 0) === 0 ? "orientation" : "note",
```

(Check-ins pass an explicit override in Task 10 via a `kindOverride` ref set when the check-in turn opens the box — add `const interviewKindRef = useRef<"note" | "checkin" | null>(null);` now, read it in `addInterview` with the length-based value as fallback, reset to null after use.)

- [ ] **Step 2: Note placeholder.** `FamilyOrientationInterviewProps` gains `completePlaceholder?: string`; the free-text input rendered when `thread.status === "complete"` (the "add more" turn, ~line 330 region) uses `completePlaceholder ?? tFamily(language, "interviewPlaceholder")`. `FamilyExperience` passes `completePlaceholder={tFamily(language, "journalNotePlaceholder")}`.

- [ ] **Step 3: Include-toggle action.** `store.tsx`:

```ts
| { type: "setFamilyFactInclusion"; factId: string; include: boolean }
```

```ts
case "setFamilyFactInclusion":
  if (!state.family || !state.family.facts.some(({ id }) => id === action.factId)) {
    return state;
  }
  return {
    ...state,
    family: {
      ...state.family,
      facts: state.family.facts.map((fact) =>
        fact.id === action.factId ? { ...fact, includeInSummary: action.include } : fact
      )
    }
  };
```

- [ ] **Step 4: Strings:**

```ts
// en
journalTitle: "Your notes so far",
journalIntro: "Everything you've told us, in your words, with dates. This becomes your visit packet.",
journalNotePlaceholder: "What did you notice this week? A sentence is plenty.",
journalIncludeLabel: "Include in visit packet",
journalExcludedBadge: "Not in packet",
journalDeviceLine: "Notes stay on this device. Print or share a copy sometimes so you don't lose them.",
journalExportNudge: "You have {count} notes now — a good moment to print or copy your visit packet.",
journalMonthNote: "{month} — {count} notes",
// es
journalTitle: "Tus notas hasta ahora",
journalIntro: "Todo lo que nos has contado, en tus palabras, con fechas. Esto se convierte en tu paquete para la visita.",
journalNotePlaceholder: "¿Qué notaste esta semana? Con una frase basta.",
journalIncludeLabel: "Incluir en el paquete de la visita",
journalExcludedBadge: "Fuera del paquete",
journalDeviceLine: "Las notas se quedan en este dispositivo. Imprime o comparte una copia de vez en cuando para no perderlas.",
journalExportNudge: "Ya tienes {count} notas — buen momento para imprimir o copiar tu paquete.",
journalMonthNote: "{month} — {count} notas",
```

- [ ] **Step 5: `FamilyJournal` component.** Props `{ family, language, onToggleInclude }`. Render: section `id="family-journal"`, title + intro; group **all** facts by the month of their interview's `createdAt` (facts carry `interviewId` → look up interview; facts with no interviewId group under the screen-answers month header using their order — fall back to "Earlier"). Month groups newest-first; inside each, a `FamilyFactCard`-style row (reuse `FamilyFactCard` if its props fit — it takes `fact`, `language`, `onConfirm`; extend it with optional `includeToggle?: { included: boolean; onToggle: (include: boolean) => void }` rendering a labeled switch under the card) plus expandable raw note text per interview (a `<details>` with the interview `rawText`, one per interview in that month). Fixed durability line at the section foot (`journalDeviceLine`). Export nudge: when `family.interviews.filter(k => k.kind === "note").length` is a positive multiple of 5 AND a nudge for that count hasn't been shown (track `journalNudgeShownFor: number` in component state keyed off count — session-only is fine), render `journalExportNudge` with an anchor to `#family-visit-packet`.
  Render `FamilyJournal` in `family-experience.tsx` between the resources section and the basics section, only when at least one fact exists.

- [ ] **Step 6: Tests.** Component: (a) facts from two interviews in different months render under two month headers, newest first; (b) toggling calls `onToggleInclude(factId, false)` and an excluded fact shows the `journalExcludedBadge`; (c) durability line always present; (d) es strings render. Reducer: `setFamilyFactInclusion` flips only the targeted fact and no-ops on unknown id.

- [ ] **Step 7: Run + commit**

```bash
npm run test -- src/components/family-journal.test.tsx src/state/store.test.ts
git add src/components/family-journal.tsx src/components/family-journal.test.tsx src/components/family-orientation-interview.tsx src/components/family-experience.tsx src/components/family-fact-card.tsx src/state/store.tsx src/state/store.test.ts src/i18n/family-strings.ts
git commit -m "feat: observation journal — dated notes, include-toggle, durability honesty"
```

---

### Task 5: Visit Packet builder (P2, domain)

**Files:**
- Create: `src/domain/family-visit-packet.ts`
- Test: `src/domain/family-visit-packet.test.ts`

**Interfaces (produced):**

```ts
export type PacketQuestion = { id: string; labelKey: FamilyStringKey };
export const PACKET_QUESTIONS: readonly PacketQuestion[];   // 10 fixed ids: "results_school", "coordinates_next", ...
export function buildFamilyVisitSummary(family: FamilyNavigatorState, language: Language, now: Date): string;
```

- [ ] **Step 1: Starter questions** — ten ids with string keys (strings land in Task 6): `results_school`, `coordinates_next`, `therapy_start`, `waiver_effect`, `school_share`, `second_visit`, `home_help`, `regression_meaning`, `siblings_risk`, `who_to_call`.

- [ ] **Step 2: Builder** — deterministic, `buildCareTeamMessage` style; **sections in spec F3 order**; skip empty sections entirely:

```ts
export function buildFamilyVisitSummary(
  family: FamilyNavigatorState,
  language: Language,
  now: Date
): string {
  const t = (key: FamilyStringKey, vars?: Record<string, string | number>) => tFamily(language, key, vars);
  const lines: string[] = [t("packetHeading")];
  const profile = family.profile;
  if (profile) {
    const childLine = [
      profile.childFirstName,
      t("packetBornLine", { year: profile.birthYear }),
      profile.county
    ].filter(Boolean).join(" · ");
    lines.push(childLine);
    for (const diagnosis of profile.diagnoses) {
      lines.push(`- ${diagnosisDisplayLabel(diagnosis, language)}${diagnosis.diagnosedAt ? ` (${diagnosis.diagnosedAt})` : ""}`);
    }
  }

  const included = family.facts.filter(
    (fact) => fact.includeInSummary !== false && fact.status !== "inferred"
  );
  if (included.length > 0) {
    lines.push("", t("packetNoticedHeading"));
    for (const fact of sortFactsByInterviewDate(included, family.interviews)) {
      const when = interviewMonth(fact, family.interviews, language);
      lines.push(`- ${when ? `${when}: ` : ""}"${fact.sourceSnippet}"`);
    }
  }

  const openFlags = family.flags.filter((flag) => true); // all flags belong in the packet history
  if (openFlags.length > 0) {
    lines.push("", t("packetFlagsHeading"));
    for (const flag of openFlags) {
      lines.push(`- ${t("packetFlagRegression", { month: isoMonthLabel(flag.raisedAt, language) })}`);
    }
  }

  const inMotion = family.steps.filter(({ status }) => status === "in_touch" || status === "enrolled");
  if (inMotion.length > 0) {
    lines.push("", t("packetServicesHeading"));
    for (const step of inMotion) {
      const resource = getFamilyResourceById(step.resourceId);
      if (resource) {
        lines.push(`- ${resource.name} — ${t(step.status === "enrolled" ? "packetStatusEnrolled" : "packetStatusInTouch")} (${isoMonthLabel(step.updatedAt, language)})`);
      }
    }
  }

  const picked = PACKET_QUESTIONS.filter(({ id }) => family.packetQuestionIds.includes(id));
  if (picked.length > 0) {
    lines.push("", t("packetQuestionsHeading"));
    for (const question of picked) lines.push(`- ${t(question.labelKey)}`);
  }

  if (family.appointments.some((appointment) => appointment.barriers.includes("ride"))) {
    lines.push("", t("packetRideLine"));
  }

  lines.push("", t("packetFooter", { date: now.toLocaleDateString(language === "es" ? "es" : "en-US") }));
  return lines.join("\n");
}
```

Helpers (`sortFactsByInterviewDate`, `interviewMonth`, `isoMonthLabel`, `diagnosisDisplayLabel` — the last one reuses the diagnosis label keys already in `family-strings`) are private to the module. **Rule under test: no line of the packet is model prose — every content line is a catalog name, a stored verbatim snippet, a fixed string, or a date.**

- [ ] **Step 3: Tests** — fixed NOW; a fat fixture state exercising every section; assert: (a) `inferred` facts and `includeInSummary === false` facts never appear; (b) same state ⇒ identical string (call twice, `toBe`); (c) empty family sections are skipped (no headings without content); (d) es build contains the es headings; (e) ride barrier line appears only when a ride barrier exists.

- [ ] **Step 4: Run + commit**

```bash
npm run test -- src/domain/family-visit-packet.test.ts
git add src/domain/family-visit-packet.ts src/domain/family-visit-packet.test.ts
git commit -m "feat: deterministic visit-packet builder with starter questions"
```

---

### Task 6: Visit Packet view — print, copy, share, question picker (P2, UI)

**Files:**
- Create: `src/components/family-visit-packet.tsx`
- Modify: `src/components/family-experience.tsx` (render after journal), `src/state/store.tsx` (one action), `src/styles/globals.css` (print block), `src/i18n/family-strings.ts`
- Test: `src/components/family-visit-packet.test.tsx`

- [ ] **Step 1: Action** — `| { type: "toggleFamilyPacketQuestion"; questionId: string }` toggles membership in `packetQuestionIds` (validate id against `PACKET_QUESTIONS`; unknown id no-ops).

- [ ] **Step 2: Strings** (en/es): `packetHeading` ("Our visit packet" / "Nuestro paquete para la visita"), `packetBornLine` ("born {year}" / "nace en {year}"), `packetNoticedHeading` ("What we noticed, over time" / "Lo que notamos, con el tiempo"), `packetFlagsHeading` ("Changes we're flagging" / "Cambios que señalamos"), `packetFlagRegression` ("Possible loss of skills, noticed {month}" / "Posible pérdida de habilidades, notada en {month}"), `packetServicesHeading` ("Services already in motion" / "Servicios ya en marcha"), `packetStatusEnrolled` ("enrolled" / "inscrito"), `packetStatusInTouch` ("in touch" / "en contacto"), `packetQuestionsHeading` ("Questions we want to ask" / "Preguntas que queremos hacer"), `packetRideLine` ("We may need help with transportation." / "Podríamos necesitar ayuda con el transporte."), `packetFooter` ("Written from our own notes in Ladder · printed {date} · not a medical record." / "Escrito con nuestras propias notas en Ladder · impreso {date} · no es un expediente médico."), the ten question labels (`packetQResultsSchool`: "What do the results mean for school?" / "¿Qué significan los resultados para la escuela?", `packetQCoordinatesNext`: "Who coordinates the next steps?" / "¿Quién coordina los próximos pasos?", `packetQTherapyStart`: "Which therapy should start first?" / "¿Qué terapia debería empezar primero?", `packetQWaiverEffect`: "Does this change our waiver applications?" / "¿Esto cambia nuestras solicitudes de exención?", `packetQSchoolShare`: "What should we share with the school?" / "¿Qué debemos compartir con la escuela?", `packetQSecondVisit`: "Will there be a follow-up visit?" / "¿Habrá una visita de seguimiento?", `packetQHomeHelp`: "What can we keep doing at home?" / "¿Qué podemos seguir haciendo en casa?", `packetQRegressionMeaning`: "What does the change we noticed mean?" / "¿Qué significa el cambio que notamos?", `packetQSiblingsRisk`: "Should the siblings be checked too?" / "¿Deberíamos revisar también a los hermanos?", `packetQWhoToCall`: "Who do we call with questions after today?" / "¿A quién llamamos si tenemos preguntas después de hoy?"), plus prep-cover keys (`packetPrepTitle`: "Getting ready for the visit" / "Prepararse para la visita", reuse plan 14's `apptPrepBullet1..3` + `apptPrepSource`, `packetBringPacket`: "Bring this packet — it's your notes in your words." / "Lleva este paquete — son tus notas en tus palabras."), and UI keys (`packetPrint`: "Print" / "Imprimir", `packetCopy`: "Copy as text" / "Copiar como texto", `packetCopied`: "Copied." / "Copiado.", `packetShareAudit`: internal label — not needed; share reuses resource-share pattern), `packetPickTitle`: "Pick questions to bring" / "Elige preguntas para llevar".

- [ ] **Step 3: Component** — section `id="family-visit-packet"` with class `family-visit-packet`: question picker (10 labeled checkboxes → dispatch toggle), the rendered packet body (drive the DOM from the same data as the builder; the **copy** button uses `navigator.clipboard.writeText(buildFamilyVisitSummary(...))` with a "Copied." confirmation; **print** button calls `window.print()`), prep cover block at top (`packetPrepTitle`, `packetBringPacket`, the three prep bullets + CDC source link reused from plan 14 constants). Copy/print/share each dispatch `addAuditEvent` (`recordAuditEvent(patientId, "shared", "Family visit packet " + verb)` — verbs: printed/copied).

- [ ] **Step 4: Print CSS** — extend `src/styles/globals.css` `@media print` following the `.health-brief-card` precedent: when printing, hide app chrome and non-packet sections, show `.family-visit-packet` full-width serif-friendly. Concretely: add `body:has(.family-visit-packet:target) …`? No — keep the shipped pattern: the same rules the health brief uses (`display: none` for header/nav plus a `.family-visit-packet { break-inside: avoid; }` block). Match the existing brief's approach exactly; if the brief's print CSS hides everything except its card via a wrapper class, mirror that with `family-visit-packet`.

- [ ] **Step 5: Tests** — (a) picker toggles dispatch with the right id; unknown ids filtered by reducer (reducer test); (b) copy button writes the builder string (mock `navigator.clipboard`); (c) print button calls `window.print` (spy) and audits; (d) packet body shows a picked question and hides unpicked; (e) es renders.

- [ ] **Step 6: Run + commit**

```bash
npm run test -- src/components/family-visit-packet.test.tsx src/state/store.test.ts
git add src/components/family-visit-packet.tsx src/components/family-visit-packet.test.tsx src/components/family-experience.tsx src/state/store.tsx src/styles/globals.css src/i18n/family-strings.ts
git commit -m "feat: printable visit packet with question picker and copy/print"
```

---

### Task 7: Next-steps tracker — commit loop + follow-up turn (P3)

**Files:**
- Modify: `src/state/store.tsx` (actions), `src/components/family-resource-card.tsx` (CTA + status line), `src/components/family-experience.tsx` (follow-up turn, `id="family-followup"`), `src/i18n/family-strings.ts`
- Test: extend `src/state/store.test.ts`, `src/components/family-resource-card.test.tsx` (create if absent)

- [ ] **Step 1: Actions**

```ts
| { type: "planFamilyStep"; resourceId: string; domain: DevNeedDomain; at: string }
| { type: "updateFamilyStep"; stepId: string; status: FamilyStepStatus; at: string }
```

Reducer rules (all unit-tested):
- `planFamilyStep` no-ops if a step for that resource already exists; otherwise appends `{ id: crypto.randomUUID(), resourceId, domain, status: "planned", plannedAt: at, updatedAt: at }` and audits `"created"`, `"Family step planned"`.
- `updateFamilyStep` maps status + `updatedAt`; audits `"updated"`, `"Family step updated"`. **Sync:** status → `"enrolled"` adds the resourceId to `alreadyEnrolled` (dedupe); leaving `"enrolled"` removes it.
- Extend the existing `toggleFamilyEnrollment` case: toggling **on** upserts a step for that resource at `"enrolled"` (create with both timestamps = now if missing); toggling **off** sets an existing enrolled step to `"in_touch"` (no step created when none exists). Timestamps: this legacy action has no `at` payload — use `new Date().toISOString()` inline, matching how neighboring cases stamp audit events.

- [ ] **Step 2: Card CTA.** `FamilyResourceCard` gains optional `step?: FamilyResourceStep` and `onPlanStep?: (resource, domain) => void`. Render below the existing actions: no step → "I'll do this" button (calls `onPlanStep`); step present → a status line `stepStatusLine` ("Planned {month}" / "Tried" / "In touch" / "Enrolled" / "Not for us") using fixed keys. `FamilyExperience` passes `step={family.steps.find(s => s.resourceId === resource.id)}` and the dispatcher.

- [ ] **Step 3: Follow-up turn.** In `family-experience.tsx`, above the resources section, when `oldestStaleStep(family.steps, now)` (import from `family-journey`) returns a step **and** no check-in is due **and** no pending safety event (one-ask rule): render section `id="family-followup"` — "Last time you planned to contact {name} — how did it go?" with four fixed buttons [Got through → `in_touch` / Left a message → `tried` / Haven't yet → `planned` with `updatedAt` bumped (so it re-asks in another 7 days, not instantly) / Not for us → `not_for_us`]. Exactly one follow-up per page load: gate with a `useRef(false)` set when answered.

- [ ] **Step 4: Strings** (en/es): `stepPlanCta` ("I'll do this" / "Voy a hacerlo"), `stepStatusPlanned` ("Planned" / "Planeado"), `stepStatusTried` ("Tried" / "Intentado"), `stepStatusInTouch` ("In touch" / "En contacto"), `stepStatusEnrolled` ("Enrolled" / "Inscrito"), `stepStatusNotForUs` ("Not for us" / "No es para nosotros"), `followupQuestion` ("Last time you planned to contact {name} — how did it go?" / "La última vez planeaste contactar a {name} — ¿cómo te fue?"), `followupGotThrough` ("Got through" / "Logré comunicarme"), `followupLeftMessage` ("Left a message" / "Dejé un mensaje"), `followupNotYet` ("Haven't yet" / "Todavía no"), `followupNotForUs` ("Not for us" / "No es para nosotros"), `followupThanks` ("Noted — it's in your packet's services section when it counts." / "Anotado — aparecerá en la sección de servicios de tu paquete cuando cuente.").

- [ ] **Step 5: Tests.** Reducer: plan dedupe; enrolled sync both directions (`updateFamilyStep`→enrolled adds to `alreadyEnrolled`; `toggleFamilyEnrollment` off→`in_touch`; property: after any sequence of the four actions, `alreadyEnrolled.includes(r)` ⇔ step for r has status enrolled — write 4–5 explicit sequences, not a fuzzer). Component: CTA dispatches; status line renders per status; follow-up buttons dispatch the right `updateFamilyStep` payloads.

- [ ] **Step 6: Run + commit**

```bash
npm run test -- src/state/store.test.ts src/components/family-resource-card.test.tsx
git add src/state/store.tsx src/state/store.test.ts src/components/family-resource-card.tsx src/components/family-resource-card.test.tsx src/components/family-experience.tsx src/i18n/family-strings.ts
git commit -m "feat: next-steps tracker with follow-up turn and enrollment sync"
```

---

### Task 8: Deadline clocks (P3)

**Files:**
- Create: `src/domain/family-clocks.ts`
- Modify: `src/domain/family-journey.ts` (swap the Task 2 stub for the real import)
- Modify: `src/domain/family-resources.ts` (export `isFirstStepsResource`)
- Modify: `src/components/family-resource-card.tsx` (`clockLine?: string`), `src/components/family-experience.tsx`, `src/i18n/family-strings.ts`
- Test: `src/domain/family-clocks.test.ts`

- [ ] **Step 1: Domain.** In `family-clocks.ts`:

```ts
import { childAgeMonths } from "./family-screenings";
import type { FamilyNavigatorState, FamilyProfile } from "./types";

export const CLOCK_WARNING_WEEKS = 26; // surface within ~6 months of the cutoff
const DAY_MS = 24 * 60 * 60 * 1000;

export type FirstStepsClock = { weeksLeft: number; yearOnly: boolean };

// First Steps does not accept a new referral within 45 days of the third
// birthday (catalog-verified 2026-07-17). Year-only profiles assume the
// EARLIEST possible birthday (Jan 1) so the warning fires early, never late.
export function firstStepsClock(
  profile: FamilyProfile,
  now: Date,
  enrolled: boolean
): FirstStepsClock | null {
  if (enrolled) return null;
  const months = childAgeMonths(profile, now);
  const yearOnly = months === null;
  const thirdBirthday = Date.UTC(profile.birthYear + 3, (profile.birthMonth ?? 1) - 1, 1);
  const cutoff = thirdBirthday - 45 * DAY_MS;
  const msLeft = cutoff - now.valueOf();
  if (msLeft <= 0) return null;                       // past the cutoff: no countdown, cards still render
  const ageMonths = yearOnly ? (now.getUTCFullYear() - profile.birthYear) * 12 : months;
  if (ageMonths === null || ageMonths >= 36) return null;
  const weeksLeft = Math.max(1, Math.floor(msLeft / (7 * DAY_MS)));
  return weeksLeft <= CLOCK_WARNING_WEEKS ? { weeksLeft, yearOnly } : null;
}

export function hasEnrolledFirstSteps(family: FamilyNavigatorState): boolean {
  return family.steps.some(
    (step) => step.status === "enrolled" && isFirstStepsResource(step.resourceId)
  );
}
```

In `family-resources.ts`, export `isFirstStepsResource(resourceId: string): boolean` — true for the statewide First Steps entry and every POE entry (grep the file for the POE id scheme — the district entries are generated from `POE_DISTRICTS` with a slug-based id; implement against the real id prefix found there, e.g. `id.startsWith("first_steps") || id.startsWith("poe_")` — confirm the actual prefixes before writing).

Then in `family-journey.ts`, delete the Task 2 stub and import `firstStepsClock`, `hasEnrolledFirstSteps`, `CLOCK_WARNING_WEEKS` from `./family-clocks`. **Rung threshold:** the header rung fires at `weeksLeft <= 8` (urgent tail), while the card chip shows from 26 weeks — adjust `nextFamilyRung` to use a local `RUNG_CLOCK_WEEKS = 8` and keep the card using the clock's own window.

- [ ] **Step 2: Card chip + stage note.** `FamilyResourceCard` gains `clockLine?: string`, rendered as a calm `bg-note/30` chip above the actions. `FamilyExperience` computes once:

```ts
const clock = family?.profile ? firstStepsClock(family.profile, new Date(), hasEnrolledFirstSteps(family)) : null;
```

and passes `clockLine` to cards where `isFirstStepsResource(resource.id)`: `tFamily(language, clock.yearOnly ? "clockFirstStepsYearOnly" : "clockFirstSteps", { weeks: clock.weeksLeft })`. Michelle P. needs no new code — its `actNow` line already carries the date-ordered urgency; the tracker (Task 7) makes it a step like any other.

- [ ] **Step 3: Strings** (en/es): `clockFirstSteps` ("About {weeks} weeks left to start First Steps — after the cutoff, the school system takes over referrals." / "Quedan unas {weeks} semanas para empezar First Steps — después del corte, el sistema escolar se encarga de los referidos."), `clockFirstStepsYearOnly` (same + " Timing is shown early because only the birth year is known." / " El tiempo se muestra temprano porque solo se conoce el año de nacimiento.").

- [ ] **Step 4: Tests** — fixed NOW=2026-07-17: (a) child born 2024-01 (birthMonth 1) → cutoff = 2026-11-16, ~17 weeks → clock fires with weeksLeft 17; (b) same child enrolled → null; (c) born 2024, year-only → conservative cutoff (2027-01-01 − 45d = 2026-11-17) with `yearOnly: true`; (d) past cutoff → null; (e) age ≥36mo → null; (f) 18-month-old → null (outside 26-week window); (g) `nextFamilyRung` picks `clock` only at ≤8 weeks and ranks it above `checkin`.

- [ ] **Step 5: Run + commit**

```bash
npm run test -- src/domain/family-clocks.test.ts src/domain/family-journey.test.ts
git add src/domain/family-clocks.ts src/domain/family-clocks.test.ts src/domain/family-journey.ts src/domain/family-journey.test.ts src/domain/family-resources.ts src/components/family-resource-card.tsx src/components/family-experience.tsx src/i18n/family-strings.ts
git commit -m "feat: First Steps deadline clock with year-only conservatism"
```

---

### Task 9: Regression watch — cue lexicon, corpus gate, flags, clinic-now card (P4a)

**Files:**
- Modify: `src/domain/family-interview.ts` (regression category + `detectRegressionCue`)
- Create: `src/domain/family-regression.corpus.ts`, `src/domain/family-regression.test.ts`
- Modify: `src/state/store.tsx` (flag actions), `src/components/family-experience.tsx` (raise-on-extract + card), `src/i18n/family-strings.ts`
- Create: `src/components/family-clinic-now-card.tsx`
- Test: `src/components/family-clinic-now-card.test.tsx`, extend `src/state/store.test.ts`

- [ ] **Step 1: Lexicon.** In `family-interview.ts`, add ABOVE `CONCERN_CATEGORIES` and export for tests:

```ts
// Skill regression is a "tell the clinic now" signal, not a crisis and not a
// diagnosis. Verb-list patterns on purpose: "stopped talking" fires, "stopped
// crying at drop-off" must not — the corpus in family-regression.corpus.ts is
// the build-breaking contract.
export const REGRESSION_CUES: Record<"en" | "es", RegExp> = {
  en: /(?:stopped\s+(?:say|talk|walk|point|us|sign)\w*|lost\s+(?:words?|skills?|the\s+words?|his\s+words?|her\s+words?)|used\s+to\s+\w+(?:\s+\w+){0,3}\s+(?:but\s+)?(?:now|no\s+longer|doesn'?t|stopped)|no\s+longer\s+(?:say|talk|walk|point|sign|do)\w*|forgot\s+how\s+to)/i,
  es: /(?:dej[oó]\s+de\s+(?:hablar|decir|caminar|señalar|usar)|perdi[oó]\s+(?:palabras|habilidades|las\s+palabras)|antes\s+\w+(?:\s+\w+){0,3}\s+y\s+ya\s+no|ya\s+no\s+(?:habla|dice|camina|señala|hace)|olvid[oó]\s+c[oó]mo)/i
};

export function detectRegressionCue(text: string, language: "en" | "es"): string | null {
  const sentence = splitSentences(text).find((candidate) => REGRESSION_CUES[language].test(candidate));
  return sentence ? clampSnippet(sentence) : null;
}
```

Also add a regression **concern category** as the FIRST entry of `CONCERN_CATEGORIES` (so the fact appears in the journal/packet with the family's verbatim sentence), with `labelKey: "factRegressionLabel"`, `valueKey: "factRegressionValue"` and `patterns: REGRESSION_CUES`.

- [ ] **Step 2: Corpus + gate.** `family-regression.corpus.ts`:

```ts
export type RegressionCase = { id: string; language: "en" | "es"; text: string; expectCue: boolean };
export const REGRESSION_CASES: RegressionCase[] = [
  { id: "stopped_words", language: "en", text: "He stopped saying the words he knew, like more and mama.", expectCue: true },
  { id: "lost_words", language: "en", text: "She has lost words she used to say every day.", expectCue: true },
  { id: "used_to_now", language: "en", text: "He used to wave bye bye but now he doesn't.", expectCue: true },
  { id: "no_longer_points", language: "en", text: "She no longer points at things she wants.", expectCue: true },
  { id: "forgot_how", language: "en", text: "It's like he forgot how to climb the stairs.", expectCue: true },
  { id: "es_dejo_hablar", language: "es", text: "Dejó de hablar casi por completo este mes.", expectCue: true },
  { id: "es_perdio_palabras", language: "es", text: "Perdió palabras que decía todos los días.", expectCue: true },
  { id: "es_ya_no_senala", language: "es", text: "Ya no señala lo que quiere.", expectCue: true },
  // Traps — MUST stay silent:
  { id: "lost_shoe", language: "en", text: "He lost his shoe at the park again.", expectCue: false },
  { id: "lost_track_time", language: "en", text: "We lost track of time at therapy.", expectCue: false },
  { id: "losing_my_mind", language: "en", text: "Honestly I am losing my mind with the paperwork.", expectCue: false },
  { id: "stopped_crying", language: "en", text: "She stopped crying at drop-off, which is a relief.", expectCue: false },
  { id: "no_longer_diapers", language: "en", text: "He no longer needs diapers at night.", expectCue: false },
  { id: "es_dejo_llorar", language: "es", text: "Dejó de llorar cuando la dejo en la escuela.", expectCue: false },
  { id: "es_ya_no_aguanto", language: "es", text: "Ya no aguanto tanto papeleo, necesito un respiro.", expectCue: false }
];
```

`family-regression.test.ts` runs every case through `detectRegressionCue` — **all positives fire, all traps silent, zero env, inside `npm test`** (the vignette-gate discipline). Also assert the trap "no_longer_diapers": the en pattern's `no longer (say|talk|walk|point|sign|do)` must not match "needs" — if a pattern edit ever makes a trap fire, this file is the tripwire.

- [ ] **Step 3: Flag actions.**

```ts
| { type: "raiseFamilyRegressionFlag"; source: "probe" | "text"; at: string }
| { type: "acknowledgeFamilyRegressionFlag"; flagId: string; at: string }
```

`raise` no-ops when an unacknowledged regression flag already exists (FR-7's dedupe); otherwise appends `{ id: crypto.randomUUID(), type: "regression", source, raisedAt: at }` and audits `"created"`, `"Family regression flag raised"`. `acknowledge` stamps `acknowledgedAt` (no-op on unknown/acknowledged) and audits `"updated"`.

- [ ] **Step 4: Raise on extract + card.** In `family-experience.tsx` `addInterview`, after dispatching the interview: `if (detectRegressionCue(meta.rawText, language)) dispatch({ type: "raiseFamilyRegressionFlag", source: "text", at: createdAt });`. Render `FamilyClinicNowCard` (section `id="family-clinic-now"`) directly under the safety banner slot whenever an unacknowledged flag exists:

```tsx
export function FamilyClinicNowCard({ flag, language, clinic, onAcknowledge }: {
  flag: FamilyFlag; language: Language; clinic: string; onAcknowledge: (flagId: string) => void;
}) { /* bordered bg-note/30 card, NOT the crisis styling:
   heading clinicNowTitle, body clinicNowBody({clinic}), button clinicNowAck.
   No page lock, no voice lock. data-testid="family-clinic-now-card". */ }
```

- [ ] **Step 5: Strings** (en/es): `factRegressionLabel` ("Change you noticed" / "Cambio que notaste"), `factRegressionValue` ("Possible loss of skills — from your words" / "Posible pérdida de habilidades — según tus palabras"), `clinicNowTitle` ("Worth telling the clinic now" / "Vale la pena avisar a la clínica ahora"), `clinicNowBody` ("Losing skills is worth reporting now — not waiting for the visit. Call {clinic}. It can matter for how soon your child is seen." / "Perder habilidades vale la pena reportarlo ahora — sin esperar la visita. Llama a {clinic}. Puede influir en qué tan pronto atienden a tu hijo o hija."), `clinicNowAck` ("I've noted this" / "Lo tengo anotado").
  **Copy rule (review before commit):** the body names a symptom pattern to report; it must not name any condition and must not promise scheduling outcomes — this exact wording passes both; keep it.

- [ ] **Step 6: Tests.** Reducer: raise dedupe (second raise while unacknowledged no-ops; after acknowledge, a new raise works); acknowledge stamps. Card: renders body with clinic name, acknowledge dispatches, **no `role="alert"` and no voice-locking side effects** (assert the card is a plain region). Store test that `crisis:gate` semantics are untouched is structural: run the gate in Task 13.

- [ ] **Step 7: Run + commit**

```bash
npm run test -- src/domain/family-regression.test.ts src/state/store.test.ts src/components/family-clinic-now-card.test.tsx
git add src/domain/family-interview.ts src/domain/family-regression.corpus.ts src/domain/family-regression.test.ts src/state/store.tsx src/state/store.test.ts src/components/family-clinic-now-card.tsx src/components/family-clinic-now-card.test.tsx src/components/family-experience.tsx src/i18n/family-strings.ts
git commit -m "feat: regression watch — trap-gated cue lexicon, flags, clinic-now card"
```

---

### Task 10: Monthly check-in turn — note, probe, pulse, time-travel (P4b)

**Files:**
- Modify: `src/state/store.tsx` (pulse + touch-backdate actions), `src/components/family-experience.tsx` (check-in section `id="family-checkin"`), `src/i18n/family-strings.ts`
- Create: `src/components/family-checkin.tsx`
- Test: `src/components/family-checkin.test.tsx`, extend `src/state/store.test.ts`

- [ ] **Step 1: Actions.**

```ts
| { type: "recordFamilyPulse"; pulse: FamilyPulse }
| { type: "skipFamilyCheckin"; at: string }
| { type: "backdateFamilyTouches"; days: number; now: string }
```

`recordFamilyPulse` appends (guard score 1–5 integer; audit `"created"`, `"Family pulse recorded"`). `skipFamilyCheckin` appends nothing visible but stamps a touch so due-ness resets — implement as a zero-cost `FamilyPulse`? No — **implement as an audit event only plus a `family.lastCheckinSkippedAt` field? No.** Simplest honest mechanism: `skipFamilyCheckin` appends a `FamilyFlag`? Also no. **Decision:** add one more slice field in this task, `checkinTouchedAt: string | null` (types + storage optional-backfill `null`, same discipline as Task 1 — a one-field addendum is acceptable here because due-ness genuinely needs a skip-stamp that isn't fake data). `familyLastTouchAt` (Task 2) gains it as a source; both `recordFamilyPulse` and `skipFamilyCheckin` set it; completing part 1 (a `checkin` interview) already counts via interviews.
`backdateFamilyTouches` maps every timestamp source used by `familyLastTouchAt` back by `days` (interviews `createdAt`, steps timestamps, pulses `at`, flags timestamps, saved `savedAt`, appointments `createdAt`/ack times, `checkinTouchedAt`), exactly the `backdateFamilyDiagnoses` transform style; audits `"updated"`, `"Demo control: family activity moved {days} days back"`.

- [ ] **Step 2: Component.** `FamilyCheckin({ family, language, locked, onOpenNote, onProbeAnswer, onPulse, onSkip })` renders only when `checkInDue(family, now)` and no pending safety event and no unacknowledged flag (the clinic-now card owns the page's one ask). Three sequential parts, local `part` state:
  1. **Note invite:** "It's been about a month. Anything new or different with {childName}?" + two buttons: "Add a note" (calls `onOpenNote` — FamilyExperience sets `interviewKindRef.current = "checkin"` and focuses the interview box) and "Nothing new" (advances to part 2).
  2. **Probe:** the skill-loss question with [No / Not sure / Yes, I think so]. "Not sure" swaps in the two-sentence cited example copy (`probeExamples`, source line to the CDC act-early URL from plan 14's constant) + [No / Yes, I think so]. "Yes" → `onProbeAnswer("yes")` → FamilyExperience dispatches `raiseFamilyRegressionFlag({ source: "probe" })`; all answers advance.
  3. **Pulse:** "How supported do you feel this month?" — five 44px buttons 1–5 + "Skip". Any tap → `onPulse(score)`; skip → `onSkip()`. Completion collapses the card with a one-line `checkinDone` thanks.
  Every part also honors a corner "Skip check-in" link → `onSkip()`.

- [ ] **Step 3: Strings** (en/es): `checkinTitle` ("Monthly check-in" / "Chequeo mensual"), `checkinNoteInvite` ("It's been about a month. Anything new or different with {name}?" / "Ha pasado como un mes. ¿Algo nuevo o diferente con {name}?" — fall back to "your child"/"tu hijo o hija" when no name), `checkinAddNote` ("Add a note" / "Agregar una nota"), `checkinNothingNew` ("Nothing new" / "Nada nuevo"), `checkinProbe` ("Compared with a few months ago, has {name} lost any skills — words, movements, things they could do?" / "Comparado con hace unos meses, ¿{name} ha perdido habilidades — palabras, movimientos, cosas que ya hacía?"), `checkinProbeNo` ("No" / "No"), `checkinProbeUnsure` ("Not sure" / "No estoy segura"), `checkinProbeYes` ("Yes, I think so" / "Sí, creo que sí"), `probeExamples` ("Skill loss can look like: words that stopped, waving or pointing that went away, or steps backward in things like feeding or stairs." / "La pérdida de habilidades puede verse así: palabras que dejaron de decirse, saludar o señalar que desapareció, o retrocesos en comer o subir escaleras."), `probeExamplesSource` ("Source: CDC, Learn the Signs. Act Early." / "Fuente: CDC, Learn the Signs. Act Early. (en inglés)"), `pulseQuestion` ("How supported do you feel this month?" / "¿Qué tan apoyada o apoyado te sientes este mes?"), `pulseSkip` ("Skip" / "Omitir"), `checkinSkip` ("Skip check-in" / "Omitir el chequeo"), `checkinDone` ("Thanks — see you next month." / "Gracias — nos vemos el próximo mes."), `checkinDemoControl` ("Demo: pretend a month passed" / "Demo: imagina que pasó un mes").

- [ ] **Step 4: Demo control.** A small disclosure near the check-in (or in the wait header's footer when quiet), rendering one button "Demo: pretend a month passed" → `dispatch({ type: "backdateFamilyTouches", days: 31, now })`, following the appointment demo-panel styling.

- [ ] **Step 5: Tests.** Reducer: pulse guard rejects 0/6/non-integer (no-op); `backdateFamilyTouches` shifts an interview and a pulse by 31 days and stamps audit; skip stamps `checkinTouchedAt`. Component: renders only-when-due handled by parent (test parent gating in `family-experience` test or accept component-level: given due state, part sequence advances No→pulse; "Yes, I think so" calls `onProbeAnswer("yes")`; pulse tap calls `onPulse(4)`; skip calls `onSkip` from any part. `checkInDue` false after `skipFamilyCheckin` reducer round-trip (journey test extension).

- [ ] **Step 6: Run + commit**

```bash
npm run test -- src/components/family-checkin.test.tsx src/state/store.test.ts src/domain/family-journey.test.ts src/state/storage.test.ts
git add src/domain/types.ts src/state/storage.ts src/state/storage.test.ts src/state/store.tsx src/state/store.test.ts src/domain/family-journey.ts src/domain/family-journey.test.ts src/components/family-checkin.tsx src/components/family-checkin.test.tsx src/components/family-experience.tsx src/i18n/family-strings.ts
git commit -m "feat: monthly check-in — note invite, skill-loss probe, supported pulse"
```

---

### Task 11: While-you-wait guides (P5a)

**Files:**
- Create: `src/domain/family-guides.ts`, `src/domain/family-guides.test.ts`
- Modify: `src/components/family-experience.tsx` (strip under resources), `src/i18n/family-strings.ts`
- Create: `src/components/family-guide-card.tsx`
- Test: `src/components/family-guide-card.test.tsx`

- [ ] **Step 1: Catalog module.** `FamilyGuide` interface per spec F6. `matchFamilyGuides(profile, leadDomain, now): FamilyGuide[]` — deterministic: guides whose `domains` include the lead domain and whose age band (if any) contains the child's conservative age, ordered as seeded, capped at 2 (`GUIDE_STRIP_LIMIT = 2`).

- [ ] **Step 2: Seed — with mandatory verification.** Candidate seeds below; **for each, fetch the URL at build time (curl -sI, follow redirects) and set `verifiedAt` to the real check date; any candidate that 404s or bot-blocks moves to `humanVerify: true` with the check noted in the commit body.** Do not invent replacements; a shorter verified list beats a padded one.

| id | domains | ages (mo) | title (en) | source |
|---|---|---|---|---|
| `cdc_milestones_help` | diagnosis_education, parent_support | 0–60 | "How to help your child learn and grow" | CDC act-early — `https://www.cdc.gov/act-early/` |
| `cdc_milestone_tracker` | diagnosis_education | 2–60 | "Track milestones with the CDC app" | `https://www.cdc.gov/act-early/milestones/index.html` |
| `medline_speech_home` | therapies | 12–72 | "Everyday talk: growing speech at home" | MedlinePlus speech & language — `https://medlineplus.gov/speechandlanguageproblemsinchildren.html` |
| `medline_behavior` | parent_support | 24–144 | "When behavior is the hard part" | `https://medlineplus.gov/childbehaviordisorders.html` |
| `firststeps_family_guide` | early_intervention | 0–36 | "What First Steps visits look like" | KY CHFS First Steps — `https://www.chfs.ky.gov/agencies/dph/dmch/ecdb/Pages/firststeps.aspx` |
| `kyspin_resources` | parent_support, school_iep | 0–252 | "KY-SPIN: a parent line that answers" | `https://www.kyspin.com/` |
| `cdc_autism_signs` | diagnosis_education | 12–96 | "Understanding the signs you're seeing" | `https://www.cdc.gov/autism/signs-symptoms/index.html` |
| `medline_sleep_kids` | parent_support | 12–144 | "Sleep, meltdowns, and hard evenings" | `https://medlineplus.gov/healthysleep.html` |

`steps` per guide: 3–4 short imperative lines faithfully adapted from the cited page's guidance (write them at seed time from the fetched page content, not from memory), each guide's `plainSummary` one sentence. Strings: guide titles/summaries/steps live **in the catalog file** (single-language en with an es field pair `title_es`, `plainSummary_es`, `steps_es` — mirroring how `family-resources` handles language today: check how resource cards localize; if the catalog is en-only today with an es notice (`resourceSourceLanguageNotice`), follow that precedent instead: guides stay en with the existing es source-language notice — **do whichever `family-resources.ts` already does; do not invent a new i18n mechanism**).

- [ ] **Step 3: UI.** `FamilyGuideCard` — compact card: title, summary, steps as a short list, source link + `verifiedAt` date line (reuse the resource card's source-link styling). Strip in `family-experience.tsx` under the matched resources ("Things to try at home" / "Cosas para probar en casa" — strings `guidesTitle`, `guidesIntro`: "Small, checked ideas for the meantime — from the sources named on each card." / "Ideas pequeñas y verificadas para mientras tanto — de las fuentes que aparecen en cada tarjeta."), fed by `matchFamilyGuides(profile, leadDomain)` where leadDomain = `rankedSet?.lead ?? family.activeDomains[0]`.

- [ ] **Step 4: Tests.** Domain: match honors domain + age band + cap 2 + deterministic order; every seed has non-empty `sourceUrl`, `verifiedAt`, ≤4 steps (a catalog-shape test, like `family-resources.test.ts` does). Component: renders source + date; strip absent when no domains active.

- [ ] **Step 5: Run + commit**

```bash
npm run test -- src/domain/family-guides.test.ts src/components/family-guide-card.test.tsx
git add src/domain/family-guides.ts src/domain/family-guides.test.ts src/components/family-guide-card.tsx src/components/family-guide-card.test.tsx src/components/family-experience.tsx src/i18n/family-strings.ts
git commit -m "feat: verified while-you-wait guide strip"
```

---

### Task 12: Earlier-visit list (P5b)

**Files:**
- Modify: `src/state/store.tsx` (actions), `src/components/family-appointment-card.tsx` (opt-in turn + demo control), `src/i18n/family-strings.ts`
- Test: extend `src/components/family-appointment-card.test.tsx`, `src/state/store.test.ts`

- [ ] **Step 1: Actions.**

```ts
| { type: "setFamilySoonerList"; soonerList: FamilySoonerList }
| { type: "clearFamilySoonerList" }
```

(Validate constraints non-empty + known; audit `"created"` / `"deleted"`-style `"updated"` messages: `"Family earlier-visit list joined"` / `"Family earlier-visit list left"`.)

- [ ] **Step 2: Opt-in turn.** In `FamilyAppointmentCard`, when `family.referral !== null && family.soonerList === null && !locked` and the card is NOT currently showing the barriers question or a reminder/overdue turn (one-ask rule — render it only in the quiet states: `offered` before slots picked is fine *below* the offer, and booked-with-barriers-answered): a `ladderTurn` — `soonerQuestion` ("Cancellations happen. If an earlier time opened up, could you take it on short notice?" / "A veces hay cancelaciones. Si se abriera un horario más temprano, ¿podrían tomarlo con poco aviso?") with [`soonerYes` ("Yes, put us on the list" / "Sí, anótanos en la lista") / `soonerNo` ("No thanks" / "No, gracias")]. Yes → constraint multi-select chips (fixed): `soonerMornings` ("Weekday mornings" / "Mañanas entre semana"), `soonerAfternoons` ("Weekday afternoons" / "Tardes entre semana"), `soonerAnyWeekday` ("Any weekday" / "Cualquier día entre semana"), `soonerNotice` ("We need 2+ days' notice" / "Necesitamos 2+ días de aviso") + confirm button `soonerConfirm` ("Add us" / "Anótanos") disabled until ≥1 chip. "No thanks" stores a session-only ref so the turn doesn't re-ask this visit (do NOT persist a refusal — re-offering next session is fine and honest). Opted-in state renders one line `soonerOnList` ("On the earlier-visit list — you can leave any time." / "En la lista de visita anticipada — puedes salirte cuando quieras.") + `soonerLeave` ("Leave the list" / "Salir de la lista") → `clearFamilySoonerList`.

- [ ] **Step 3: Demo control.** In the existing demo disclosure panel, add `soonerDemoCta` ("An earlier opening appeared (demo)" / "Se abrió un lugar antes (demo)") — enabled only when `soonerList !== null`. Dispatch: `offerFamilyAppointment` with an appointment built by a new helper in `family-appointments.ts`:

```ts
export function createSoonerAppointmentOffer(now: Date, constraints: FamilySoonerConstraint[]): FamilyAppointment {
  const daysOut = constraints.includes("needs_notice") ? 3 : 2;
  const hour = constraints.includes("weekday_afternoons") && !constraints.includes("weekday_mornings") ? 14 : 9;
  const slot = new Date(now.valueOf() + daysOut * 24 * 60 * 60 * 1000);
  slot.setHours(hour, 30, 0, 0);
  return { ...createFamilyAppointmentOffer(now), offeredSlots: [slot.toISOString()] };
}
```

Accepting books it through the existing `bookFamilyAppointment`; the reminder ladder recomputes automatically (plan 14 logic is date-driven). Declining ("Other times" absent here — a single `soonerDecline` ("Keep our current time" / "Mantener nuestro horario") button) dispatches `missFamilyAppointment`? **No** — declining a sooner offer must NOT mark anything missed: add reducer action `| { type: "withdrawFamilyAppointmentOffer"; appointmentId: string; at: string }` that removes an **offered, never-booked** appointment from the array (guard: only `status === "offered"` and `scheduledFor === undefined`; audit `"updated"`, `"Earlier-visit offer declined (demo)"`) — restoring the previous booked appointment as `activeFamilyAppointment` (it's the prior array entry). Unit-test that sequence explicitly: booked A → sooner offer B → withdraw B → active is A, still booked.

- [ ] **Step 4: Tests.** Reducer: sooner set/clear validation; withdraw guard (cannot withdraw a booked appointment). Card: opt-in flow dispatches with picked constraints; on-list line + leave; demo CTA disabled until opted in; the sooner offer renders its single near slot; declining restores the prior booking (integration-style with the harness the file already uses).

- [ ] **Step 5: Run + commit**

```bash
npm run test -- src/components/family-appointment-card.test.tsx src/state/store.test.ts src/domain/family-appointments.test.ts
git add src/state/store.tsx src/state/store.test.ts src/domain/family-appointments.ts src/domain/family-appointments.test.ts src/components/family-appointment-card.tsx src/i18n/family-strings.ts
git commit -m "feat: earlier-visit list with constraint chips and demo backfill offer"
```

---

### Task 13: E2E journeys, gates, docs (closeout)

**Files:**
- Modify: `e2e/family-navigator.spec.ts` (two new tests)
- Modify: `docs/specs/13-ladder-waitlist-companion.md` (status line), `docs/plans/README.md` (row 15), `docs/specs/09-family-navigator.md` (one addendum sentence)

- [ ] **Step 1: Journey A — journal → check-in → packet.** Using the file's helpers (`fillBasics`, `stubUnconfiguredFamilyInterview`, frozen clock):

```ts
test("ladder companion: notes accrue, check-in watches, packet prints", async ({ page }) => {
  await stubUnconfiguredFamilyInterview(page);
  await page.goto("/ladder");
  await fillBasics(page, { county: "Scott", birthYear: "2024", birthMonth: "1", schoolStage: "not_school_age" });

  // Wait header present (no referral yet → no on-list line, header still renders)
  await expect(page.getByTestId("family-wait-header")).toBeVisible();

  // Orientation → then a note through the same box (mock extraction path)
  // (submit PARENT_DESCRIPTION via the interview box per the golden-path test's steps,
  //  then submit a second short note: "He stopped saying more at dinner.")
  // Regression cue in the note raises the clinic-now card:
  await expect(page.getByTestId("family-clinic-now-card")).toBeVisible();
  await page.getByRole("button", { name: "I've noted this" }).click();

  // Journal shows the note under this month with its provenance
  await expect(page.getByText("Your notes so far")).toBeVisible();

  // Demo: pretend a month passed → check-in due
  await page.getByRole("button", { name: "Demo: pretend a month passed" }).click();
  await expect(page.getByText("Monthly check-in")).toBeVisible();
  await page.getByRole("button", { name: "Nothing new" }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "4" }).click();
  await expect(page.getByText("Thanks — see you next month.")).toBeVisible();

  // Packet: pick a question, copy text contains the note verbatim
  await page.getByRole("checkbox", { name: "Who coordinates the next steps?" }).check();
  // First Steps clock chip visible for a 2024-01 child at FROZEN_NOW (≈17 weeks):
  await expect(page.getByText(/weeks left to start First Steps/)).toBeVisible();
});
```

(Adapt the interview-submission lines to the exact helper sequence the golden-path test uses — copy its steps verbatim; the mock extractor's regression category fires on the "stopped saying" sentence.)

- [ ] **Step 2: Journey B — steps + sooner list.** Seed referral + book (reuse plan 14's journey steps), then: "I'll do this" on a resource card → status line "Planned"; opt into the earlier-visit list with "Weekday mornings" → header chip "On the earlier-visit list"; demo "An earlier opening appeared (demo)" → single slot → book it → "Booked for … (demo)" shows the near date.

- [ ] **Step 3: Full verification.**

```bash
npm run check
npm run crisis:gate
npm run test:e2e -- family-navigator.spec.ts
```

All green, and `crisis:gate` **unchanged**. If `npm test` flakes under load (known when the dev server is running — see memory), stop the preview server and re-run before judging.

- [ ] **Step 4: Docs.** Spec 13 status line: "Status: … **Implemented by plan 15** (date, commit range)." Plans README row 15 → authored-Ready at plan commit time, flipped to Complete at this step with the commit range and gate results. Spec 09 addendum sentence: "Spec 13 (waitlist companion) extends the wait itself: journal, packet, steps/clocks, check-in + pulse, guides, earlier-visit list."

- [ ] **Step 5: Commit**

```bash
git add e2e/family-navigator.spec.ts docs/specs/13-ladder-waitlist-companion.md docs/specs/09-family-navigator.md docs/plans/README.md
git commit -m "test: companion e2e journeys + spec/plan lifecycle closeout"
```

---

## Execution notes

- **Task order is dependency order:** 1 → 2 → 3 form the P0 spine; 4 needs 1–3; 5–6 need 4 (facts/toggles); 7 before 8 (clock consumes `hasEnrolledFirstSteps` over steps); 9 before 10 (check-in raises flags); 11–12 independent after 7; 13 last.
- **After every task:** the named scoped test command, plus `npm run lint` if any file was created. `npm run check` at Tasks 1, 6, 10, 13 minimum (type-level churn happens there).
- **Do not push at any point.** When the user says ship: full gates → guarded plain push → `vercel --prod --archive=tgz` → verify `/ladder` 200 + redirect → append `docs/ops/DEPLOYS.jsonl` (the plan-14 closeout is the template).
- **Deferred beyond this plan** (spec's own list): impact dashboard render (its event substrate lands here), notification reuse for check-ins, guide ranking via the model chain, accounts/persistence (the demo→pilot gate).
