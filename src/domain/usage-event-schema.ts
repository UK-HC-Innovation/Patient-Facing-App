/**
 * The runtime half of the usage vocabulary.
 *
 * Split out of `./usage-event.ts` because that module is reached from the client through the
 * root layout, which puts it on the first load of every route; the Food Lens bundle budget
 * in `scripts/check-ladder-bundle.mjs` is what made the cost visible. Only the two sinks --
 * `/api/usage` and `src/server/usage-log.ts` -- ever validate, and neither runs in a browser.
 *
 * The string tiers below are the redaction boundary described in `./usage-event.ts`. They
 * are split by who supplies the value.
 *
 * `token` bounds a machine-generated value -- the session id, the build id. Identifier
 * shaped and length capped, nothing more, because no human value reaches these.
 *
 * `slug` bounds every value a developer or a running junction supplies. It is `token` plus
 * two refusals a plain slug does not give you, both found by the redaction test rather than
 * by guessing: it must contain a letter, and it may not contain a run of four digits.
 * Without those, `1962-04-11` is a valid slug and a date of birth would pass straight
 * through. The letter rule also kills a bare reading like `312`, and the digit-run rule
 * kills years, record numbers, zip+4 and phone fragments. No identifier this codebase
 * emits needs four consecutive digits.
 *
 * `signature` gets its own exact shape rather than reusing `slug`, because a 32-bit digest
 * can come out all digits and would fail the letter rule at random.
 */

import { z } from "zod";
import { USAGE_DECISIONS, USAGE_PROBLEMS, USAGE_ROUTES, USAGE_SOURCES } from "./usage-event";

const TOKEN = /^[a-z0-9][a-z0-9_.:-]{0,39}$/u;
const HAS_LETTER = /[a-z]/u;
const DIGIT_RUN = /\d{4}/u;

const token = z.string().regex(TOKEN);
const slug = token.refine((value) => HAS_LETTER.test(value) && !DIGIT_RUN.test(value), {
  message: "must read as an identifier, not as a date, reading or record number"
});
const signature = z.string().regex(/^[0-9a-f]{8}$/u);

const viewEvent = z.object({
  kind: z.literal("view"),
  route: z.enum(USAGE_ROUTES)
});

const actionEvent = z.object({
  kind: z.literal("action"),
  route: z.enum(USAGE_ROUTES),
  action: slug
});

const decisionEvent = z.object({
  kind: z.literal("decision"),
  decision: z.enum(USAGE_DECISIONS),
  outcome: slug,
  source: z.enum(USAGE_SOURCES),
  tags: z.array(slug).max(8).optional(),
  inputSignature: signature.optional(),
  confidence: z.number().min(0).max(1).optional(),
  latencyMs: z.number().int().min(0).max(600_000).optional()
});

const problemEvent = z.object({
  kind: z.literal("problem"),
  problem: z.enum(USAGE_PROBLEMS),
  where: slug,
  code: slug.optional(),
  attempt: z.number().int().min(1).max(99).optional()
});

const envelope = z.object({
  seq: z.number().int().min(0),
  at: z.number().int().min(0)
});

export const usageEventSchema = z.intersection(
  envelope,
  z.discriminatedUnion("kind", [viewEvent, actionEvent, decisionEvent, problemEvent])
);

export const usageBatchSchema = z.object({
  session: token,
  surface: z.enum(["full", "foodlens"]),
  build: token,
  lang: z.enum(["en", "es"]),
  viewport: z.enum(["narrow", "wide"]),
  startedAt: z.string().datetime(),
  dropped: z.number().int().min(0).max(1_000_000),
  events: z.array(usageEventSchema).min(1).max(200)
});
