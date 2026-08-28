# Patient centered (Ladder / Food Lens) — project rules

## Product direction
- Synthesize patient responses holistically as free text. Do not force responses into the fixed label set or render checklist-style summaries — that model was explicitly rejected.
- Fast unsafe action must always score worse than deliberate, appropriately escalated care. Never invert that in scoring or copy.

## Demo posture
- The blank/default state must be truly blank. No stale demo fixtures leaking into a fresh session (no pre-populated counties, patients, or ages the user never entered).
- Demo data that IS shown should look real and production-grade; no "synthetic" or "demo" labels on user-facing surfaces.
- Features that depend on an API key (voice, LLM calls) must fail visibly with a clear message when the key is missing — never render a button that silently does nothing.

## UI rules
- As few words as possible. No walls of text. Resources and answers first, questions second.
- Prefer one continuous screen; expand content in place rather than navigating to new screens.
- Fight complexity accretion; look for surfaces to merge or delete when adding anything.

## Writing voice (all user-facing copy)
- Plain human voice ("Tama voice"). No em dashes. No "It's not X, it's Y" constructions. No self-explaining meta-language ("This section covers…"). It must not read like LinkedIn ad copy or AI-structured prose.

## Verification of UI work
- After any UI change: `npm run dev` (or `npm run dev:https` when the feature needs it), open the changed route, and visually confirm — including that the blank state is blank — before claiming done.

## Git
- At the end of a completed work unit, commit and push to `master` without being asked. This project rule intentionally overrides the global "don't push unless I ask". Conventional-ish messages.
- Destructive git (force-push, hard reset, branch deletion) remains user-only.

## Concurrent sessions
- Multiple Claude sessions may edit this tree at once. Commit early and path-scoped: `git commit -- <paths>`.
- Never `git reset --hard` or `git checkout --` over uncommitted changes you did not make; stash instead.
- Before overwriting a file you edited earlier in the session, re-read it; the tree may have moved.
