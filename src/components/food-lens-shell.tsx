"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { t, type Language } from "@/i18n/strings";
import type { LiveLoopState } from "@/hooks/use-live-food-score";
import { GATE_PAUSE_BELOW, GATE_RESUME_ABOVE } from "@/domain/viewfinder-gate";
import { useViewfinderVisibility } from "@/hooks/use-viewfinder-visibility";
import type { CompassBand } from "@/domain/food-compass";

/** The viewfinder is the largest one that still puts band, sentence and number on screen one. */
export const VIEWFINDER_HEIGHT_PX = 336;
/** Camera denied: the viewfinder gives its height back and keeps only a header and a retry. */
export const COLLAPSED_VIEWFINDER_HEIGHT_PX = 132;
/** Both strip modes are this tall, so nothing jumps at the switch. */
export const STATUS_STRIP_HEIGHT_PX = 44;

/**
 * The content region is a fixed sequence of optional slots. Each one holds an existing
 * block, moved unmodified; a slot with nothing to show renders nothing at all -- not a
 * heading with an empty body, not a greyed placeholder.
 */
export type FoodLensSlot =
  | "verdict"
  | "plate"
  | "chart"
  | "whyScore"
  | "weHeard"
  | "flags"
  | "totals"
  | "nutrients"
  | "alternatives"
  | "actions"
  | "attribution";

export const FOOD_LENS_SLOT_ORDER: readonly FoodLensSlot[] = [
  "verdict",
  "plate",
  "chart",
  "whyScore",
  "weHeard",
  "flags",
  "totals",
  "nutrients",
  "alternatives",
  "actions",
  "attribution"
];

/**
 * Every difference between the two mounts is a capability, not a route check. No
 * `if (pathname)` anywhere in the shell -- that is what keeps the public mount's
 * store-free, input-shape-frozen contract testable from the outside.
 *
 * Only rendering differences live here. The bigger difference -- that the public door never
 * touches the patient record at all -- is not a flag, because a flag can be forgotten. It is
 * an import-graph proof in `scripts/check-public-door-store-free.mjs`, which fails the build
 * if anything the public door ships can reach the store. Plate, portions, day totals, flags
 * and favourites are all that record, so they are covered there rather than by a boolean
 * here; the shared layer has no render site for them either way, since the doors pass their
 * own slots.
 */
export type FoodLensCapabilities = {
  /** Typed input alongside voice (F4). */
  typedInput: boolean;
  /** The camera button in the status strip. Off where there is nowhere else to be. */
  stripCameraButton: boolean;
  /** The visibility gate. */
  gate: boolean;
  /**
   * Whether the quadrant plot holds its place when there is nothing to plot. The public
   * door's chart is the centrepiece of the page, so it waits visibly; the personal door's
   * empty screen belongs to the recents row instead.
   */
  chartPlaceholder: boolean;
};

export const FOOD_LENS_CAPABILITIES: FoodLensCapabilities = {
  typedInput: true,
  stripCameraButton: true,
  gate: true,
  chartPlaceholder: false
};

export const COMPASS_CAPABILITIES: FoodLensCapabilities = {
  typedInput: false,
  stripCameraButton: false,
  gate: true,
  chartPlaceholder: true
};

/**
 * Whether the viewfinder is on screen, for the one block that has to know: the verdict
 * prints the food's name only while the strip is not already printing it, so the name
 * appears exactly once on any screenful. A context rather than a prop so a flip re-renders
 * that block alone instead of the whole content region.
 */
const ViewfinderVisibleContext = createContext(true);

export function useViewfinderVisible(): boolean {
  return useContext(ViewfinderVisibleContext);
}

const LOOP_LABEL: Record<Exclude<LiveLoopState, "unavailable">, Parameters<typeof t>[1]> = {
  sending: "loopSending",
  searching: "loopSearching",
  paused_offscreen: "loopPausedOffscreen"
};

/**
 * The sticky strip: loop status while the viewfinder is up, then the camera's stand-in --
 * food name, score, and a button back -- once it is not.
 *
 * It owns the on/off boolean so a flip re-renders 44 pixels rather than the page.
 */
function FoodLensStatusStrip({
  language,
  loopState,
  foodName,
  foodScore,
  onBackToCamera,
  showCameraButton,
  visible
}: {
  language: Language;
  loopState: LiveLoopState;
  foodName: string | null;
  foodScore: { fcs: number; band: CompassBand } | null;
  onBackToCamera?: () => void;
  showCameraButton: boolean;
  visible: boolean;
}) {
  const loopLabel = loopState === "unavailable" ? null : t(language, LOOP_LABEL[loopState]);
  const nameMode = !visible && foodName !== null;

  return (
    <div
      aria-label={t(language, "stripRegion")}
      // Fixed, not minimum: both modes are exactly this tall so nothing jumps at the
      // switch. That is also why the camera button carries no vertical padding of its own
      // -- it fills the row, which keeps it a 44px target inside a 44px strip.
      className="sticky top-0 z-20 flex items-center gap-3 overflow-clip border-b border-white/10 bg-ink px-4 text-white"
      data-strip-mode={nameMode ? "food" : "loop"}
      role="region"
      style={{ height: STATUS_STRIP_HEIGHT_PX }}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${
          loopState === "paused_offscreen"
            ? "bg-emerald-200"
            : loopState === "unavailable"
              ? "bg-white/40"
              : "animate-pulse bg-emerald-300 motion-reduce:animate-none"
        }`}
      />
      {/* One live region for the whole strip: a mode switch and a loop flip each announce
          once, and an interval tick announces nothing because nothing here changes on it. */}
      <div aria-live="polite" className="min-w-0 flex-1">
        {nameMode ? (
          <p className="truncate text-[13px] font-semibold leading-[15px] text-white">
            {foodName}
            {foodScore ? ` · ${foodScore.fcs}` : ""}
          </p>
        ) : null}
        {loopLabel ? (
          <p
            className={
              nameMode
                ? "truncate text-[11px] font-semibold leading-[13px] text-emerald-200"
                : "truncate text-[13px] font-semibold leading-[15px] text-white/90"
            }
          >
            {loopLabel}
          </p>
        ) : null}
      </div>
      {nameMode && showCameraButton && onBackToCamera ? (
        <button
          aria-label={t(language, "stripCameraButtonLabel")}
          className="h-11 shrink-0 whitespace-nowrap rounded-full border border-white/30 px-3 text-sm font-semibold text-white"
          onClick={onBackToCamera}
          type="button"
        >
          {t(language, "stripCameraButton")}
        </button>
      ) : null}
    </div>
  );
}

/**
 * One scroll surface: viewfinder, sticky strip, the block slots, pinned voice bar.
 *
 * Wide viewports get a clamp rather than a layout -- the public door's link gets shared
 * outside the project, so desktop arrivals are certain, and one 480px column keeps the
 * sticky geometry and the gate thresholds identical to the phone.
 *
 * Nothing inside the scroller uses `backdrop-filter` or a `drop-shadow` filter. Both were
 * accomplices in a scroll that saturated the main thread; a viewfinder that scrolls is a
 * compositing problem as much as a layout one.
 */
export function FoodLensShell({
  language,
  capabilities,
  viewfinder,
  collapsedViewfinder = false,
  loopState,
  foodName,
  foodScore,
  onBackToCamera,
  onVisibleRatio,
  slots,
  voiceBar,
  voiceBarOffsetPx = 0,
  crisis = null
}: {
  language: Language;
  capabilities: FoodLensCapabilities;
  viewfinder: ReactNode;
  /** Camera denied or unavailable: the viewfinder gives up its 336px for a short header. */
  collapsedViewfinder?: boolean;
  loopState: LiveLoopState;
  foodName: string | null;
  foodScore: { fcs: number; band: CompassBand } | null;
  onBackToCamera?: () => void;
  onVisibleRatio?: (ratio: number) => void;
  slots: Partial<Record<FoodLensSlot, ReactNode>>;
  voiceBar: ReactNode;
  /** Height of anything already pinned below the shell, such as the app's tab bar. */
  voiceBarOffsetPx?: number;
  /** When present the shell stops being the shell: camera gone, voice bar locked. */
  crisis?: ReactNode | null;
}) {
  const viewfinderRef = useRef<HTMLElement | null>(null);
  const voiceBarRef = useRef<HTMLDivElement | null>(null);
  const onScreenRef = useRef(true);
  const [onScreen, setOnScreen] = useState(true);
  const onVisibleRatioRef = useRef(onVisibleRatio);
  onVisibleRatioRef.current = onVisibleRatio;

  // Two pinned bars mean anything scrolled to an edge lands underneath one of them --
  // including whatever the keyboard just moved focus to. Scroll padding is what keeps the
  // browser's own scrolling clear of them, so focus and a readable position arrive together.
  useEffect(() => {
    const root = document.documentElement;
    const previousTop = root.style.scrollPaddingTop;
    const previousBottom = root.style.scrollPaddingBottom;
    root.style.scrollPaddingTop = `${STATUS_STRIP_HEIGHT_PX}px`;

    const applyBottom = () => {
      const barHeight = voiceBarRef.current?.offsetHeight ?? 0;
      // Published as a variable too, so the bar's own controls can cancel it (globals.css).
      root.style.setProperty("--food-lens-pinned-bottom", `${barHeight + voiceBarOffsetPx}px`);
      root.style.scrollPaddingBottom = "var(--food-lens-pinned-bottom)";
    };
    applyBottom();

    const observer =
      typeof ResizeObserver === "undefined" || !voiceBarRef.current
        ? null
        : new ResizeObserver(applyBottom);
    if (voiceBarRef.current) {
      observer?.observe(voiceBarRef.current);
    }

    return () => {
      observer?.disconnect();
      root.style.removeProperty("--food-lens-pinned-bottom");
      root.style.scrollPaddingTop = previousTop;
      root.style.scrollPaddingBottom = previousBottom;
    };
  }, [voiceBarOffsetPx]);

  const handleRatio = useCallback((ratio: number) => {
    onVisibleRatioRef.current?.(ratio);
    // The same hysteresis the loop uses, so the strip and the gate never disagree.
    const next = onScreenRef.current ? ratio >= GATE_PAUSE_BELOW : ratio >= GATE_RESUME_ABOVE;
    if (next !== onScreenRef.current) {
      onScreenRef.current = next;
      setOnScreen(next);
    }
  }, []);

  useViewfinderVisibility({
    targetRef: viewfinderRef,
    onRatio: handleRatio,
    enabled: capabilities.gate && crisis === null
  });

  if (crisis) {
    return <div className="mx-auto w-full max-w-[480px] text-ink">{crisis}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[480px] text-ink">
      <section
        aria-label={t(language, "compassCameraRegion")}
        ref={viewfinderRef}
        style={{ height: collapsedViewfinder ? COLLAPSED_VIEWFINDER_HEIGHT_PX : VIEWFINDER_HEIGHT_PX }}
      >
        {viewfinder}
      </section>

      <FoodLensStatusStrip
        foodName={foodName}
        foodScore={foodScore}
        language={language}
        loopState={loopState}
        onBackToCamera={onBackToCamera}
        showCameraButton={capabilities.stripCameraButton}
        visible={onScreen}
      />

      <ViewfinderVisibleContext.Provider value={onScreen}>
        <div
          aria-label={t(language, "contentRegion")}
          className="flex flex-col gap-[18px] bg-white px-[18px] pb-6 pt-[18px] [&>*]:min-w-0"
          role="region"
        >
          {FOOD_LENS_SLOT_ORDER.map((slot) =>
            slots[slot] ? <React.Fragment key={slot}>{slots[slot]}</React.Fragment> : null
          )}
        </div>
      </ViewfinderVisibleContext.Provider>

      <div
        aria-label={t(language, "voiceBarRegion")}
        className="sticky z-30 border-t border-white/10 bg-ink px-4 pb-4 pt-3 text-white"
        data-food-lens-pinned=""
        ref={voiceBarRef}
        role="region"
        style={{ bottom: voiceBarOffsetPx }}
      >
        {voiceBar}
      </div>
    </div>
  );
}
