/**
 * Shared authority clock for asynchronous Food Lens sources.
 *
 * `invalidate()` advances the ref synchronously, before React can render. A request that
 * captured the old value can therefore test `isCurrent()` immediately after any await and
 * is never allowed to publish over a newer package, barcode, correction, or camera action.
 */
export type FoodAuthority = {
  /** Render-visible value used only to abort work promptly in effects. */
  epoch: number;
  snapshot: () => number;
  isCurrent: (epoch: number) => boolean;
  invalidate: () => number;
};
