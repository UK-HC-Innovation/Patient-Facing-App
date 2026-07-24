# UKHCI Ladder — Rebrand + Evaluation-Visit Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the Family Navigator to **UKHCI Ladder** (user-facing strings + `/ladder` route with `/family` redirect) and add the first missing Ladder capability: an appointment + no-show loop — referral anchor, slot booking in the thread, a fixed-choice barriers check that routes to existing resources, a T-14/T-3/T-1 reminder ladder driven by a demo time-travel control, and missed-visit recovery.

**Architecture:** Everything extends the existing family slice. New pure domain logic lives in `src/domain/family-appointments.ts`; state changes are new reducer actions on `FamilyNavigatorState` (persisted via the existing sanitize-on-load pattern in `src/state/storage.ts`); UI is one new self-contained section component `FamilyAppointmentCard` rendered by `family-experience.tsx`. No API routes, no backend — demo-first, localStorage only, exactly like the rest of the navigator.

**Tech Stack:** Next.js 15 (app router), React 19, TypeScript strict, Vitest + Testing Library, Playwright, Tailwind. No new dependencies.

## Global Constraints

- **Code identifiers stay `family*`** — the Ladder brand lives in user-facing strings, the route, and docs only. Do NOT rename files, types, actions, or `/api/family/*`.
- **Every user-facing string ships en + es** in `src/i18n/family-strings.ts` (es uses informal `tú`, "tu hijo o hija" phrasing — match existing copy).
- **No new free-text input surfaces.** All new turns are fixed buttons, so the crisis classifier's surface is unchanged. `npm run crisis:gate` and `npm run navigator:gate` must stay green.
- **One-ask-at-a-time invariant:** the appointment card never shows two open questions at once.
- **Honest demo framing:** every simulated thing says "(demo)" — the app's existing "Demo — not an official service" discipline continues as "UKHCI Ladder · concept demo".
- **TypeScript strict, no `any`, prefer `const`.** Match surrounding comment density and idiom.
- **Path-scoped commits** (`git add <exact paths>`). The shared tree may hold other sessions' edits.
- **`next.config.mjs` caveat:** the working tree has an unrelated pending hunk (removal of the food-lens `allowedDevOrigins` block). When Task 2 commits `next.config.mjs`, run `git diff --cached next.config.mjs` first; if the food-lens hunk is still uncommitted it will ride along — note it in the commit body ("includes pending food-lens dev-origins cleanup from shared tree") rather than trying to split hunks.
- **Do not push.** Commits to master are fine; push only when the user asks (or via /ship-phase).
- Verification commands: `npm run test -- <path>` (vitest), `npm run lint`, `npm run check`, `npm run crisis:gate`, `npm run navigator:gate`, `npm run test:e2e -- family-navigator.spec.ts`.

---

### Task 1: Rebrand strings + entry-point labels

**Files:**
- Modify: `src/i18n/family-strings.ts` (en block ~line 257, es block ~line 510)
- Modify: `src/domain/front-door.ts:25,54,63,85,94`
- Modify: `src/domain/route-classifier.ts:28` (the `"/family"` keyword array)
- Modify: `src/app/checkin/page.tsx:26-27,48-49` (the `copy.family` / `copy.familyBody` labels)
- Modify: any test currently asserting the old title/badge text (find with the grep in Step 3)

**Interfaces:**
- Produces: new `pageTitle` / `demoBadge` copy that Task 2's moved page test and Task 6's e2e assert against.

- [ ] **Step 1: Update the brand strings (en + es)**

In `src/i18n/family-strings.ts`, change these existing values (keys and all other strings stay):

```ts
// en block:
pageTitle: "Ladder — your child's development",
demoBadge: "UKHCI Ladder · concept demo — not an official service",
```

```ts
// es block:
pageTitle: "Ladder — el desarrollo de tu hijo o hija",
demoBadge: "UKHCI Ladder · demo conceptual — no es un servicio oficial",
```

Leave `intro`, `interviewTitle`, `interviewIntro` unchanged — they are working plain-language copy and the brand should not crowd the clinical honesty lines.

- [ ] **Step 2: Update entry-point labels**

`src/domain/front-door.ts` — five sites reference the old label:

```ts
// line 25 (route→label map):
"/family": "Ladder — your child's development",
// lines 54 and 63 (en chip rules) — replace label: "Your child's development" with:
label: "Ladder — your child's development"
// lines 85 and 94 (es chip rules) — replace label: "El desarrollo de tu hijo o hija" with:
label: "Ladder — el desarrollo de tu hijo o hija"
```

`src/domain/route-classifier.ts` — add `"ladder"` as the first keyword in the `"/family"` array:

```ts
"/family": [
  "ladder",
  "family navigator",
  ...
```

`src/app/checkin/page.tsx` — update the link-card copy:

```ts
// en (lines 26-27):
family: "Ladder — family support",
familyBody: "Continue to family and caregiver support.",
// es (lines 48-49):
family: "Ladder — apoyo familiar",
familyBody: "Continúa al apoyo para familias y personas cuidadoras.",
```

(`familyBody` values unchanged — shown for context.)

- [ ] **Step 3: Find and update tests asserting old copy**

```bash
grep -rn "Your child's development\|El desarrollo de tu hijo\|Demo — not an official service\|Demo — no es un servicio oficial" src e2e --include="*.ts" --include="*.tsx"
```

Update every test assertion to the new strings (source hits in `front-door.ts` are already handled above; e2e hits are updated here too if they assert the heading/badge — the e2e route change itself is Task 2). Do not weaken assertions to regexes that would pass on both old and new copy.

- [ ] **Step 4: Run scoped tests**

```bash
npm run test -- src/domain/front-door.test.ts src/app/family src/components
```

Expected: PASS (if `front-door.test.ts` doesn't exist under that exact name, run `npm run test` and confirm no failures mention front-door, family page, or checkin).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/family-strings.ts src/domain/front-door.ts src/domain/route-classifier.ts src/app/checkin/page.tsx
git add -u src  # picks up only already-tracked test files you edited
git commit -m "feat: rebrand family navigator to UKHCI Ladder (strings + entry labels)"
```

---

### Task 2: `/ladder` route + `/family` redirect

**Files:**
- Move: `src/app/family/page.tsx` → `src/app/ladder/page.tsx`
- Move: `src/app/family/page.test.tsx` → `src/app/ladder/page.test.tsx`
- Modify: `next.config.mjs` (add `redirects()`)
- Modify: `src/domain/front-door.ts`, `src/domain/route-classifier.ts`, `src/app/checkin/page.tsx` (hrefs `"/family"` → `"/ladder"`)
- Modify: `e2e/family-navigator.spec.ts` (gotos at lines 165, 301, 319, 350, 425, 453 + one new redirect test)

**Interfaces:**
- Consumes: Task 1's labels.
- Produces: canonical `/ladder` URL every later task uses; `/family` (with query string) permanently redirects.

- [ ] **Step 1: Move the page (keep `/api/family/*` where it is)**

```bash
git mv src/app/family/page.tsx src/app/ladder/page.tsx
git mv src/app/family/page.test.tsx src/app/ladder/page.test.tsx
```

Fix any relative-import or snapshot-name fallout inside the moved test (imports are `@/`-aliased so usually none). `src/app/family/` should now contain nothing (the `api/family` routes live under `src/app/api/family/`, untouched).

- [ ] **Step 2: Add the redirect**

In `next.config.mjs`, add inside `nextConfig` (alongside `headers()`):

```js
async redirects() {
  return [
    {
      source: "/family",
      destination: "/ladder",
      permanent: true
    }
  ];
},
```

Next.js preserves the query string by default, so `/family?k=<passcode>` → `/ladder?k=<passcode>` — the passcode gate keeps working for shared links.

- [ ] **Step 3: Repoint internal hrefs**

```bash
grep -rn '"/family"' src --include="*.ts" --include="*.tsx" | grep -v "api/family"
```

Update each hit to `"/ladder"`: the `front-door.ts` map key (line 25) and both chip-rule `href:` values per language, the `route-classifier.ts` map key (line 28), and the `checkin/page.tsx` `<Link href>` (line 186). Update any route-map tests that assert the `"/family"` key.

- [ ] **Step 4: Update e2e navigation + add redirect proof**

In `e2e/family-navigator.spec.ts`, change every `page.goto("/family...")` to `page.goto("/ladder...")` (keep query strings). Add one new test near the top-level tests:

```ts
test("family URL redirects to ladder and keeps the query string", async ({ page }) => {
  await page.goto("/family?k=demo-passcode");
  await expect(page).toHaveURL(/\/ladder\?k=demo-passcode$/);
});
```

(The file's `test.beforeEach` already handles fresh storage and the frozen clock.)

- [ ] **Step 5: Verify build + targeted e2e**

```bash
npm run build
npm run test:e2e -- family-navigator.spec.ts
```

Expected: build succeeds (redirect config is validated at build time); e2e PASS including the new redirect test.

- [ ] **Step 6: Commit (see next.config caveat in Global Constraints)**

```bash
git diff --cached next.config.mjs  # after staging, confirm what rides along
git add next.config.mjs src/app/ladder src/app/family src/domain/front-door.ts src/domain/route-classifier.ts src/app/checkin/page.tsx e2e/family-navigator.spec.ts
git commit -m "feat: serve Ladder at /ladder with permanent /family redirect"
```

---

### Task 3: Appointment domain model (`family-appointments.ts`)

**Files:**
- Modify: `src/domain/types.ts` (after `SavedFamilyResource`, ~line 378)
- Create: `src/domain/family-appointments.ts`
- Test: `src/domain/family-appointments.test.ts`

**Interfaces:**
- Produces (Task 4 + 5 rely on these exact names):
  - Types: `FamilyReferral`, `FamilyAppointment`, `FamilyAppointmentBarrier`, `FamilyReminderOffset`, `FamilyAppointmentReminderAck`, `FamilyAppointmentStatus`
  - `FamilyNavigatorState` gains `referral: FamilyReferral | null; appointments: FamilyAppointment[];`
  - Functions: `createFamilyAppointmentOffer(now: Date): FamilyAppointment`, `activeFamilyAppointment(appointments: FamilyAppointment[]): FamilyAppointment | undefined`, `dueFamilyReminder(appointment: FamilyAppointment, now: Date): FamilyReminderOffset | null`, `overdueFamilyAppointment(appointment: FamilyAppointment, now: Date): boolean`, `formatFamilySlot(slotIso: string, language: Language): string`
  - Constants: `FAMILY_APPOINTMENT_CLINIC`, `REMINDER_OFFSET_DAYS: Record<FamilyReminderOffset, number>`, `BARRIER_DOMAINS: Record<Exclude<FamilyAppointmentBarrier, "none">, DevNeedDomain>`, `FAMILY_APPOINTMENT_COUNTDOWNS` and type `FamilyAppointmentCountdownDays = 13 | 2 | 1 | -1`

- [ ] **Step 1: Add types to `src/domain/types.ts`**

Insert after the `SavedFamilyResource` type:

```ts
export type FamilyReferral = {
  clinic: string;
  referredAt: string;
};

export type FamilyAppointmentBarrier = "ride" | "sibling_care" | "work_schedule" | "none";

export type FamilyReminderOffset = "t14" | "t3" | "t1";

export type FamilyAppointmentReminderAck = {
  offset: FamilyReminderOffset;
  acknowledgedAt: string;
};

export type FamilyAppointmentStatus = "offered" | "booked" | "confirmed" | "completed" | "missed";

// One evaluation visit at the developmental-peds clinic. Missed visits are
// terminal; recovery appends a fresh appointment rather than mutating history.
export type FamilyAppointment = {
  id: string;
  clinic: string;
  offeredSlots: string[];
  scheduledFor?: string;
  status: FamilyAppointmentStatus;
  barriers: FamilyAppointmentBarrier[];
  barriersAsked: boolean;
  reminderAcks: FamilyAppointmentReminderAck[];
  createdAt: string;
};
```

Then extend `FamilyNavigatorState` (two new fields, keep existing order):

```ts
export type FamilyNavigatorState = {
  profile: FamilyProfile | null;
  referral: FamilyReferral | null;
  appointments: FamilyAppointment[];
  safetyEvents: FamilySafetyEvent[];
  // ...rest unchanged
```

- [ ] **Step 2: Create `src/domain/family-appointments.ts`**

```ts
import type { Language } from "@/i18n/strings";
import type {
  DevNeedDomain,
  FamilyAppointment,
  FamilyAppointmentBarrier,
  FamilyReminderOffset
} from "./types";

export const FAMILY_APPOINTMENT_CLINIC = "UK Developmental Pediatrics";

export const REMINDER_OFFSET_DAYS: Record<FamilyReminderOffset, number> = {
  t14: 14,
  t3: 3,
  t1: 1
};

// Demo time-travel targets: inside each reminder window, plus one past the date.
export type FamilyAppointmentCountdownDays = 13 | 2 | 1 | -1;
export const FAMILY_APPOINTMENT_COUNTDOWNS: FamilyAppointmentCountdownDays[] = [13, 2, 1, -1];

// A barrier is a need — it routes into the same domains the navigator already
// matches resources for. That is the no-show mechanism: remove the barrier.
export const BARRIER_DOMAINS: Record<Exclude<FamilyAppointmentBarrier, "none">, DevNeedDomain> = {
  ride: "transportation",
  sibling_care: "respite",
  work_schedule: "parent_support"
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildDemoSlotOffers(now: Date): string[] {
  return [21, 28, 35].map((days) => {
    const slot = new Date(now.valueOf() + days * DAY_MS);
    slot.setHours(9, 30, 0, 0);
    return slot.toISOString();
  });
}

export function createFamilyAppointmentOffer(now: Date): FamilyAppointment {
  return {
    id: crypto.randomUUID(),
    clinic: FAMILY_APPOINTMENT_CLINIC,
    offeredSlots: buildDemoSlotOffers(now),
    status: "offered",
    barriers: [],
    barriersAsked: false,
    reminderAcks: [],
    createdAt: now.toISOString()
  };
}

export function activeFamilyAppointment(
  appointments: FamilyAppointment[]
): FamilyAppointment | undefined {
  return appointments.at(-1);
}

export function daysUntilFamilyAppointment(
  appointment: FamilyAppointment,
  now: Date
): number | null {
  if (appointment.scheduledFor === undefined) {
    return null;
  }
  return (new Date(appointment.scheduledFor).valueOf() - now.valueOf()) / DAY_MS;
}

// The most urgent open, unacknowledged reminder — one turn at a time. Acking
// the urgent one satisfies the wider windows behind it by construction.
export function dueFamilyReminder(
  appointment: FamilyAppointment,
  now: Date
): FamilyReminderOffset | null {
  if (appointment.status !== "booked" && appointment.status !== "confirmed") {
    return null;
  }
  const days = daysUntilFamilyAppointment(appointment, now);
  if (days === null || days < 0) {
    return null;
  }
  const open = (Object.keys(REMINDER_OFFSET_DAYS) as FamilyReminderOffset[]).filter(
    (offset) => days <= REMINDER_OFFSET_DAYS[offset]
  );
  if (open.length === 0) {
    return null;
  }
  const target = open.reduce((soonest, offset) =>
    REMINDER_OFFSET_DAYS[offset] < REMINDER_OFFSET_DAYS[soonest] ? offset : soonest
  );
  return appointment.reminderAcks.some((ack) => ack.offset === target) ? null : target;
}

export function overdueFamilyAppointment(appointment: FamilyAppointment, now: Date): boolean {
  if (appointment.status !== "booked" && appointment.status !== "confirmed") {
    return false;
  }
  const days = daysUntilFamilyAppointment(appointment, now);
  return days !== null && days < 0;
}

export function formatFamilySlot(slotIso: string, language: Language): string {
  return new Date(slotIso).toLocaleString(language === "es" ? "es" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
```

- [ ] **Step 3: Keep the whole tree compiling (safe unconditional backfill)**

Three files construct `FamilyNavigatorState` literals and now fail typecheck. Fix them in this task so the commit leaves master green for other sessions — **unconditional** backfill is safe here because nothing has shipped yet, so no persisted save can contain these fields:

1. `src/state/store.tsx` — `emptyFamilyState` gains the two fields:

```ts
function emptyFamilyState(profile: FamilyProfile | null): FamilyNavigatorState {
  return {
    profile,
    referral: null,
    appointments: [],
    safetyEvents: [],
    // ...rest unchanged
```

2. `src/domain/family-fixtures.ts` — every `FamilyNavigatorState` literal (e.g. `schoolAgeFamilyState`) gains `referral: null,` and `appointments: [],` next to `safetyEvents`.

3. `src/state/storage.ts` — `sanitizeFamilyNavigatorState`'s return gains, for now:

```ts
referral: null,
appointments: [],
```

(Task 4 replaces this with guard-based preservation once the guards exist.) Run `npm run build` and fix any remaining literal the compiler names — there should be none besides these.

- [ ] **Step 3b: Write `src/domain/family-appointments.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  BARRIER_DOMAINS,
  activeFamilyAppointment,
  buildDemoSlotOffers,
  createFamilyAppointmentOffer,
  dueFamilyReminder,
  formatFamilySlot,
  overdueFamilyAppointment
} from "./family-appointments";
import type { FamilyAppointment } from "./types";

const NOW = new Date("2026-07-24T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function bookedAppointment(daysUntil: number, overrides: Partial<FamilyAppointment> = {}): FamilyAppointment {
  return {
    id: "appt-1",
    clinic: "UK Developmental Pediatrics",
    offeredSlots: [],
    scheduledFor: new Date(NOW.valueOf() + daysUntil * DAY_MS).toISOString(),
    status: "booked",
    barriers: [],
    barriersAsked: false,
    reminderAcks: [],
    createdAt: NOW.toISOString(),
    ...overrides
  };
}

describe("buildDemoSlotOffers", () => {
  it("offers three future slots, soonest first", () => {
    const slots = buildDemoSlotOffers(NOW);
    expect(slots).toHaveLength(3);
    const times = slots.map((slot) => new Date(slot).valueOf());
    expect(times[0]).toBeGreaterThan(NOW.valueOf());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("createFamilyAppointmentOffer", () => {
  it("starts offered with no booking, barriers, or acks", () => {
    const offer = createFamilyAppointmentOffer(NOW);
    expect(offer.status).toBe("offered");
    expect(offer.scheduledFor).toBeUndefined();
    expect(offer.barriersAsked).toBe(false);
    expect(offer.reminderAcks).toEqual([]);
  });
});

describe("activeFamilyAppointment", () => {
  it("returns the latest appointment", () => {
    const first = bookedAppointment(5, { id: "a" });
    const second = bookedAppointment(9, { id: "b" });
    expect(activeFamilyAppointment([first, second])?.id).toBe("b");
    expect(activeFamilyAppointment([])).toBeUndefined();
  });
});

describe("dueFamilyReminder", () => {
  it("is quiet outside every window", () => {
    expect(dueFamilyReminder(bookedAppointment(20), NOW)).toBeNull();
  });

  it("walks t14 -> t3 -> t1 as the visit approaches", () => {
    expect(dueFamilyReminder(bookedAppointment(13), NOW)).toBe("t14");
    expect(dueFamilyReminder(bookedAppointment(2), NOW)).toBe("t3");
    expect(dueFamilyReminder(bookedAppointment(0.5), NOW)).toBe("t1");
  });

  it("stays quiet once the current window is acknowledged", () => {
    const acked = bookedAppointment(2, {
      reminderAcks: [{ offset: "t3", acknowledgedAt: NOW.toISOString() }]
    });
    expect(dueFamilyReminder(acked, NOW)).toBeNull();
  });

  it("re-asks in a tighter window even after an earlier ack", () => {
    const acked = bookedAppointment(0.5, {
      status: "confirmed",
      reminderAcks: [{ offset: "t14", acknowledgedAt: NOW.toISOString() }]
    });
    expect(dueFamilyReminder(acked, NOW)).toBe("t1");
  });

  it("never fires for unbooked, past, completed, or missed visits", () => {
    expect(dueFamilyReminder(bookedAppointment(2, { status: "offered", scheduledFor: undefined }), NOW)).toBeNull();
    expect(dueFamilyReminder(bookedAppointment(-1), NOW)).toBeNull();
    expect(dueFamilyReminder(bookedAppointment(2, { status: "completed" }), NOW)).toBeNull();
    expect(dueFamilyReminder(bookedAppointment(2, { status: "missed" }), NOW)).toBeNull();
  });
});

describe("overdueFamilyAppointment", () => {
  it("flags booked or confirmed visits whose date has passed", () => {
    expect(overdueFamilyAppointment(bookedAppointment(-0.5), NOW)).toBe(true);
    expect(overdueFamilyAppointment(bookedAppointment(0.5), NOW)).toBe(false);
    expect(overdueFamilyAppointment(bookedAppointment(-0.5, { status: "missed" }), NOW)).toBe(false);
  });
});

describe("BARRIER_DOMAINS", () => {
  it("maps every real barrier to a matchable need domain", () => {
    expect(BARRIER_DOMAINS.ride).toBe("transportation");
    expect(BARRIER_DOMAINS.sibling_care).toBe("respite");
    expect(BARRIER_DOMAINS.work_schedule).toBe("parent_support");
  });
});

describe("formatFamilySlot", () => {
  it("renders a readable local time in both languages", () => {
    const slot = "2026-08-14T13:30:00.000Z";
    expect(formatFamilySlot(slot, "en")).toMatch(/14/);
    expect(formatFamilySlot(slot, "es").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run tests + build**

```bash
npm run test -- src/domain/family-appointments.test.ts
npm run build
```

Expected: test PASS (all describes green), build succeeds — the Step 3 backfills keep every consumer compiling.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/family-appointments.ts src/domain/family-appointments.test.ts src/domain/family-fixtures.ts src/state/store.tsx src/state/storage.ts
git commit -m "feat: Ladder appointment domain model (referral, reminders, barriers)"
```

---

### Task 4: Reducer actions + persistence

**Files:**
- Modify: `src/state/store.tsx` (action union ~line 103, `emptyFamilyState` ~line 107, reducer family cases ~lines 547–702)
- Modify: `src/state/storage.ts` (guards near `isSavedFamilyResource` ~line 849, `isFamilyNavigatorState` ~line 873, `sanitizeFamilyNavigatorState` ~line 897)
- Test: `src/state/store.test.ts` (extend), `src/state/storage.test.ts` (extend)

**Interfaces:**
- Consumes: Task 3's types and `BARRIER_DOMAINS`.
- Produces (Task 5 dispatches these exact actions):

```ts
| { type: "setFamilyReferral"; referral: FamilyReferral }
| { type: "offerFamilyAppointment"; appointment: FamilyAppointment }
| { type: "bookFamilyAppointment"; appointmentId: string; slot: string; at: string }
| { type: "recordFamilyAppointmentBarriers"; appointmentId: string; barriers: FamilyAppointmentBarrier[]; at: string }
| { type: "acknowledgeFamilyAppointmentReminder"; appointmentId: string; offset: FamilyReminderOffset; at: string }
| { type: "requestFamilyAppointmentReschedule"; appointmentId: string; at: string }
| { type: "completeFamilyAppointment"; appointmentId: string; at: string }
| { type: "missFamilyAppointment"; appointmentId: string; at: string }
| { type: "setFamilyAppointmentCountdown"; appointmentId: string; daysUntil: FamilyAppointmentCountdownDays; now: string }
```

- [ ] **Step 1: Extend the action union in `src/state/store.tsx`**

`emptyFamilyState` already carries `referral`/`appointments` from Task 3. Add the nine action variants above to `HealthAction` (import `FamilyReferral`, `FamilyAppointment`, `FamilyAppointmentBarrier`, `FamilyReminderOffset` from `@/domain/types` and `FamilyAppointmentCountdownDays`, `BARRIER_DOMAINS` from `@/domain/family-appointments`).

- [ ] **Step 2: Add reducer cases**

Add after `toggleFamilyEnrollment`. A shared helper keeps the appointment-map cases small — put it next to `emptyFamilyState`:

```ts
function updateFamilyAppointment(
  state: AppState,
  appointmentId: string,
  update: (appointment: FamilyAppointment) => FamilyAppointment,
  auditMessage: string
): AppState {
  if (!state.family || !state.family.appointments.some(({ id }) => id === appointmentId)) {
    return state;
  }
  return {
    ...state,
    family: {
      ...state.family,
      appointments: state.family.appointments.map((appointment) =>
        appointment.id === appointmentId ? update(appointment) : appointment
      )
    },
    auditEvents: [...state.auditEvents, recordAuditEvent(state.patient.id, "updated", auditMessage)]
  };
}
```

Cases:

```ts
case "setFamilyReferral": {
  const family = state.family ?? emptyFamilyState(null);
  return {
    ...state,
    family: { ...family, referral: action.referral },
    auditEvents: [
      ...state.auditEvents,
      recordAuditEvent(state.patient.id, "created", "Family referral recorded (demo)")
    ]
  };
}
case "offerFamilyAppointment": {
  const family = state.family ?? emptyFamilyState(null);
  return {
    ...state,
    family: { ...family, appointments: [...family.appointments, action.appointment] },
    auditEvents: [
      ...state.auditEvents,
      recordAuditEvent(state.patient.id, "created", "Evaluation slots offered (demo)")
    ]
  };
}
case "bookFamilyAppointment":
  return updateFamilyAppointment(
    state,
    action.appointmentId,
    (appointment) => ({ ...appointment, scheduledFor: action.slot, status: "booked" }),
    "Evaluation visit booked"
  );
case "recordFamilyAppointmentBarriers": {
  const withBarriers = updateFamilyAppointment(
    state,
    action.appointmentId,
    (appointment) => ({ ...appointment, barriers: action.barriers, barriersAsked: true }),
    "Visit barriers recorded"
  );
  if (withBarriers === state || !withBarriers.family) {
    return withBarriers;
  }
  const mappedDomains = action.barriers.flatMap((barrier) =>
    barrier === "none" ? [] : [BARRIER_DOMAINS[barrier]]
  );
  return {
    ...withBarriers,
    family: {
      ...withBarriers.family,
      activeDomains: Array.from(new Set([...withBarriers.family.activeDomains, ...mappedDomains]))
    }
  };
}
case "acknowledgeFamilyAppointmentReminder":
  return updateFamilyAppointment(
    state,
    action.appointmentId,
    (appointment) => ({
      ...appointment,
      status: "confirmed",
      reminderAcks: [...appointment.reminderAcks, { offset: action.offset, acknowledgedAt: action.at }]
    }),
    "Evaluation visit confirmed"
  );
case "requestFamilyAppointmentReschedule":
  return updateFamilyAppointment(
    state,
    action.appointmentId,
    (appointment) => ({ ...appointment, status: "offered", scheduledFor: undefined, reminderAcks: [] }),
    "Evaluation visit reschedule requested"
  );
case "completeFamilyAppointment":
  return updateFamilyAppointment(
    state,
    action.appointmentId,
    (appointment) => ({ ...appointment, status: "completed" }),
    "Evaluation visit completed (self-reported)"
  );
case "missFamilyAppointment":
  return updateFamilyAppointment(
    state,
    action.appointmentId,
    (appointment) => ({ ...appointment, status: "missed" }),
    "Evaluation visit missed (self-reported)"
  );
case "setFamilyAppointmentCountdown":
  return updateFamilyAppointment(
    state,
    action.appointmentId,
    (appointment) =>
      appointment.scheduledFor === undefined
        ? appointment
        : {
            ...appointment,
            scheduledFor: new Date(
              new Date(action.now).valueOf() + action.daysUntil * 24 * 60 * 60 * 1000
            ).toISOString()
          },
    "Demo control: evaluation visit moved"
  );
```

- [ ] **Step 3: Extend storage guards + sanitizer in `src/state/storage.ts`**

Import the new types. Add near the other family guards:

```ts
const familyAppointmentBarriers: FamilyAppointmentBarrier[] = ["ride", "sibling_care", "work_schedule", "none"];
const familyReminderOffsets: FamilyReminderOffset[] = ["t14", "t3", "t1"];
const familyAppointmentStatuses: FamilyAppointment["status"][] = [
  "offered",
  "booked",
  "confirmed",
  "completed",
  "missed"
];

function isFamilyReferral(value: unknown): value is FamilyReferral {
  return isObject(value) && typeof value.clinic === "string" && typeof value.referredAt === "string";
}

function isFamilyAppointment(value: unknown): value is FamilyAppointment {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.clinic === "string" &&
    isArrayOfStrings(value.offeredSlots) &&
    (value.scheduledFor === undefined || typeof value.scheduledFor === "string") &&
    typeof value.status === "string" &&
    familyAppointmentStatuses.some((status) => status === value.status) &&
    Array.isArray(value.barriers) &&
    value.barriers.every((barrier) => familyAppointmentBarriers.some((known) => known === barrier)) &&
    typeof value.barriersAsked === "boolean" &&
    Array.isArray(value.reminderAcks) &&
    value.reminderAcks.every(
      (ack) =>
        isObject(ack) &&
        typeof ack.acknowledgedAt === "string" &&
        familyReminderOffsets.some((offset) => offset === ack.offset)
    ) &&
    typeof value.createdAt === "string"
  );
}
```

In `isFamilyNavigatorState`, add two clauses (optional on purpose — saves written before this feature must still validate, matching the `safetyEvents` comment's discipline):

```ts
(value.referral === undefined || value.referral === null || isFamilyReferral(value.referral)) &&
(value.appointments === undefined || isArrayOfObjects(value.appointments, isFamilyAppointment)) &&
```

In `sanitizeFamilyNavigatorState`'s return, **replace Task 3's unconditional backfill** (`referral: null, appointments: [],`) with guard-based preservation:

```ts
referral: isFamilyReferral(value.referral) ? value.referral : null,
appointments: Array.isArray(value.appointments) ? value.appointments.filter(isFamilyAppointment) : [],
```

- [ ] **Step 4: Extend tests**

Append to `src/state/store.test.ts` — the file already imports `demoState` from `@/domain/fixtures` and `schoolAgeFamilyState` from `@/domain/family-fixtures`; reuse them:

```ts
import { createFamilyAppointmentOffer } from "@/domain/family-appointments";

describe("family appointment actions", () => {
  const NOW = "2026-07-24T12:00:00.000Z";

  function stateWithOffer() {
    const base: AppState = { ...demoState, family: schoolAgeFamilyState };
    const seeded = healthReducer(base, {
      type: "setFamilyReferral",
      referral: { clinic: "UK Developmental Pediatrics", referredAt: NOW }
    });
    const offer = createFamilyAppointmentOffer(new Date(NOW));
    return { state: healthReducer(seeded, { type: "offerFamilyAppointment", appointment: offer }), offer };
  }

  it("seeds a referral and an offer", () => {
    const { state, offer } = stateWithOffer();
    expect(state.family?.referral?.clinic).toBe("UK Developmental Pediatrics");
    expect(state.family?.appointments.at(-1)?.id).toBe(offer.id);
  });

  it("books a slot and confirms via a reminder ack", () => {
    const { state, offer } = stateWithOffer();
    const slot = offer.offeredSlots[0];
    const booked = healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot,
      at: NOW
    });
    expect(booked.family?.appointments.at(-1)?.status).toBe("booked");
    expect(booked.family?.appointments.at(-1)?.scheduledFor).toBe(slot);
    const confirmed = healthReducer(booked, {
      type: "acknowledgeFamilyAppointmentReminder",
      appointmentId: offer.id,
      offset: "t1",
      at: NOW
    });
    expect(confirmed.family?.appointments.at(-1)?.status).toBe("confirmed");
    expect(confirmed.family?.appointments.at(-1)?.reminderAcks).toEqual([
      { offset: "t1", acknowledgedAt: NOW }
    ]);
  });

  it("merges barrier domains into activeDomains without duplicates", () => {
    const { state, offer } = stateWithOffer();
    const withBarrier = healthReducer(state, {
      type: "recordFamilyAppointmentBarriers",
      appointmentId: offer.id,
      barriers: ["ride"],
      at: NOW
    });
    expect(withBarrier.family?.appointments.at(-1)?.barriersAsked).toBe(true);
    expect(withBarrier.family?.activeDomains).toContain("transportation");
    const again = healthReducer(withBarrier, {
      type: "recordFamilyAppointmentBarriers",
      appointmentId: offer.id,
      barriers: ["ride"],
      at: NOW
    });
    const count = again.family?.activeDomains.filter((domain) => domain === "transportation").length;
    expect(count).toBe(1);
  });

  it("reschedule clears the booking; miss + new offer recovers", () => {
    const { state, offer } = stateWithOffer();
    const booked = healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot: offer.offeredSlots[0],
      at: NOW
    });
    const reopened = healthReducer(booked, {
      type: "requestFamilyAppointmentReschedule",
      appointmentId: offer.id,
      at: NOW
    });
    const active = reopened.family?.appointments.at(-1);
    expect(active?.status).toBe("offered");
    expect(active?.scheduledFor).toBeUndefined();
    expect(active?.reminderAcks).toEqual([]);

    const missed = healthReducer(booked, {
      type: "missFamilyAppointment",
      appointmentId: offer.id,
      at: NOW
    });
    const rebooked = healthReducer(missed, {
      type: "offerFamilyAppointment",
      appointment: createFamilyAppointmentOffer(new Date(NOW))
    });
    expect(rebooked.family?.appointments).toHaveLength(2);
    expect(rebooked.family?.appointments.at(-1)?.status).toBe("offered");
  });

  it("countdown moves the scheduled date relative to now", () => {
    const { state, offer } = stateWithOffer();
    const booked = healthReducer(state, {
      type: "bookFamilyAppointment",
      appointmentId: offer.id,
      slot: offer.offeredSlots[0],
      at: NOW
    });
    const moved = healthReducer(booked, {
      type: "setFamilyAppointmentCountdown",
      appointmentId: offer.id,
      daysUntil: 1,
      now: NOW
    });
    expect(moved.family?.appointments.at(-1)?.scheduledFor).toBe("2026-07-25T12:00:00.000Z");
  });
});
```

Adapt `baseState` to whatever the file already names its fixture state (grep the top of the file; reuse its existing helper rather than inventing one).

Append to `src/state/storage.test.ts` — the file already has `validFamily`, `saveStoredState`, `loadStoredState`, and `demoState`. Note: after Task 3, `validFamily` is typed and must itself carry `referral`/`appointments` (add `referral: null, appointments: []` to it — or a populated referral if that reads better in the fixture):

```ts
it("backfills referral and appointments on saves written before Ladder", () => {
  const { referral: _referral, appointments: _appointments, ...legacyFamily } = validFamily;
  saveStoredState({ ...demoState, family: legacyFamily as FamilyNavigatorState });

  const loaded = loadStoredState();
  expect(loaded?.family).not.toBeNull();
  expect(loaded?.family?.referral).toBeNull();
  expect(loaded?.family?.appointments).toEqual([]);
});

it("drops malformed appointments but keeps the family slice", () => {
  saveStoredState({
    ...demoState,
    family: {
      ...validFamily,
      appointments: [{ id: 1 }] as unknown as FamilyNavigatorState["appointments"]
    }
  });

  const loaded = loadStoredState();
  expect(loaded?.family).not.toBeNull();
  expect(loaded?.family?.appointments).toEqual([]);
});
```

If `loadStoredState` in this file returns non-nullable state in its existing tests, drop the `?.` to match its style.

- [ ] **Step 5: Run state tests**

```bash
npm run test -- src/state/store.test.ts src/state/storage.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/store.tsx src/state/storage.ts src/state/store.test.ts src/state/storage.test.ts
git commit -m "feat: Ladder referral + appointment state with persistence backfill"
```

---

### Task 5: Strings + `FamilyAppointmentCard` + wiring

**Files:**
- Modify: `src/i18n/family-strings.ts` (new keys, en + es)
- Create: `src/components/family-appointment-card.tsx`
- Test: `src/components/family-appointment-card.test.tsx`
- Modify: `src/components/family-experience.tsx` (render the card between the interview section and the resources section)

**Interfaces:**
- Consumes: Task 3 helpers, Task 4 actions.
- Produces: `FamilyAppointmentCard({ family, language, locked, onSeedReferral, onBook, onBarriers, onAckReminder, onReschedule, onComplete, onMiss, onRebook, onCountdown })`.

- [ ] **Step 1: Add string keys (en + es)**

Add to the `FamilyStringKey` union and both language objects:

```ts
// en
apptSectionTitle: "Your evaluation visit",
apptSectionIntro: "Ladder walks with you from the waitlist to the visit — booking, getting ready, and solving anything that could get in the way.",
apptJoinDemoBody: "This demo pretends your child is on the UK Developmental Pediatrics waitlist. Nothing here is a real appointment.",
apptJoinDemoCta: "Show me (demo)",
apptOnListLine: "You're on the list at {clinic}.",
apptOfferQuestion: "An evaluation opening is available. Does one of these work?",
apptBookedLine: "Booked for {when}.",
apptPrepTitle: "How to get ready",
apptPrepBullet1: "Bring any school papers, past evaluations, and a list of what you have noticed.",
apptPrepBullet2: "The visit can take a few hours. Your child can bring something that helps them feel calm.",
apptPrepBullet3: "You know your child best. Your answers are a big part of the evaluation.",
apptPrepSource: "Learn more: CDC, \"Learn the Signs. Act Early.\"",
apptBarriersQuestion: "Is there anything that could make it hard to get to this visit?",
apptBarrierRide: "We need a ride",
apptBarrierSiblings: "Someone to watch the other kids",
apptBarrierWork: "Hard to get time off work",
apptBarrierNone: "We're all set",
apptBarriersThanks: "Thanks — the resources below can help with that. Your visit stays booked either way.",
apptBarriersNoneThanks: "Great — we'll remind you as the visit gets close.",
apptReminderT14: "Your visit at {clinic} is in about two weeks — {when}. Still good?",
apptReminderT3: "Your visit is in a few days — {when}. Still good?",
apptReminderT1: "Your visit is tomorrow — {when}. Still good?",
apptReminderConfirm: "Yes, we'll be there",
apptReminderReschedule: "We need a different time",
apptConfirmedLine: "Confirmed. See you {when}.",
apptOverdueQuestion: "Your visit date has passed. Were you able to make it?",
apptOverdueWent: "We made it",
apptOverdueMissed: "We couldn't make it",
apptCompletedLine: "Glad you made it. The clinic will follow up with next steps, and Ladder keeps helping in the meantime.",
apptMissedLine: "Life happens — you have not lost your place. Let's find a new time.",
apptRebookCta: "Find a new time",
apptDemoControlsTitle: "Demo: move the visit closer",
apptDemoTwoWeeks: "About 2 weeks away",
apptDemoFewDays: "A few days away",
apptDemoTomorrow: "Tomorrow",
apptDemoPassed: "Date passed",
apptSafetyHold: "Paused while the safety message above is open.",
```

```ts
// es
apptSectionTitle: "Tu visita de evaluación",
apptSectionIntro: "Ladder te acompaña desde la lista de espera hasta la visita: reservar, prepararte y resolver lo que pueda estorbar.",
apptJoinDemoBody: "Esta demo supone que tu hijo o hija está en la lista de espera de UK Developmental Pediatrics. Nada de esto es una cita real.",
apptJoinDemoCta: "Muéstrame (demo)",
apptOnListLine: "Están en la lista de {clinic}.",
apptOfferQuestion: "Hay un espacio para la evaluación. ¿Te sirve alguno de estos?",
apptBookedLine: "Reservado para {when}.",
apptPrepTitle: "Cómo prepararte",
apptPrepBullet1: "Lleva papeles de la escuela, evaluaciones anteriores y una lista de lo que has notado.",
apptPrepBullet2: "La visita puede durar unas horas. Tu hijo o hija puede llevar algo que le ayude a sentirse en calma.",
apptPrepBullet3: "Tú conoces mejor a tu hijo o hija. Tus respuestas son una parte importante de la evaluación.",
apptPrepSource: "Aprende más: CDC, \"Learn the Signs. Act Early.\" (en inglés)",
apptBarriersQuestion: "¿Hay algo que dificulte llegar a esta visita?",
apptBarrierRide: "Necesitamos transporte",
apptBarrierSiblings: "Alguien que cuide a los otros niños",
apptBarrierWork: "Es difícil pedir permiso en el trabajo",
apptBarrierNone: "Estamos listos",
apptBarriersThanks: "Gracias — los recursos de abajo pueden ayudar con eso. Tu visita sigue reservada de todos modos.",
apptBarriersNoneThanks: "Genial — te recordaremos cuando se acerque la visita.",
apptReminderT14: "Tu visita en {clinic} es en unas dos semanas — {when}. ¿Sigue en pie?",
apptReminderT3: "Tu visita es en unos días — {when}. ¿Sigue en pie?",
apptReminderT1: "Tu visita es mañana — {when}. ¿Sigue en pie?",
apptReminderConfirm: "Sí, ahí estaremos",
apptReminderReschedule: "Necesitamos otro horario",
apptConfirmedLine: "Confirmado. Nos vemos {when}.",
apptOverdueQuestion: "La fecha de tu visita ya pasó. ¿Pudieron ir?",
apptOverdueWent: "Sí fuimos",
apptOverdueMissed: "No pudimos ir",
apptCompletedLine: "Qué bueno que fueron. La clínica les dará los próximos pasos, y Ladder sigue ayudando mientras tanto.",
apptMissedLine: "Así es la vida — no perdieron su lugar. Busquemos una nueva fecha.",
apptRebookCta: "Buscar nueva fecha",
apptDemoControlsTitle: "Demo: acerca la visita",
apptDemoTwoWeeks: "A unas 2 semanas",
apptDemoFewDays: "A unos días",
apptDemoTomorrow: "Mañana",
apptDemoPassed: "La fecha pasó",
apptSafetyHold: "En pausa mientras el mensaje de seguridad de arriba esté abierto.",
```

`tFamily` already substitutes `{slot}`-style params (`{count}`, `{year}` precedents) — confirm its slot-replacement helper covers `{clinic}` / `{when}` (it is generic key→value replacement; no change expected).

**Prep-source link:** primary URL `https://www.cdc.gov/ncbddd/actearly/concerned.html`. CDC restructured some paths in 2024–25 — verify it returns 200 (curl or browser); if it 404s, use `https://www.cdc.gov/act-early/` and record the substitution in the commit body. This matches the catalog's verify-at-seed-time discipline.

- [ ] **Step 2: Create `src/components/family-appointment-card.tsx`**

```tsx
"use client";

import React, { useState } from "react";
import {
  FAMILY_APPOINTMENT_COUNTDOWNS,
  activeFamilyAppointment,
  dueFamilyReminder,
  formatFamilySlot,
  overdueFamilyAppointment,
  type FamilyAppointmentCountdownDays
} from "@/domain/family-appointments";
import type {
  FamilyAppointment,
  FamilyAppointmentBarrier,
  FamilyNavigatorState,
  FamilyReminderOffset
} from "@/domain/types";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

const PREP_SOURCE_URL = "https://www.cdc.gov/ncbddd/actearly/concerned.html";

const REMINDER_KEYS: Record<FamilyReminderOffset, FamilyStringKey> = {
  t14: "apptReminderT14",
  t3: "apptReminderT3",
  t1: "apptReminderT1"
};

const BARRIER_OPTIONS: ReadonlyArray<{ value: FamilyAppointmentBarrier; key: FamilyStringKey }> = [
  { value: "ride", key: "apptBarrierRide" },
  { value: "sibling_care", key: "apptBarrierSiblings" },
  { value: "work_schedule", key: "apptBarrierWork" },
  { value: "none", key: "apptBarrierNone" }
];

const COUNTDOWN_KEYS: Record<FamilyAppointmentCountdownDays, FamilyStringKey> = {
  13: "apptDemoTwoWeeks",
  2: "apptDemoFewDays",
  1: "apptDemoTomorrow",
  [-1]: "apptDemoPassed"
};

function ladderTurn(children: React.ReactNode, key?: string): React.ReactElement {
  return (
    <div key={key} className="mr-auto max-w-[90%] rounded-control border border-ink/10 bg-white p-3">
      {children}
    </div>
  );
}

export function FamilyAppointmentCard({
  family,
  language,
  locked,
  onSeedReferral,
  onBook,
  onBarriers,
  onAckReminder,
  onReschedule,
  onComplete,
  onMiss,
  onRebook,
  onCountdown
}: {
  family: FamilyNavigatorState;
  language: Language;
  locked: boolean;
  onSeedReferral: () => void;
  onBook: (appointmentId: string, slot: string) => void;
  onBarriers: (appointmentId: string, barriers: FamilyAppointmentBarrier[]) => void;
  onAckReminder: (appointmentId: string, offset: FamilyReminderOffset) => void;
  onReschedule: (appointmentId: string) => void;
  onComplete: (appointmentId: string) => void;
  onMiss: (appointmentId: string) => void;
  onRebook: () => void;
  onCountdown: (appointmentId: string, daysUntil: FamilyAppointmentCountdownDays) => void;
}) {
  const [demoControlOpen, setDemoControlOpen] = useState(false);
  const now = new Date();
  const appointment = activeFamilyAppointment(family.appointments);
  const reminder = appointment ? dueFamilyReminder(appointment, now) : null;
  const overdue = appointment ? overdueFamilyAppointment(appointment, now) : false;

  const primaryButton = `min-h-12 min-w-0 break-words rounded-control bg-care px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`;
  const secondaryButton = `min-h-12 min-w-0 break-words rounded-control border border-care/30 bg-care/5 px-4 py-2 text-left font-semibold text-care disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`;

  function bookedBody(active: FamilyAppointment): React.ReactNode {
    const when = active.scheduledFor ? formatFamilySlot(active.scheduledFor, language) : "";
    return (
      <>
        {ladderTurn(
          <p className="break-words font-semibold">
            {tFamily(language, active.status === "confirmed" ? "apptConfirmedLine" : "apptBookedLine", { when })}
          </p>,
          "booked-line"
        )}
        {ladderTurn(
          <div>
            <p className="break-words font-semibold">{tFamily(language, "apptPrepTitle")}</p>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm leading-6 text-ink/80">
              <li>{tFamily(language, "apptPrepBullet1")}</li>
              <li>{tFamily(language, "apptPrepBullet2")}</li>
              <li>{tFamily(language, "apptPrepBullet3")}</li>
            </ul>
            <a
              href={PREP_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className={`mt-2 inline-flex min-h-12 items-center text-sm font-semibold text-care underline ${CONTROL_FOCUS}`}
            >
              {tFamily(language, "apptPrepSource")}
            </a>
          </div>,
          "prep"
        )}
        {!active.barriersAsked ? (
          ladderTurn(
            <div>
              <p className="break-words font-semibold">{tFamily(language, "apptBarriersQuestion")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {BARRIER_OPTIONS.map(({ value, key }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={locked}
                    onClick={() => onBarriers(active.id, [value])}
                    className={secondaryButton}
                  >
                    {tFamily(language, key)}
                  </button>
                ))}
              </div>
            </div>,
            "barriers-ask"
          )
        ) : (
          <p className="ml-auto max-w-[90%] rounded-control bg-care/10 p-3 text-sm leading-6">
            {tFamily(
              language,
              active.barriers.every((barrier) => barrier === "none")
                ? "apptBarriersNoneThanks"
                : "apptBarriersThanks"
            )}
          </p>
        )}
        {active.barriersAsked && reminder ? (
          ladderTurn(
            <div data-testid="family-appt-reminder">
              <p className="break-words font-semibold">
                {tFamily(language, REMINDER_KEYS[reminder], { clinic: active.clinic, when })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onAckReminder(active.id, reminder)}
                  className={primaryButton}
                >
                  {tFamily(language, "apptReminderConfirm")}
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onReschedule(active.id)}
                  className={secondaryButton}
                >
                  {tFamily(language, "apptReminderReschedule")}
                </button>
              </div>
            </div>,
            "reminder"
          )
        ) : null}
        {active.barriersAsked && overdue ? (
          ladderTurn(
            <div data-testid="family-appt-overdue">
              <p className="break-words font-semibold">{tFamily(language, "apptOverdueQuestion")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={locked} onClick={() => onComplete(active.id)} className={primaryButton}>
                  {tFamily(language, "apptOverdueWent")}
                </button>
                <button type="button" disabled={locked} onClick={() => onMiss(active.id)} className={secondaryButton}>
                  {tFamily(language, "apptOverdueMissed")}
                </button>
              </div>
            </div>,
            "overdue"
          )
        ) : null}
        {active.scheduledFor !== undefined && !overdue ? (
          <div className="border-t border-care/10 pt-3">
            <button
              type="button"
              aria-expanded={demoControlOpen}
              aria-controls="family-appt-demo-panel"
              onClick={() => setDemoControlOpen((current) => !current)}
              className={`min-h-12 w-full min-w-0 rounded-control text-left text-sm font-semibold text-ink/70 ${CONTROL_FOCUS}`}
            >
              {tFamily(language, "apptDemoControlsTitle")}
            </button>
            {demoControlOpen ? (
              <fieldset id="family-appt-demo-panel" className="mt-2 flex flex-wrap gap-2 rounded-control border border-care/20 bg-calm/40 p-3">
                {FAMILY_APPOINTMENT_COUNTDOWNS.map((daysUntil) => (
                  <button
                    key={daysUntil}
                    type="button"
                    disabled={locked}
                    onClick={() => onCountdown(active.id, daysUntil)}
                    className={secondaryButton}
                  >
                    {tFamily(language, COUNTDOWN_KEYS[daysUntil])}
                  </button>
                ))}
              </fieldset>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  let body: React.ReactNode;
  if (family.referral === null) {
    body = ladderTurn(
      <div>
        <p className="break-words text-sm leading-6 text-ink/75">{tFamily(language, "apptJoinDemoBody")}</p>
        <button type="button" disabled={locked} onClick={onSeedReferral} className={`mt-3 ${primaryButton}`}>
          {tFamily(language, "apptJoinDemoCta")}
        </button>
      </div>,
      "seed"
    );
  } else if (!appointment || appointment.status === "missed") {
    body = (
      <>
        {appointment?.status === "missed"
          ? ladderTurn(<p className="break-words font-semibold">{tFamily(language, "apptMissedLine")}</p>, "missed")
          : null}
        {ladderTurn(
          <button type="button" disabled={locked} onClick={onRebook} className={primaryButton}>
            {tFamily(language, "apptRebookCta")}
          </button>,
          "rebook"
        )}
      </>
    );
  } else if (appointment.status === "offered") {
    body = ladderTurn(
      <div>
        <p className="break-words text-sm leading-6 text-ink/75">
          {tFamily(language, "apptOnListLine", { clinic: appointment.clinic })}
        </p>
        <p className="mt-1 break-words font-semibold">{tFamily(language, "apptOfferQuestion")}</p>
        <div className="mt-3 grid gap-2">
          {appointment.offeredSlots.map((slot) => (
            <button
              key={slot}
              type="button"
              disabled={locked}
              onClick={() => onBook(appointment.id, slot)}
              className={secondaryButton}
            >
              {formatFamilySlot(slot, language)}
            </button>
          ))}
        </div>
      </div>,
      "offer"
    );
  } else if (appointment.status === "completed") {
    body = ladderTurn(
      <p className="break-words font-semibold">{tFamily(language, "apptCompletedLine")}</p>,
      "completed"
    );
  } else {
    body = bookedBody(appointment);
  }

  return (
    <section
      data-testid="family-appointment-card"
      aria-labelledby="family-appt-title"
      className="rounded-control border border-care/20 bg-white p-4"
    >
      <h2 id="family-appt-title" className="text-xl font-semibold">
        {tFamily(language, "apptSectionTitle")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-ink/75">{tFamily(language, "apptSectionIntro")}</p>
      {locked ? (
        <p className="mt-2 rounded-control bg-note/30 p-3 text-sm font-medium">
          {tFamily(language, "apptSafetyHold")}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">{body}</div>
    </section>
  );
}
```

- [ ] **Step 3: Wire into `family-experience.tsx`**

Imports:

```ts
import { FamilyAppointmentCard } from "@/components/family-appointment-card";
import {
  createFamilyAppointmentOffer,
  FAMILY_APPOINTMENT_CLINIC,
  type FamilyAppointmentCountdownDays
} from "@/domain/family-appointments";
import type { FamilyAppointmentBarrier, FamilyReminderOffset } from "@/domain/types";
```

Render between the interview `</section>` (after the needs-screen disclosure block closes, line ~714) and the resources section:

```tsx
{family?.profile ? (
  <FamilyAppointmentCard
    family={family}
    language={language}
    locked={pendingSafetyEvent !== undefined}
    onSeedReferral={() => {
      const now = new Date();
      dispatch({
        type: "setFamilyReferral",
        referral: { clinic: FAMILY_APPOINTMENT_CLINIC, referredAt: now.toISOString() }
      });
      dispatch({ type: "offerFamilyAppointment", appointment: createFamilyAppointmentOffer(now) });
    }}
    onBook={(appointmentId, slot) =>
      dispatch({ type: "bookFamilyAppointment", appointmentId, slot, at: new Date().toISOString() })
    }
    onBarriers={(appointmentId, barriers) =>
      dispatch({
        type: "recordFamilyAppointmentBarriers",
        appointmentId,
        barriers,
        at: new Date().toISOString()
      })
    }
    onAckReminder={(appointmentId, offset) =>
      dispatch({
        type: "acknowledgeFamilyAppointmentReminder",
        appointmentId,
        offset,
        at: new Date().toISOString()
      })
    }
    onReschedule={(appointmentId) =>
      dispatch({ type: "requestFamilyAppointmentReschedule", appointmentId, at: new Date().toISOString() })
    }
    onComplete={(appointmentId) =>
      dispatch({ type: "completeFamilyAppointment", appointmentId, at: new Date().toISOString() })
    }
    onMiss={(appointmentId) =>
      dispatch({ type: "missFamilyAppointment", appointmentId, at: new Date().toISOString() })
    }
    onRebook={() =>
      dispatch({ type: "offerFamilyAppointment", appointment: createFamilyAppointmentOffer(new Date()) })
    }
    onCountdown={(appointmentId, daysUntil) =>
      dispatch({
        type: "setFamilyAppointmentCountdown",
        appointmentId,
        daysUntil,
        now: new Date().toISOString()
      })
    }
  />
) : null}
```

Type the two callback params explicitly where TS can't infer (`daysUntil: FamilyAppointmentCountdownDays`, `barriers: FamilyAppointmentBarrier[]`, `offset: FamilyReminderOffset`) if inference complains.

- [ ] **Step 4: Component tests `src/components/family-appointment-card.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FamilyAppointmentCard } from "./family-appointment-card";
import { createFamilyAppointmentOffer } from "@/domain/family-appointments";
import type { FamilyAppointment, FamilyNavigatorState } from "@/domain/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function familyState(overrides: Partial<FamilyNavigatorState>): FamilyNavigatorState {
  return {
    profile: {
      birthYear: 2019,
      schoolStage: "elementary",
      county: "Scott",
      diagnoses: []
    },
    referral: { clinic: "UK Developmental Pediatrics", referredAt: new Date().toISOString() },
    appointments: [],
    safetyEvents: [],
    recommendations: null,
    interviewDraft: "",
    screenAnswers: [],
    interviews: [],
    facts: [],
    latestInterviewDomains: [],
    activeDomains: [],
    saved: [],
    alreadyEnrolled: [],
    ...overrides
  };
}

const noHandlers = {
  onSeedReferral: vi.fn(),
  onBook: vi.fn(),
  onBarriers: vi.fn(),
  onAckReminder: vi.fn(),
  onReschedule: vi.fn(),
  onComplete: vi.fn(),
  onMiss: vi.fn(),
  onRebook: vi.fn(),
  onCountdown: vi.fn()
};

describe("FamilyAppointmentCard", () => {
  it("offers the demo seed before a referral exists", async () => {
    const onSeedReferral = vi.fn();
    render(
      <FamilyAppointmentCard
        family={familyState({ referral: null })}
        language="en"
        locked={false}
        {...noHandlers}
        onSeedReferral={onSeedReferral}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Show me (demo)" }));
    expect(onSeedReferral).toHaveBeenCalledOnce();
  });

  it("books a slot from the offer turn", async () => {
    const offer = createFamilyAppointmentOffer(new Date());
    const onBook = vi.fn();
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [offer] })}
        language="en"
        locked={false}
        {...noHandlers}
        onBook={onBook}
      />
    );
    const slotButtons = screen.getAllByRole("button");
    await userEvent.click(slotButtons[0]);
    expect(onBook).toHaveBeenCalledWith(offer.id, offer.offeredSlots[0]);
  });

  it("asks barriers once booked and shows the t1 reminder after they are answered", () => {
    const booked: FamilyAppointment = {
      ...createFamilyAppointmentOffer(new Date()),
      status: "booked",
      scheduledFor: new Date(Date.now() + 0.5 * DAY_MS).toISOString(),
      barriersAsked: true,
      barriers: ["ride"]
    };
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [booked] })}
        language="en"
        locked={false}
        {...noHandlers}
      />
    );
    expect(screen.getByTestId("family-appt-reminder")).toHaveTextContent("tomorrow");
  });

  it("locks every action while a safety event is pending", () => {
    const offer = createFamilyAppointmentOffer(new Date());
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [offer] })}
        language="en"
        locked={true}
        {...noHandlers}
      />
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("renders the missed-recovery turn in Spanish", () => {
    const missed: FamilyAppointment = { ...createFamilyAppointmentOffer(new Date()), status: "missed" };
    render(
      <FamilyAppointmentCard
        family={familyState({ appointments: [missed] })}
        language="es"
        locked={false}
        {...noHandlers}
      />
    );
    expect(screen.getByText("Así es la vida — no perdieron su lugar. Busquemos una nueva fecha.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Buscar nueva fecha" })).toBeVisible();
  });
});
```

- [ ] **Step 5: Run component + full unit suite**

```bash
npm run test -- src/components/family-appointment-card.test.tsx
npm run test
```

Expected: PASS, no regressions elsewhere.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/family-strings.ts src/components/family-appointment-card.tsx src/components/family-appointment-card.test.tsx src/components/family-experience.tsx
git commit -m "feat: Ladder evaluation-visit loop (booking, barriers, reminders, recovery)"
```

---

### Task 6: E2E journey, gates, docs

**Files:**
- Modify: `e2e/family-navigator.spec.ts` (one new journey test)
- Modify: `docs/specs/09-family-navigator.md` (short addendum at top)

**Interfaces:**
- Consumes: everything above; the journey uses the spec's existing `useFreshStorage`, `stubUnconfiguredFamilyInterview`, and basics-form helpers.

- [ ] **Step 1: Add the appointment journey e2e**

Append (reusing the file's existing helpers — follow how the existing journeys build a profile through the basics form with `openBasics`/fill helpers, Scott county, then continue):

The file's `test.beforeEach` already gives every test fresh storage **and a frozen clock** (`page.clock.setFixedTime(FROZEN_NOW)`), which is what makes the countdown → reminder sequence deterministic: the component's `new Date()` is always `FROZEN_NOW`, so "Tomorrow" lands exactly inside the t1 window.

```ts
test("ladder walks a family from waitlist to a confirmed evaluation visit", async ({ page }) => {
  await stubUnconfiguredFamilyInterview(page);
  await page.goto("/ladder");

  await fillBasics(page, { county: "Scott", birthYear: "2019", schoolStage: "elementary" });

  const card = page.getByTestId("family-appointment-card");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Show me (demo)" }).click();

  // Book the first offered slot
  await card.getByRole("button").filter({ hasText: /,/ }).first().click();
  await expect(card.getByText(/Booked for/)).toBeVisible();
  await expect(card.getByText("How to get ready")).toBeVisible();

  // Barriers: need a ride -> honest thanks + visit stays booked
  await card.getByRole("button", { name: "We need a ride" }).click();
  await expect(card.getByText(/resources below can help/)).toBeVisible();

  // Demo time-travel to tomorrow -> t1 reminder -> confirm
  await card.getByRole("button", { name: "Demo: move the visit closer" }).click();
  await card.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.getByTestId("family-appt-reminder")).toContainText("tomorrow");
  await page.getByRole("button", { name: "Yes, we'll be there" }).click();
  await expect(card.getByText(/Confirmed/)).toBeVisible();

  // Past the date -> honest close-out. The demo panel is a toggle and is still
  // open from the click above — do NOT click the disclosure again here.
  await card.getByRole("button", { name: "Date passed" }).click();
  await page.getByRole("button", { name: "We made it" }).click();
  await expect(card.getByText(/Glad you made it/)).toBeVisible();
});
```

The slot-button locator (`hasText: /,/`) matches the formatted date ("Fri, Aug 14, 9:30 AM"); if the existing helpers give a cleaner pattern, prefer theirs. If the reminder turn requires the demo panel to reopen after re-render, adjust with a fresh `getByRole` query rather than a stored locator.

- [ ] **Step 2: Spec addendum**

At the top of `docs/specs/09-family-navigator.md`, under the title blockquote, add:

```markdown
> **2026-07-24 — UKHCI Ladder:** the navigator's user-facing brand is now **UKHCI Ladder**, served at `/ladder` (`/family` permanently redirects). First waitlist-product slice landed: referral anchor + evaluation-visit loop (slot booking, fixed-choice barriers check routed into need domains, T-14/T-3/T-1 reminder ladder with demo time-travel, missed-visit recovery). Plan: `docs/plans/14-ukhci-ladder.md`. Deferred, in order: wait-status card, monthly check-ins + experience pulse, interim home-activity content, clinic impact dashboard.
```

- [ ] **Step 3: Full verification**

```bash
npm run check
npm run crisis:gate
npm run navigator:gate
npm run test:e2e -- family-navigator.spec.ts
```

Expected: all green. `crisis:gate` and `navigator:gate` must pass **unchanged** — this work adds no free-text surface, so any gate movement means something leaked; stop and investigate rather than adjusting the gate.

- [ ] **Step 4: Commit**

```bash
git add e2e/family-navigator.spec.ts docs/specs/09-family-navigator.md
git commit -m "test: Ladder appointment-loop e2e journey + spec addendum"
```

---

## Post-plan notes (not tasks)

- **Deploy** is a separate, user-triggered step (`/ship-phase` or `vercel --prod`); the live site's `/family` links keep working via the redirect once deployed.
- **Memory updates** (family-navigator-spec.md, ai-navigation-chat-first.md route references) happen at ship time, not during this plan.
- **Deferred Ladder slices** (design already agreed, in priority order): wait-status card with honest windows → monthly check-ins + 1-question experience pulse → verified home-activity content → clinic-facing impact dashboard computing the 50% engagement / 25% no-show / experience metrics from a seeded cohort.
