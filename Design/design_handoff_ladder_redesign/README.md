# Handoff: Ladder front-end architecture redesign

## Overview
Redesign of "Ladder," a phone-first web tool for Kentucky families waiting on a developmental-pediatrics evaluation. The redesign replaces today's single long scrolling page with **four tabbed surfaces (Home / Programs / Notes / Visit)** behind one crisis layer and one crisis-gated composer, restyled in the University of Kentucky palette (UK blue #0033A0 on white). It solves the 8 problems flagged by the 6-persona usability audit (P1–P8, mapped below).

Target repo: `UK-HC-Innovation/Patient-Facing-App` (branch `master`). The current implementation lives in `src/components/family-experience.tsx` and the `family-*` components; strings in `src/i18n/family-strings.ts`; catalog in `src/domain/family-resources.ts`; tokens in `tailwind.config.ts` + `src/components/family-theme.ts`.

## About the Design Files
`Ladder Redesign.dc.html` is a **design reference created in HTML** — an annotated canvas of static hi-fi screens plus one working prototype panel. It is NOT production code. The task is to **recreate these designs inside the existing Next.js/React/Tailwind codebase**, reusing its components, string tables, reducer, and catalog — not to ship this HTML. Read the canvas in a browser; every screen has a badge id (1a–3e) referenced below.

## Fidelity
**High-fidelity.** Colors, type sizes, spacing, radii, and copy are final and specified exactly. Recreate pixel-perfectly with the codebase's Tailwind tokens (extend the theme with the new blue values). Copy strings are final English/Spanish; add them to `family-strings.ts` rather than hardcoding.

## Non-negotiable constraints (unchanged from product rules)
- Crisis banner always leads the open surface when triggered; never folds, never below content. One crisis-gated composer; every "add a note" routes to it. No new free-text surfaces.
- Program names, phones, URLs only from the verified catalog (`family-resources.ts`). Never diagnose; never state qualification.
- Share requires an explicit consent tick each time (two taps OK).
- One question on screen at a time.
- On-device only; no accounts.
- 375×812 baseline; must reflow at 200% zoom with **zero horizontal scroll**; targets ≥44px; WCAG AA; visible keyboard focus; ~6th-grade reading level.

## Information architecture (canvas 1a)
Four surfaces behind a **sticky (not fixed) bottom tab bar** — a wrapping grid (`grid-template-columns:repeat(auto-fit,minmax(84px,1fr))`) so at 200% zoom it wraps 2×2 instead of clipping. This replaces the current fixed two-link bar (which breaks the zoom requirement).

- **Home** — front door. Return state: "what changed" chips, ONE due card (check-in, then queued follow-up), deadline clock (honest range), standing "Add a note" button, doorway rows to other tabs. First run: Home IS the interview (arrival framing → composer → "Sounds like…" strip → first answer); tabs appear only after the first answer.
- **Programs** — matched cards (call/do action on face), state chips, "Things to try at home" guides, Saved. Enrolled cards sink to bottom.
- **Notes** — journal by month with "you wrote" quotes; visit packet (pickable questions, print/copy); "not a medical record."
- **Visit** — appointment companion (waitlist → book → reminders → missed → rebook). **The tab exists only when a referral fits the child's profile** (family says they're on a list / books one). When absent, render 3 tabs (canvas 3e). When it first appears, show a one-time dismissible notice card.
- **Crisis layer** — above everything on whichever surface is open (canvas 1i, 3c). Content below dims (opacity .6) with pause line "Paused while the safety message above is open." Tab switches do not dismiss; only "I have seen this."

First-run flow: arrival framing (kept verbatim) → type/speak → "Sounds like…" strip + fact check → first answer (3 cards + one question) → "you're set" → tabs appear.
Return flow: Home opens on what changed + what's due; composer collapses to one-tap "Add a note" row — it never disappears.

## Screens / Views

### Home, return state (canvas 2a — UK blue reference; layout identical to 1b)
- Header: white bg, bottom border rgba(0,51,160,.12), padding 12×16. App name "Ladder" 17px/700 #0033A0; subline "Mateo · Pike County" 11.5px rgba(23,32,38,.6). Right: EN|Español toggle (see Language pattern).
- H1 "Welcome back. Here's what's waiting." 22px/700, line-height 1.25. Subline "Last note: July 6 · about a month ago" 13.5px.
- What-changed chips: pill radius 999px, bg #E3EAF8, text #1d2f5f 12.5px/600, padding 6×10 ("2 notes", "1 step in motion", "On the list since March").
- **Due card** (the ONE ask): white card, border 2px rgba(0,51,160,.45), radius 8, padding 16. Kicker "YOUR NEXT STEP · ABOUT 30 SECONDS" 12px/700 uppercase #0033A0, letter-spacing .06em. Question 19px/600 lh 1.3. Answer buttons: min-height 48, bg rgba(0,51,160,.05), text #0033A0 16px/600, border 1px rgba(0,51,160,.3), radius 8. Tertiary "Skip check-in" underlined text button 14px/600 rgba(23,32,38,.7), min-height 44. Queue hint 12.5px rgba(23,32,38,.6): "1 more thing after this: …".
- **Deadline clock** (year-only state): left border 4px rgba(157,63,49,.7), bg rgba(157,63,49,.05), radius 8, padding 12. Copy 14px lh 1.55: "**First Steps stops taking new referrals 45 days before Mateo turns 3.** We only know his birth *year*, so the cutoff lands **between this November and November 2027** — it depends on his birthday." Repair chip: white button, border 1px rgba(0,51,160,.4), text #0033A0 14px/600, min-height 44: "＋ Add his birth month — we'll name the date". Caption 12px: "Month only — not the full birthday."
- **Standing composer button**: full-width, min-height 52, bg #0033A0, white 16px/700, radius 8, mic icon: "Add a note about Mateo — type or speak".
- Doorway rows: white card, dividers rgba(0,51,160,.1); each row min-height 48, label 15px/600 ink, right meta 13px/600 #0033A0 ("8 matched ›", "on the list ›", "2 notes in ›").
- Honesty footer 12.5px rgba(23,32,38,.65): "Your notes stay on this phone. We can't predict the exact evaluation date — here's how to make the wait count."
- Tab bar: sticky bottom, white, top border rgba(0,51,160,.12), wrapping grid, items min-height 52, radius 8; active = bg #E3EAF8 text #0033A0 700; inactive rgba(23,32,38,.75) 600; 12px labels + 20px stroke icons (home/grid/notes/calendar, stroke-width 2).

Quiet-month variant (3e): due card says "Nothing is due right now. Last note July 6 · next check-in in about 2 weeks." — never fabricate urgency; only the standing Add-a-note remains.

### First-answer screen (canvas 1e)
- Collapsed transcript row: bg rgba(227,234,248,.7), radius 8, min-height 48 — truncated quote of what they typed + "Read or add more" (reopens the SAME composer; no second text surface).
- "Sounds like:" strip card (kept from shipped app): "Sounds like: Pike County · Mateo, about 2 years old · Early intervention." 16px/600 + amber chip "Check our guesses" (bg rgba(244,208,111,.4)). Inside: one fact card at a time — title 14.5px/600, guess 14px, chip "From your words", "YOU WROTE" label 11px/700 uppercase + quote with 4px teal→blue left border, confirm button "Yes, that is right" (44px). Link "Check or change this ›". Trust line: "Nothing here is saved anywhere but this phone, and you can change any of it."
- Section head "First places to try" 19px/700 + intro "Based on Pike County, age about 2, and your words. Always check the program's own page — their rules are the ones that count."
- 3 program cards (anatomy below), then link "See all 8 places in Programs" (48px hit area).
- One question card (kept): kicker "QUESTION 1 OF 2", "Optional — answering sharpens the list.", question 18px/600, ≤3 answer chips + "Or type a short answer" input row (the input is part of the gated composer, not a new surface).
- Footer: "We use your own words to find help. We do not diagnose, and we cannot decide what you qualify for — only the program can do that."
- First jargon per screen gets a one-line gloss under the card (e.g. "**Point of Entry** — the local office that takes First Steps referrals.").

### Monthly check-in (canvas 1f)
One question per screen, progress "2 of 3" 12px/600. Parts: note → skill-loss probe → support pulse; every part skippable; skip counts as an answer. Probe card includes CDC examples panel (bg rgba(244,208,111,.3)): "Skill loss can look like: words that stopped, waving or pointing that went away, or steps backward in things like feeding or stairs." + source link. A probe "yes" raises the **clinic-now tier** (NOT crisis styling): white card, border 1px rgba(157,63,49,.4) + left 8px #9d3f31, title "Worth telling the clinic now" 17px/600 #9d3f31, body "Losing skills is worth reporting now — not waiting for the visit…", tel: button to the clinic (white bg, #9d3f31 text, 2px rust border, 52px) + "I've noted this". Never claims a condition or promises an earlier visit.

### Programs tab (canvas 1g)
Header with context line "Pike County · about age 2 · your words". Intro honesty line. Suggested/planned cards first (full anatomy), enrolled cards sink to bottom at opacity .85 with meta "You already have this — it sits at the bottom so new options stay first." Then "Things to try at home" guide cards (title, 1-line summary, source + checked-on date). Then "Saved for later" list. Tab bar as Home.

### Visit tab (canvas 1h)
- Status card: "**On the list since March 2026 — about 5 months so far.**" + "We can't predict the exact date — here's how to make the wait count."
- Slot-offer card (the ONE ask): 3 slot buttons (48px, blue-tinted) + **4th first-class option "None of these work for us"** (white, ink border). Below: reassurance panel bg rgba(227,234,248,.6): "**You keep your place.** Saying no to these times changes nothing about your spot on the list. We'll show new times when they open." — role="status".
- Sooner-list card: "Cancellations happen. If an earlier time opened up, could you take it on short notice?" Yes (solid blue) / No thanks (outline).
- "What to do, and when" Now/Next/Later rows (44px min label column) + honesty line "A plan to think about — not a reminder service, and not a decision about what you qualify for."
- Reminder honesty panel (amber): "Reminders appear here when you open Ladder — it can't text or call you. Put the visit on your phone's calendar too."
- One ask at a time: barriers, reminders, sooner-list each wait their turn.

### Crisis state (canvas 1i teal / 3c blue)
Banner: bg #fff1f2, left border 8px #fb7185, bottom border 2px #fb7185. Lead 15.5px/600. Inner panel border #fda4af: shield icon + "If someone is in danger or thinking about self-harm" 14px/700 #9f1239; actions Call 988 (bg #e11d48), Text 988 (white/#be123c border #f43f5e), Call 911 (bg #be123c) — all ≥48px, real tel:/sms: hrefs. Ack button "I have seen this" bg #be123c 48px. Crisis copy is fixed and human-authored; rose palette never rebrands to blue.

### Empty/edge states (canvas 3d, 3e)
- Notes empty: "No notes yet. The first one takes about 10 seconds — your words, with a date, kept on this phone." + "Add the first note" (solid blue, mic icon).
- Visit-tab-appears notice: blue-tinted card "You said Mateo is on the list at UK Developmental Pediatrics. We added a **Visit** tab to walk that wait with you." See it / Not now.
- Disabled-control pattern: control stays visible & dimmed; tapping shows an inline rust message (`role="alert"`, 13px/500 #9d3f31) saying what to do instead. Examples: "Check the consent box first — sharing needs your OK each time." / "This needs a booked visit first — pick a time above." / "The packet is empty — add a note or pick a question first." / "That doesn't look like a month — try a number from 1 to 12, or pick from the list." **No silent no-ops anywhere.**

## Program card anatomy (canvas 1j)
Compact (face):
1. Name — verbatim from catalog. 17px/600 lh 1.3.
2. Chip: urgency ("Worth doing now": border rgba(157,63,49,.4), bg rgba(157,63,49,.1), text #9d3f31) OR state chip — never both; enrolled wins.
3. Meta line 13px rgba(23,32,38,.65): service area + age band.
4. Grounding quote (only when checked against transcript): 4px left border rgba(0,51,160,.3), "You said: 'barely talks'".
5. Deadline strip (only with a real dated cutoff): rust left-border style as Home clock.
6. **THE action on the face** — by catalog referral mode:
   - `call` → `tel:` button, **the number is the label** ("Call 606-886-4417"), min-height 52, bg #0033A0, white 16.5px/700, phone icon.
   - `self_serve` → "Start online — kynect" link button (same size); phone second as text link.
   - `provider_referral` → "Ask your doctor for a referral" + auto-add the ask to visit-packet questions.
   - `school_contact` → "Contact the school" + KDE parent guide link.
   - `navigator_referral` → "Ask a navigator to help".
7. Secondary row: "I'll do this" (outline blue) + "More about this" (outline ink) — flex 1 each, 44px.

Expanded ("More about this"): description → jargon gloss line → tel button + alt numbers → "Why it helps to start now" → How to get in → Age range → Source + checked-on date → "See their official page" external link (48px) → amber caution "Call and check before you count on this. Details change." → share block (consent checkbox 20×20 accent #0033A0 + Share button + receipt) → Save / "We already have this" text buttons.

States: Suggested (default) / Planned ("I'll do this" stamps `Planned · <month>` at point of tap, with inline `undo`) / Saved (undo) / Enrolled (undo; card sinks; **marking First Steps enrolled retires the deadline clock everywhere**). Chips: bg #E3EAF8, text #1d2f5f, 11.5px/700; undo is an underlined #0033A0 text button inside the chip.

## Deadline honesty (canvas 1j right column) — P5
- Birth month known: "About 14 weeks left to start First Steps — referrals close **November 17**. After the cutoff, the school system takes over referrals."
- Year only: NEVER a week count. "The cutoff lands **between this November and November 2027** — it depends on Mateo's birthday." + repair chip "＋ Add his birth month — we'll name the date" (one tap opens a month-only picker; fixes every clock instance app-wide). Caption "Month only — not the full birthday."

## Share flow (canvas 1l, live in 3b) — P6
1. Consent: checkbox "I agree to share this resource now." Share button disabled until ticked; tapping while disabled shows the inline alert.
2. On tap: `navigator.share({title: <catalog name>, url: <catalog url>})`; if unsupported → copy `name — url` to clipboard ("Copy link" fallback). User cancel = no receipt.
3. Receipt (`role="status"`, #1d2f5f 13px/600): "Sent: the program's name and link. Nothing about Mateo." Payload NEVER includes child data.

## Language pattern (canvas 1k, 3a) — P4
- EN|Español segmented control in the header of EVERY surface incl. first run and crisis. Both labels always visible, each ≥44px (EN min-width 48). Active: bg #0033A0 white 700; inactive: white bg #0033A0 600. Border rgba(0,51,160,.4), radius 8.
- Switch swaps all UI strings in place (no reload, thread preserved), persists on device. Dictation locale follows (es-US).
- Catalog copy stays English: per-card amber tag "Detalles del programa en inglés"; keep shipped draft notice "El español aquí es un borrador. Todavía falta que lo revise una persona hablante nativa." as an amber strip under the header in ES mode.
- Full ES front-door copy is in canvas 3a and prototype strings (see `family-strings.ts` additions); dates localized ("6 de julio").

## Jargon gloss (canvas 1l) — P7
One-line plain-language gloss under the FIRST use of a term per screen; later uses plain. 12.5px, term bold + dotted underline rgba(0,51,160,.6). Dictionary: IFSP "the written plan First Steps makes with your family" · IEP "the written plan the school must follow for your child" · 504 plan "school supports without special-education classes" · POE "the local office that takes First Steps referrals" · ARC "Kentucky's name for the school meeting where your child's plan is decided" (per KDE Parent Toolbox).

## Interactions & Behavior
- Tabs: client-side switch, no page reload; crisis banner persists across switches until acknowledged.
- Check-in: 3 parts, one on screen at a time; answers/skips advance; after close, the queued follow-up card replaces it on Home.
- "I'll do this"/Save/Enrolled: instant chip at point of tap + undo; no confirmation modals.
- Composer: one instance, crisis-gated (existing gate logic); collapses to a button on return; "Read or add more" reopens it with transcript.
- Golden path demo (canvas 3b) shows the full sequence: check-in → composer → receipt "Note saved to August — in your words, on this phone." → follow-up → card states + share.
- No animations required beyond default focus/press states; keep motion minimal.
- Focus: visible outline on every interactive element (2px #0033A0 offset 2).

## State Management (maps to existing reducer in family-experience.tsx)
- `language: 'en' | 'es'` (persisted, device-local)
- `visitedBefore/lastVisit` → first-run vs return routing
- `checkinState: {part: 1|2|3, due: boolean, answers}` + queued `followups[]`
- `resourceStates: Record<id, 'suggested'|'planned'|'saved'|'enrolled'>` with timestamps (chip month) + undo stack
- `birthYear`, `birthMonth?` → clock precision mode (range vs dated)
- `visitTrack?: {status: waitlist|offered|booked|missed, slots[], soonerList}` → Visit tab existence + content
- `crisisActive: boolean` (from composer gate) + `crisisAcknowledged`
- `consentTick: per-share, never persisted` · `shared receipts: session-only`
- All storage on-device (localStorage/IndexedDB per existing pattern). No accounts, no network writes.

## Design Tokens
Colors:
- `care` **#0033A0** (UK blue) — primary buttons, tel: actions, links, active tab, focus, EN|Español. Hover/deep: #1d2f5f. On white: 10.4:1.
- `calm` **#E3EAF8** — chips, active-tab fill, receipts bg (text #1d2f5f). Tint scale: rgba(0,51,160,.05) button fill, .12 borders/dividers, .3/.4/.45 borders by emphasis.
- `paper` **#F6F8FC** — page bg; cards pure #FFFFFF.
- `ink` **#172026** — unchanged. Secondary text: rgba(23,32,38,.6–.85).
- `pulse` **#9D3F31** — unchanged; deadlines + clinic-now + inline alerts ONLY (tints: rgba(157,63,49,.05) bg, .4–.7 borders).
- Crisis rose — unchanged, never rebranded: #fff1f2 bg, #fb7185/#fda4af/#f43f5e borders, #e11d48/#be123c actions, #9f1239 text.
- `note` amber **#F4D06F** — informational cautions at rgba(244,208,111,.3–.4).
- Baseline recreation (canvas 1m) keeps shipped teal #217C70 — do not ship teal anywhere new.

Type: system stack (ui-sans-serif/system-ui). Scale: 11/11.5/12/12.5/13/13.5/14/14.5/15/15.5/16/16.5/17/18/19/22px; weights 500/600/700; body lh 1.5–1.6, headings 1.25–1.35. Kickers: 12px/700 uppercase, letter-spacing .06em.
Spacing: 4/6/8/10/12/14/16 padding steps; card padding 16; grid gap 12–14; screen padding 16.
Radius: 8px cards/buttons; 999px pills; 14px only on the canvas phone frames (not product).
Shadows: cards `0 1px 2px rgba(0,0,0,.05)`; nothing heavier.
Hit targets: 44px minimum, 48px standard, 52px primary/tel.

## Accessibility
AA contrast throughout (blue 10.4:1, #1d2f5f on #E3EAF8 ≈ 8:1, rust #9d3f31 on white 6.7:1). Inline errors `role="alert"`, receipts/reassurance `role="status"`. One `<h1>` per surface. Tab bar = `<nav>` with `aria-current`. Icons `aria-hidden` with text labels always present. Reflow: no fixed positioning except sticky tab bar; wrapping grid at 200% zoom; no horizontal scroll at 375px.

## Assets
No image assets. Icons are inline SVG strokes (24 viewBox, stroke-width 2, round caps): home, grid, notes, calendar, phone, mic, share, bookmark, shield, external-link — recreate with the codebase's icon approach or copy the paths from the canvas file. All program names/numbers/URLs from `src/domain/family-resources.ts` (e.g. First Steps Big Sandy POE 606-886-4417 / 800-230-6011; KY First Steps 877-417-8377; Help Me Grow KY 877-616-7388; KY-SPIN 800-525-7746; Michelle P. help desk 844-784-5614).

## Problem → solution map (audit P1–P8)
- P1 call buried → tel: button on card face, number as label (1e, 1j)
- P2 fold-pile → four tabbed surfaces; one ask above the fold (1a, 2a)
- P3 first-run vs return → return front door + standing composer (2a)
- P4 language → EN|Español in every header, ES parity, honest English-catalog tag (1k, 3a)
- P5 false precision → dated range + "add birth month" repair chip (1j)
- P6 fake share → consent → OS share sheet/copy-link → honest receipt (1l, 3b)
- P7 jargon → one-line gloss, once per screen (1l)
- P8 escape hatches → "None of these work" keeps your place; inline no-op messages (1h, 3d)

## Screenshots
`screenshots/` — full-height PNG captures of each canvas frame, named by badge id: 1a IA · 2a Home return (UK blue) · 2b token map · 3a Home Español · 1e first answer · 1f check-in · 1g Programs · 1h Visit · 1i/3c crisis (teal/blue) · 3d inline no-ops · 3e empty states · 1j card anatomy · 1k language · 1l gloss/share/no-op · 1m baseline current UI (teal). The HTML canvas remains the source of truth for exact values.

## Files
- `Ladder Redesign.dc.html` — the annotated canvas (all screens, badges 1a–3e; turn 2 = UK blue front door + token map; turn 3 = ES mirror, live golden-path prototype, crisis/edge states; turn 1 = full redesign + teal baseline recreation 1m).
- `support.js` — canvas runtime only; ignore for implementation.
- `github.md` — source-repo association and screen map.
