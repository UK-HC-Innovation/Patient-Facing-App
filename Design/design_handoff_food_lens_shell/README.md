# Handoff: Food Lens shell rebuild (scroll surface + visibility gate)

## Overview
Replace the nine-card stack on `/food` and `/compass` with one vertical scroll surface, and gate the vision loop on whether the viewfinder is actually on screen. This re-ranks and re-hosts existing feature blocks; it does not re-compute anything. Target codebase: the **Patient centered** Next.js app (`src/app/food/page.tsx`, `src/hooks/use-live-food-score.ts`, `src/i18n/strings.ts`, `e2e/food-lens.spec.ts`, `e2e/compass.spec.ts`).

## About the design files
The `.dc.html` files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code. Recreate them in the target codebase's existing React/Next.js + Tailwind environment using its established patterns (the live-score hook, the strings dictionaries, the existing block components). Open each `.dc.html` directly in a browser to view it (keep `support.js` and `doc-page.js` beside them).

**Read `Food Lens build spec.dc.html` first — it is the implementation contract.** Sections: 1 scope · 2 shell geometry · 3 visibility gate · 4 block slots · 5 capability props · 6 correctness rules · 7 edge states · 8 strings · 9 open decisions · 10 acceptance criteria · 11 telemetry · 12 accessibility · 13 wide viewports · 14 known cost.

## Fidelity
**High-fidelity.** `Food Lens prototype v2 scroll.dc.html` is the working reference for layout, spacing, color, and the gate's feel (it simulates the pause/resume loop with live counters). `Food Lens redesign.dc.html` holds the earlier explorations (turns 4a/5a/6a) — context, not the target. `Food Lens prototype.dc.html` (v1) holds the draft strings, grouped by area (spec §8). Recreate pixel-precisely but with the codebase's existing components wherever a block already ships — every spec-24 block moves as-is into a named slot, unmodified.

## Screens / regions
One scroll container (phone frame 390×844), four regions top to bottom:

1. **Viewfinder** — 336px tall, scrolls away normally (not sticky). Camera fill on dark (`#1e293b → #0f172a → #000` in the mock). Top overlay: `FOOD LENS` wordmark (mono 12px, ls .16em, `rgba(255,255,255,.9)`) and trust pill (≥44px, pill radius, `1px rgba(244,208,111,.55)` border on `rgba(15,23,42,.5)`). Bottom-left: loop pill (≥36px, white `rgba(255,255,255,.94)` pill). 336px is a **constraint**: verdict chip + sentence + score must land in the first 844px screen.
2. **Status strip** — 44px, `position: sticky; top: 0`, bg `#172026`, white text, `1px rgba(255,255,255,.1)` bottom border. Two modes at identical height: loop status while viewfinder visible; food name + score + Camera button once it is not. `/compass` gets no Camera button.
3. **Content** — the block slots in fixed order (spec §4): verdict, plate, chart, whyScore, weHeard, flags (/food), totals (/food), nutrients, alternatives, actions, attribution. Empty slot ⇒ renders nothing.
4. **Voice bar** — 76px collapsed, `position: sticky; bottom: 0`; transcript expands upward, max 180px.

## Interactions & behavior
- **Visibility gate:** pause frame sends below 0.50 visible ratio; resume above 0.60 after one full interval hold. Implement as a new `disarmReason: "offscreen"` in `use-live-food-score.ts` that re-arms automatically on ratio recovery — never via `rearm()`, never surfacing a "Scan again" chip. Idle disarm (`AUTO_DISARM_MS`) unchanged. 60s `stashRef` re-shows the last match on return. Crisis gets its own explicit disarm reason.
- **Performance (spec §3.4, learned from a frozen tab):** visible ratio lives in a ref; measurement coalesced to one rAF per scroll burst; only the on/off boolean renders, only on flip; no `backdrop-filter`/`drop-shadow` inside the scroller; prefer IntersectionObserver with a threshold list.
- **Loop pill states:** sending ("Reading the camera · every 2.5s"), searching ("Looking for food…"), paused-offscreen ("Camera paused — nothing sent"), unavailable (no pill at all).
- **Correctness rules (spec §6):** plate of one is never an "average"; plate average never plotted; carve-out has no number slot at all; servings never move the score; every target ≥44px; quadrant names in a legend beneath the plot, not in its corners.
- **Edge states (spec §7):** empty, carve-out, no-match (+3 tappable FNDDS candidates — new scope), camera-denied (viewfinder collapses, voice bar inverts to keyboard-primary; `/compass`: sample scan only), crisis (shell suppressed, `safetyStrings` verbatim), Spanish (verdict wraps to 3 lines; number holds its column).
- **Accessibility (spec §12):** `aria-live="polite"` loop pill announcing once per flip; strip is a named landmark; whyScore moves focus in/out; reduced-motion cuts; e2e role assertions (`region "Food camera"`, `role "log"`) must survive re-hosting.

## State management
Two mounts, one component: every `/food` vs `/compass` difference is a **capability prop, not a route check** (capability table in spec §5). `/compass` stays stateless, store-free, input-shape-frozen — `e2e/compass.spec.ts:56` (no text input rendered) must keep passing. Gate state machine: sending / searching / paused-offscreen / unavailable, layered onto the existing `disarmReason` union.

## Design tokens (from prototype v2)
- Page bg `#eef1f7` · ink `#172026` · secondary ink `rgba(23,32,38,.55–.72)`
- Primary blue `#0033a0` (links hover `#001f63`) · success/skip green `#047857`
- Band colors — Limit: `#ffe4e6`/`#9f1239`; Moderate: `#fef3c7`/`#78350f`; Be mindful: `#ffedd5`/`#7c2d12`; Choose often: `#d1fae5`/`#064e3b`; verdict red `#9d3f31` on `rgba(157,63,49,.12)`
- Type: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; labels in `ui-monospace, Menlo, monospace`
- Key sizes: score figure 50px/660; verdict sentence 21px/640; body 15px; labels 12–13px; radii 6–12px (cards 12, chips 6–7, pills 9999)
- Heights: viewfinder 336, strip 44, voice bar 76 (max transcript 180), buttons 52–56

## Strings
~19 new English strings (38 across en/es) — **reconcile against `src/i18n/strings.ts` before copy review**; six candidates already ship (`compassWhyScore`, `compassPublishedDriversNote`, `compassNotAssessable`, `compassNoPublishedScore`, `compassPointAtFood`, carve-out sentences). Drafts live in `Food Lens prototype.dc.html`. Two safety-adjacent strings go through `safetyStrings` approval, not copy review. The es dictionary needs an accent pass near `compassCalorieDensity`.

## Open decisions (spec §9 — flag, don't guess)
Disclosure consolidation (compliance), `/compass` denied-camera answer, chart-dot tap behavior, in-memory `/compass` scan history, verdict-sentence ownership. None block build start; the first two block copy freeze.

## Assets
No image assets. The pizza emoji in the prototype viewfinder is a stand-in for the live camera feed. Quadrant chart is plain divs — recreate with the codebase's existing chart region (`"Food Compass score vs calorie density"`).

## Screenshots
`screenshots/` — `01-prototype-v2.png` (top: camera visible, loop sending), `02-prototype-v2.png` (scrolled: gate paused, sticky strip in name+score mode), `redesign-explorations.png`, `build-spec.png`. The live `.dc.html` files remain the source of truth.

## Files
- `Food Lens build spec.dc.html` — the implementation contract (start here)
- `Food Lens prototype v2 scroll.dc.html` — working hi-fi reference with simulated gate
- `Food Lens prototype.dc.html` — v1; string drafts by area
- `Food Lens redesign.dc.html` — exploration history (turns 4a/5a/6a)
- `support.js`, `doc-page.js` — runtime for opening the `.dc.html` files in a browser
