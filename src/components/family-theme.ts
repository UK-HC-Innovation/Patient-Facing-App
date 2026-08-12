// Shared presentation tokens for the Ladder family surface. One place decides
// what "primary" or "a demo control" looks like, so the page can keep a single
// action hierarchy and a single semantic color map:
//   rose  = crisis only
//   pulse = deadline / act-now (worth a phone call, not an emergency)
//   note  = informational caution (verify-by-phone, draft translation)
//   care  = progress and positive confirmation

export const CONTROL_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-care";

/** One per view: the single advancing action on screen. */
export const BTN_PRIMARY = `min-h-12 min-w-0 break-words rounded-control bg-care px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`;

/** Supporting actions that still deserve a border. */
export const BTN_SECONDARY = `min-h-12 min-w-0 break-words rounded-control border border-care/40 bg-white px-4 py-2 text-left font-semibold text-care disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`;

/** Answer chips — one question, several equal choices. */
export const BTN_CHOICE = `min-h-12 min-w-0 break-words rounded-control border border-care/30 bg-care/5 px-4 py-2 text-left font-semibold text-care disabled:cursor-not-allowed disabled:opacity-50 ${CONTROL_FOCUS}`;

/** Reversible, low-stakes toggles: no box, just a readable label. */
export const BTN_QUIET = `inline-flex min-h-12 min-w-0 items-center gap-2 break-words rounded-control px-2 py-2 text-sm font-semibold text-ink/70 underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60 ${CONTROL_FOCUS}`;

/** Checklist answers: a yes/no pair sitting beside one line of the family's words. */
export const BTN_ROW = `min-h-12 min-w-12 shrink-0 rounded-control border border-ink/20 bg-white px-3 text-sm font-semibold text-ink/75 disabled:cursor-not-allowed ${CONTROL_FOCUS}`;

/** The chosen half of that pair. */
export const BTN_ROW_ON = `min-h-12 min-w-12 shrink-0 rounded-control border border-care bg-care px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-100 ${CONTROL_FOCUS}`;

/** Standard content section: a plain white card. */
export const CARD_SECTION = "min-w-0 rounded-control border border-ink/10 bg-white p-4 scroll-mt-4";

/** Content sections that intentionally sit on the paper surface. */
export const CARD_SECTION_PAPER = "min-w-0 rounded-control border border-ink/10 bg-paper p-4 scroll-mt-4";

/** The page's one ask (check-in, follow-up): visibly the next thing to do. */
export const CARD_ASK = "min-w-0 rounded-control border-2 border-care/50 bg-white p-4 shadow-sm scroll-mt-4";

/** Utility furniture (settings, saved list, timeline): quieter than content. */
export const CARD_SUBDUED = "min-w-0 rounded-control border border-ink/10 bg-transparent p-4 scroll-mt-4";

/** Demo scaffolding: unmistakably not care content, without hiding it. */
export const DEMO_BLOCK = "min-w-0 rounded-control border border-dashed border-ink/30 bg-paper p-3";

/** Section headings by tier. */
export const H2_SECTION = "text-lg font-semibold";

/** Small over-title label on the one-ask card. */
export const ASK_EYEBROW = "text-xs font-semibold uppercase tracking-wide text-care";

/** Informational caution (note amber): verify-by-phone, draft translation, year-only. */
export const NOTICE_INFO = "rounded-control bg-note/30 p-3 leading-relaxed";

/** Deadline / act-now (pulse rust): worth doing now, dated cutoffs. */
export const NOTICE_DEADLINE = "rounded-control border-l-4 border-pulse/70 bg-pulse/5 p-3 leading-relaxed";
