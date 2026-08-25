/**
 * The visibility gate's thresholds, in one place so the loop that spends money and the
 * strip that reports it can never disagree.
 *
 * Two thresholds rather than one: a single 50% line flips the loop on and off repeatedly
 * during a slow scroll, and the gap is what stops a flick past the camera from costing a
 * request.
 */

/** Below this much of the viewfinder on screen, stop sending frames. */
export const GATE_PAUSE_BELOW = 0.5;
/** Resume only above this much, and hold the resume for one full interval before sending. */
export const GATE_RESUME_ABOVE = 0.6;
