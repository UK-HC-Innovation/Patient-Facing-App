import "@testing-library/jest-dom/vitest";

// jsdom exposes scrollTo as a noisy "not implemented" stub. Components that
// restore viewport state can exercise it deterministically by spying on this
// browser-compatible no-op in their focused tests.
Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: () => undefined
});
