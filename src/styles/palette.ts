/**
 * The app's semantic colors, in one place, so Tailwind and the contrast tests
 * read the same numbers.
 *
 * The care/action color is University of Kentucky blue on cool whites. The three
 * semantic colors do not move with it — urgency (pulse), caution (note), and the
 * crisis rose have to stay a different temperature than the brand, or a deadline
 * starts reading as decoration.
 *
 * Tailwind consumes these as `rgb(var(--color-x) / <alpha-value>)`, so every
 * `bg-care/5` and `border-care/40` keeps working; only the variable behind it
 * changes.
 */
export type PaletteToken = "ink" | "paper" | "care" | "pulse" | "calm" | "note";

export type Palette = Record<PaletteToken, string>;

export const PALETTE: Palette = {
  /** Body text. Unchanged: it keeps its tested contrast on both whites. */
  ink: "#172026",
  /** Page background — cool white; cards stay pure white. */
  paper: "#f6f8fc",
  /** UK blue: 10.4:1 on white, and white on it passes AA at every size used. */
  care: "#0033a0",
  /** Deadlines and clinic-now only. */
  pulse: "#9d3f31",
  /** Chips, active-tab fill, answered-bubble tint. */
  calm: "#e3eaf8",
  /** Informational cautions (draft translation, verify-by-phone, year-only). */
  note: "#f4d06f"
};

/** "#0033a0" -> "0 51 160", the space-separated form Tailwind's alpha syntax needs. */
export function rgbChannels(hex: string): string {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(" ");
}
