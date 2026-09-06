/**
 * The client half of usage recording.
 *
 * Deliberately a module singleton and not a React context. Two reasons:
 *
 *  - `scripts/check-public-door-store-free.mjs` proves the public Food Lens door never
 *    reaches the patient store. A recorder that hung off a provider would sit next to that
 *    provider in the tree and invite exactly the import this file must not have. Nothing
 *    here imports `@/state/*`, and nothing here reads `location.pathname` -- callers pass a
 *    route id from the closed set in `@/domain/usage-event`.
 *  - Instrumentation has to be callable from plain functions and API-adjacent code, not
 *    only from inside a component.
 *
 * Every entry point is wrapped so recording can fail in any way it likes without reaching
 * the app. A telemetry bug that breaks a patient-facing screen is worse than no telemetry.
 */

"use client";

import { APP_SURFACE } from "@/config/app-surface";
import type { UsageBatch, UsageEvent, UsageEventInput } from "@/domain/usage-event";

const ENDPOINT = "/api/usage";
const SESSION_KEY = "usage-session-id";

/** Flush when the buffer reaches this, so a busy screen does not sit on its events. */
const FLUSH_AT = 25;
/** And on this cadence, so a quiet screen still reports before the tab closes. */
const FLUSH_EVERY_MS = 10_000;
/**
 * Hard ceiling. Past this the oldest events are dropped and counted. Reporting a gap
 * honestly is worth more than an unbounded array on a phone.
 */
const MAX_BUFFERED = 200;

type Context = { lang: "en" | "es" };

let buffer: UsageEvent[] = [];
let dropped = 0;
let seq = 0;
let started = false;
let sending = false;
let timer: ReturnType<typeof setInterval> | null = null;
let startedAt = "";
let sessionId = "";
let context: Context = { lang: "en" };

function browser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Enabled unless a deployment turns it off. `0` and `false` both read as off. */
function enabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_USAGE_TELEMETRY;
  return flag !== "0" && flag !== "false";
}

/** Must satisfy the batch schema's `token`, so build ids that are not slug shaped are dropped. */
function buildId(): string {
  const raw = (process.env.NEXT_PUBLIC_BUILD_ID ?? "dev").toLowerCase();
  return /^[a-z0-9][a-z0-9_.:-]{0,39}$/u.test(raw) ? raw : "unknown";
}

/**
 * Per tab, not per person. Lives in sessionStorage so a new tab is a new session and
 * closing the browser ends it; there is no cross-visit identifier anywhere in this file.
 */
function ensureSession(): string {
  if (sessionId) return sessionId;
  const fresh = `s${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`.slice(0, 24);
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored && /^[a-z0-9][a-z0-9_.:-]{0,39}$/u.test(stored)) {
      sessionId = stored;
      return sessionId;
    }
    window.sessionStorage.setItem(SESSION_KEY, fresh);
  } catch {
    // Private mode, blocked site data. An in-memory id still groups this page's events.
  }
  sessionId = fresh;
  return sessionId;
}

function envelope(events: UsageEvent[]): UsageBatch {
  return {
    session: ensureSession(),
    surface: APP_SURFACE,
    build: buildId(),
    lang: context.lang,
    viewport: window.innerWidth < 768 ? "narrow" : "wide",
    startedAt,
    dropped,
    events
  };
}

/**
 * `keepalive` is what lets an unload-time flush survive the navigation. `sendBeacon` is the
 * better tool when the page is going away, so `beacon` picks it when it is there.
 */
function transmit(batch: UsageBatch, beacon: boolean): void {
  const body = JSON.stringify(batch);
  try {
    if (beacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    }).catch(() => undefined);
  } catch {
    // A blocked request is a lost batch, never an app error.
  }
}

function flush(beacon = false): void {
  if (!started || !enabled() || sending || buffer.length === 0 || !browser()) return;
  sending = true;
  const pending = buffer;
  buffer = [];
  try {
    transmit(envelope(pending), beacon);
    dropped = 0;
  } catch {
    // Dropped rather than retried: a retry queue outlives the tab it belongs to.
  } finally {
    sending = false;
  }
}

/**
 * Record one event. Safe to call during render, on the server, before the recorder starts,
 * and after the page has begun unloading.
 */
export function recordUsage(event: UsageEventInput): void {
  try {
    if (!enabled()) return;
    if (buffer.length >= MAX_BUFFERED) {
      buffer.shift();
      dropped += 1;
    }
    buffer.push({
      ...event,
      seq: seq++,
      at: startedAt ? Math.max(0, Math.round(performance.now())) : 0
    } as UsageEvent);
    if (buffer.length >= FLUSH_AT) flush();
  } catch {
    // Never let instrumentation surface as an app failure.
  }
}

/** Lets the app supply the display language without the recorder importing the store. */
export function setUsageContext(next: Partial<Context>): void {
  context = { ...context, ...next };
}

/** Mount-time start. Idempotent, so a remount does not double the listeners or the timer. */
export function startUsageRecorder(): void {
  if (started || !browser() || !enabled()) return;
  started = true;
  startedAt = new Date().toISOString();
  ensureSession();

  timer = setInterval(() => flush(), FLUSH_EVERY_MS);

  // `visibilitychange` is the reliable one on mobile, where `pagehide` and `unload` are
  // routinely skipped when the OS backgrounds the tab.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));

  flush();
}

/** Test seam. Not called by the app. */
export function __resetUsageRecorderForTests(): void {
  if (timer) clearInterval(timer);
  timer = null;
  buffer = [];
  dropped = 0;
  seq = 0;
  started = false;
  sending = false;
  startedAt = "";
  sessionId = "";
  context = { lang: "en" };
}

/** Test seam. Not called by the app. */
export function __usageBufferForTests(): { events: UsageEvent[]; dropped: number } {
  return { events: [...buffer], dropped };
}
