# Fable leverage program — dev-time hardening and build

**Status:** draft
**Date:** 2026-08-03
**Source:** 2026-08-03 assessment of where Claude Fable 5 helps this codebase (dev-time yes, runtime no)

## Purpose

Use Claude Fable 5 as the model that hardens and extends this app — not as a model inside it. Five independently executable workstreams, each with its own acceptance gate: adversarially expand the crisis corpus (A), audit spec↔code coherence (B), audit gate-ladder parity across the LLM routes (C), execute the voice-first plan (D), and build an offline vision oracle for screening extraction (E, stretch).

Runtime integration is explicitly out of scope: the app's routes run OpenAI via raw `fetch`, the per-route economics (320-token coach replies, per-message classification, a 15s rank timeout) want cheap fast models, and Fable requires 30-day data retention — unusable on any path that might ever need zero data retention for patient data.

The motivating precedent for A: the 2026-07-25 waitlist-companion adversarial review caught a regression watch firing on *gains* — printing "possible loss of skills" into the clinician packet — and the miss traced to a gap in the hand-maintained trap list. The trap list is the weakest link of every deterministic gate in this repo; Fable's documented strength is generating the case the list's author didn't think of.

## Contract

### A. Crisis-gate adversarial corpus expansion

**Goal:** produce new corpus entries that the current detector misclassifies, so the corpus's `recall = 1.00, false positives = 0` assertion means more than "passes its own list."

- Baseline first: `npm run crisis:gate` green before any generation.
- The agent reads `src/domain/crisis-red-flags.ts` and `src/domain/crisis-red-flags.corpus.ts`, then generates candidate cases in both directions: plain-language crisis phrasings the detector misses (false negatives) and benign phrasings that trip it (false positives, the waitlist-companion failure class). Candidates must cover every escalation category the corpus already has (self-harm, acute vision symptoms, and the rest), not only mental-health phrasing.
- Every candidate is run through the detector before it is reported; only cases that actually break the current implementation are surfaced.
- **Human adjudication is mandatory.** The model proposes; the owner labels each surviving candidate as (a) real miss → corpus entry + detector fix, or (b) not a legitimate corpus case → discard with a one-line reason. No auto-committed corpus changes. This is a clinical safety gate.
- Prompt framing states the defensive context (red-teaming a crisis detector in a patient-facing app). Fable's API classifiers target cyber/bio, not this; if a refusal occurs anyway, rerun the workstream on Opus — do not water down the generation goal to route around it.
- **Accept:** ≥25 net-new adjudicated corpus cases; detector fixed for every accepted false negative and false positive; `npm run crisis:gate` green (the script's dated report under `docs/ops/red-team-results/` is the artifact); `npm run check` green.

### B. Spec↔code coherence audit

**Goal:** one pass over specs 01–16 and their plans answering: which spec'd behavior was silently dropped, which code contradicts its spec, which docs are stale relative to the tree.

- Report-only. No code or doc edits in this pass; findings feed later fixes the owner picks.
- Output: `docs/qa/<date>-spec-coherence.md` — per-spec verdict (clean / drifted / stale-doc) with `file:line` evidence for every non-clean claim. Zero-finding specs are listed too, so absence of a finding is a checked claim rather than an unread spec.
- The report distinguishes **in-tree** from **deployed** for user-facing claims: prod and master have diverged before (waitlist companion built but undeployed; push does not deploy this repo). A spec whose feature is on master but not live is "built, undeployed," not "drifted."
- **Accept:** all 16 specs covered with verdicts; findings ranked by severity; report committed.

### C. Gate-ladder parity audit across LLM routes

**Goal:** the seven LLM routes were built by cloning one gate ladder; verify the clones haven't rotted.

- Routes in scope: `api/coach/text`, `api/route/classify`, `api/food/vision`, `api/screening/extract`, `api/family/interview`, `api/family/recommend`, `api/realtime/token`.
- Extract each route's actual ladder — order and behavior of: crisis/`crisisOpen` handling, provider+key gate, `DEMO_PASSCODE` gate, body validation and clamps, timeout, off-shape reply handling, response envelope, safety-identifier header — and diff against the canonical ladder (the family interview route is the stated reference; realtime/token's documented ladder is `crisisOpen-409 → provider → key → passcode`).
- Every divergence is classified **intentional** (documented in the matrix with why) or **drift** (fixed). Fixes are drift-only, path-scoped commits, with route tests extended to pin the fixed behavior.
- **Accept:** parity matrix committed to `docs/qa/`; every drift fix has a test; `npm run check` and `npm run crisis:gate` green.

### D. Voice-first verification and gap closure (spec 12)

> **Re-scoped 2026-08-04 by workstream B.** This section originally read "execute the already-designed P0–P7 voice build." That premise was wrong: **P0–P6 are built and wired**, and the stale `food-lens-demo.md` cleanup item inside P6 is already done. Per-phase evidence is in [the coherence report](../qa/2026-08-04-spec-coherence.md) → Finding 1. There is no build to execute.

**Goal:** confirm the built voice surfaces hold end to end, and close the one item spec 12 leaves genuinely open.

- **The real open item is the real-phone hardware pass** that spec 12 P5 marks pending. It needs a device (Android Galaxy S25 / Chrome per `docs/food-lens-demo.md`), not a code change, and no agent can close it.
- Everything else here is verification, not construction: run the typed-simulation corpus through every voice path, confirm output-transcript gating on `/chat` and `/food`, and confirm read-aloud only ever speaks pre-authored or grounding-verified text.
- The locked decisions in `docs/handoffs/12-voice-everywhere.md` remain **hard constraints** for any change made here: code-default realtime model stays `gpt-realtime-2` (cheaper model is env opt-in only, after the owner verifies the id); voice stays `marin`; output-transcript gating with no jitter-buffer delay.
- Verification: `npm run check`, `npm run crisis:gate`, `npm run test:e2e`. Known non-bug: e2e kills the preview server's `.next` — restart the preview, don't debug it.
- **Accept:** the three commands green, a dated voice-path verification note in `docs/qa/`, and the hardware pass either done or explicitly recorded as still-open with the reason.

### E. Vision oracle for screening extraction (stretch)

**Goal:** a small offline harness that grades `/api/screening/extract` (gpt-4o-mini) against Fable-generated gold labels.

- Gated on having ≥10 synthetic or demo screening-report images. **No patient data, ever** — required by principle and by Fable's 30-day retention floor.
- Harness: image set → Fable labels each (crop/inspect tool use allowed; its degraded-image handling is the point) → gold JSON per image → run the same images through the extract route's provider → agreement report (per-field match rate, disagreements listed).
- Offline only. Not a runtime path, not a fallback provider.
- **Accept:** harness script committed; agreement report in `docs/qa/`; disagreements adjudicated as extract-bug vs oracle-error.

### Cross-cutting guardrails

- **No PHI in any Fable-visible input.** Source code, specs, and synthetic text/images only. This is what makes the retention requirement a non-issue for A–E.
- **Refusal fallback:** any workstream that hits `refusal` reruns on Opus rather than weakening its goal.
- **Cost scoping:** input is cheap; long autonomous output at $50/MTok is where cost lives. Rough per-run order of magnitude — A: $5–15, B: $10–30, C: $3–10, D: $5–15 (verification only, since the build already exists), E: $5–15. Scope each run to its acceptance gate; no open-ended overnight runs without a stated budget.
- **Repo rules:** no worktrees; path-scoped commits per workstream; no push and no deploy from any workstream — both remain owner actions.
- **Security carve-out:** Fable's bug-finding gains exclude security-focused analysis (cyber classifiers). Auth/secrets review stays with `/security-review` and standard models; A–C target clinical/product logic, not exploitability.

## Sequencing

A → C → B → D, with E whenever an image set exists. A is the highest-value safety work and is self-contained. C is small and sharpens the routes D touches. B must run before D because it is what establishes what D actually has left to do — as it turned out, almost nothing. Each workstream is independently executable; reordering is an owner call, not a dependency violation.

**Executed 2026-08-04:** A (report, awaiting adjudication), C (six drift fixes landed), and B (report) are complete. B re-scoped D. E remains blocked on an image set.

## Non-goals

- No Anthropic SDK, Fable, or any Claude model in app runtime code or `package.json`.
- No provider migration of the existing OpenAI routes.
- No corpus or detector change without human adjudication (A).
- No code changes from the audit passes beyond classified drift fixes (C) — B is report-only.
- No deploy, no push, no flag flips from any workstream.
- No use of real patient data or PHI in any prompt, image, or artifact.

## Plan mapping

Companion execution plan, when written: `docs/plans/16-fable-leverage-program.md`. A–C were each run as a single scoped agent session without a plan, which is the right shape for them. D no longer needs a plan either — it is a verification pass plus one hardware task the owner has to perform.

Artifacts produced 2026-08-04:

- A — [crisis adversarial candidates](../qa/2026-08-04-crisis-adversarial-candidates.md) (39 verified breaks, awaiting adjudication)
- B — [spec coherence report](../qa/2026-08-04-spec-coherence.md) (16 verdicts, 4 findings)
- C — [LLM route gate parity matrix](../qa/2026-08-04-llm-route-gate-parity.md) (6 drifts fixed, 7 intentional)
