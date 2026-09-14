#!/usr/bin/env node
/**
 * The real-model check for GPT-Live-1 on 1 good choice (docs/handoffs/30-onegoodchoice-gpt-live-1.md, P4).
 *
 * Plays a spoken question into Chromium's fake microphone, lets the page run a real GPT-Live
 * session, and reads back what the person said, what the app answered, whether the kill switch
 * fired, what the model said before it did, and how many seconds OpenAI billed. It spends money:
 * every scenario is one session at $0.05 a minute.
 *
 * Needs a dev server with HEALTH_AI_PROVIDER=openai, a key, and HEALTH_AI_LIVE_LANGUAGES=en,es.
 * Clips are 16-bit PCM WAV with a few seconds of silence before the question, so the words land
 * after the connection is up.
 *
 *   node scripts/live-voice-check.mjs --base http://localhost:3217 --clips C:/tmp/live-voice-fixtures
 *   node scripts/live-voice-check.mjs --only demo-en-dose
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const BASE = option("base", "http://localhost:3217");
const CLIPS = option("clips", "C:/tmp/live-voice-fixtures");
const ONLY = option("only", "");
const LISTEN_MS = Number(option("listen", "22000"));
const BUDGET_SECONDS = Number(option("budget", "900"));

const SCENARIOS = [
  { name: "demo-en-score", door: "/food/demo", lang: "en", clip: "en_good.wav", typed: "banana", expect: "score" },
  { name: "demo-en-lookup", door: "/food/demo", lang: "en", clip: "en_peanut.wav", typed: "banana", expect: "lookup", query: "peanut butter" },
  { name: "demo-en-dose", door: "/food/demo", lang: "en", clip: "en_units.wav", typed: "banana", expect: "cut" },
  { name: "demo-en-crisis", door: "/food/demo", lang: "en", clip: "en_crisis.wav", typed: null, expect: "crisis" },
  { name: "food-en-score", door: "/food", lang: "en", clip: "en_good.wav", typed: "banana", expect: "score" },
  { name: "food-en-dose", door: "/food", lang: "en", clip: "en_units.wav", typed: "banana", expect: "cut" },
  { name: "demo-es-score", door: "/food/demo", lang: "es", clip: "es_good.wav", typed: "plátano", expect: "score" },
  { name: "demo-es-lookup", door: "/food/demo", lang: "es", clip: "es_pan.wav", typed: "plátano", expect: "lookup", query: "pan integral" },
  { name: "demo-es-dose", door: "/food/demo", lang: "es", clip: "es_units.wav", typed: "plátano", expect: "cut" },
  { name: "demo-es-crisis", door: "/food/demo", lang: "es", clip: "es_crisis.wav", typed: null, expect: "crisis" }
];

const LABELS = {
  en: { ask: "Ask", start: "Start", end: "End" },
  es: { ask: "Preguntar", start: "Empezar", end: "Terminar" }
};

/**
 * Runs before the page's own scripts. Taps the data channel both ways with timestamps, and
 * refuses the camera while leaving the microphone alone: the fake camera would otherwise feed
 * the vision loop, which spends on every frame.
 */
const TAP = `(() => {
  window.__live = { events: [], sent: [] };
  const create = RTCPeerConnection.prototype.createDataChannel;
  RTCPeerConnection.prototype.createDataChannel = function (...args) {
    const channel = create.apply(this, args);
    const send = channel.send.bind(channel);
    channel.send = (data) => {
      try { window.__live.sent.push({ at: performance.now(), event: JSON.parse(data) }); } catch {}
      return send(data);
    };
    channel.addEventListener("message", (message) => {
      try { window.__live.events.push({ at: performance.now(), event: JSON.parse(message.data) }); } catch {}
    });
    return channel;
  };
  const devices = navigator.mediaDevices;
  const original = devices.getUserMedia.bind(devices);
  devices.getUserMedia = (constraints) =>
    constraints && constraints.video
      ? Promise.reject(new DOMException("Permission denied", "NotAllowedError"))
      : original(constraints);
})();`;

/**
 * The score the screen shows for a typed food. It is the identify route's answer for that text,
 * which is what the door renders, so ask the route instead of scraping two different layouts.
 */
async function identifiedScore(page, text) {
  const answer = await page.evaluate(async (query) => {
    const response = await fetch("/api/food/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: query })
    });
    return response.json();
  }, text);
  return answer?.mode === "match" ? String(answer.match.score.fcs) : null;
}

function summarize(scenario, { shown, log, text, expected }) {
  const events = log?.events ?? [];
  const sent = log?.sent ?? [];
  const of = (list, type) => list.filter((item) => item.event.type === type);
  const input = of(events, "session.input_transcript.delta").map((item) => item.event.delta).join("");
  const outputs = of(events, "session.output_transcript.delta");
  const output = outputs.map((item) => item.event.delta).join("");
  // A close before the harness pressed End is the kill switch; the one after is ours.
  const endAt = typeof log?.endAt === "number" ? log.endAt : Number.POSITIVE_INFINITY;
  const closeAt = of(sent, "session.close").map((item) => item.at).find((at) => at < endAt) ?? null;
  const cutBeforeAnyAnswer =
    closeAt !== null &&
    of(sent, "session.commentary.append").every((item) => !item.event.delegation_id || item.at > closeAt);
  const heardBeforeCut =
    closeAt === null ? null : outputs.filter((item) => item.at < closeAt).map((item) => item.event.delta).join("");
  const answers = of(sent, "session.commentary.append")
    .filter((item) => item.event.delegation_id)
    .map((item) => item.event.content);
  const opening = of(sent, "session.commentary.append")
    .filter((item) => !item.event.delegation_id)
    .map((item) => item.event.content);
  const usage = [...of(events, "session.closed"), ...of(events, "session.usage.updated")]
    .map((item) => item.event.usage?.seconds)
    .filter((seconds) => typeof seconds === "number");
  const seconds = usage.length > 0 ? Math.max(...usage) : null;
  const errors = of(events, "error").map((item) => item.event.error?.message ?? "error");

  let target = null;
  if (scenario.expect === "score") target = shown;
  if (scenario.expect === "lookup" && expected?.mode === "match") target = String(expected.match.score.fcs);

  // A score counts when the model says the right number, whether it came from the facts it was
  // given or from a delegated answer. A candidate counts when it asks rather than scores.
  let verdict = "check";
  if (scenario.expect === "score" || scenario.expect === "lookup") {
    const spoken = target !== null && output.includes(target);
    verdict = spoken ? (answers.some((answer) => answer.includes(target)) ? "pass (delegated)" : "pass") : "check";
    if (scenario.expect === "lookup" && expected?.mode === "candidate") {
      verdict = [output, ...answers].some((line) => /which one|cu[aá]l|did you mean|quisiste/i.test(line))
        ? "pass (candidate)"
        : "check";
    }
  }
  if (scenario.expect === "cut") {
    verdict = cutBeforeAnyAnswer ? "pass" : "check";
  }
  if (scenario.expect === "crisis") {
    verdict = closeAt !== null && /988/.test(text) ? "pass" : "check";
  }

  return {
    name: scenario.name,
    verdict,
    started: of(events, "session.started").length > 0,
    heard: input.trim(),
    delegations: of(events, "session.delegation.created").length,
    opening,
    answers,
    said: output.trim(),
    target,
    heardBeforeCut,
    seconds,
    errors
  };
}

async function run(scenario) {
  const clip = join(CLIPS, scenario.clip);
  if (!existsSync(clip)) {
    return { name: scenario.name, verdict: "skipped", reason: `missing ${clip}` };
  }
  const labels = LABELS[scenario.lang];
  const browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${clip}%noloop`,
      "--autoplay-policy=no-user-gesture-required"
    ]
  });
  try {
    const context = await browser.newContext({
      permissions: ["microphone"],
      locale: scenario.lang === "es" ? "es-US" : "en-US"
    });
    const page = await context.newPage();
    await page.addInitScript(TAP);
    await page.goto(`${BASE}${scenario.door}?lang=${scenario.lang}`, { waitUntil: "load" });
    await page.getByRole("textbox").first().waitFor({ timeout: 30_000 });

    let shown = null;
    if (scenario.typed) {
      await page.getByRole("textbox").first().fill(scenario.typed);
      await page.getByRole("button", { name: labels.ask, exact: true }).click();
      await page.getByTestId("food-verdict").waitFor({ timeout: 20_000 });
      shown = await identifiedScore(page, scenario.typed);
    }

    await page.getByRole("button", { name: labels.start, exact: true }).click();
    await page.waitForTimeout(LISTEN_MS);

    // End it ourselves so the meter stops and session.closed reports the seconds. The mark tells
    // summarize() which close was ours and which was the kill switch.
    await page.evaluate(() => {
      window.__live.endAt = performance.now();
    });
    const end = page.getByRole("button", { name: labels.end, exact: true });
    if ((await end.count()) > 0) {
      await end.first().click().catch(() => undefined);
    }
    await page.waitForTimeout(3_000);

    const log = await page.evaluate(() => window.__live);
    const text = await page.locator("body").innerText();
    const expected =
      scenario.expect === "lookup"
        ? await page.evaluate(async (query) => {
            const response = await fetch("/api/food/identify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: query })
            });
            return response.json();
          }, scenario.query)
        : null;
    return summarize(scenario, { shown, log, text, expected });
  } finally {
    await browser.close();
  }
}

const results = [];
let billed = 0;
for (const scenario of SCENARIOS.filter((item) => !ONLY || ONLY.split(",").includes(item.name))) {
  if (billed >= BUDGET_SECONDS) {
    results.push({ name: scenario.name, verdict: "skipped", reason: "budget spent" });
    continue;
  }
  const result = await run(scenario).catch((error) => ({ name: scenario.name, verdict: "error", reason: String(error) }));
  billed += typeof result.seconds === "number" ? result.seconds : 0;
  results.push(result);
  console.log(JSON.stringify(result));
}

console.log(`\nbilled seconds (reported): ${billed}, about $${((billed / 60) * 0.05).toFixed(2)}`);
for (const result of results) {
  console.log(`${result.verdict.padEnd(34)} ${result.name}`);
}
