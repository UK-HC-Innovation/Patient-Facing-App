import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const DISCLOSURE_VERSION = "2026-08-31";
const PACKAGE_MAX_IMAGE_CHARS = 3_600_000;
const LIVE_MAX_IMAGE_CHARS = 1_500_000;
const PACKAGE_START_INTERVAL_MS = 10_100;
const SESSION_RENEW_SAFETY_MS = 120_000;
const RELEASE_POLICY_VERSION = "package-label-v1";
const RELEASE_START_TIMEOUT_MS = 60_000;
const SUBGROUP_FIELDS = ["language", "packageType", "glare", "skew", "crop", "size"];
const SUBGROUP_TAXONOMY = Object.freeze({
  language: new Set(["en", "es", "bilingual"]),
  packageType: new Set(["pouch", "bag", "box", "can", "bottle", "tub", "wrapper", "mixed"]),
  glare: new Set(["none", "mild", "strong", "present"]),
  skew: new Set(["none", "mild", "strong", "present"]),
  crop: new Set(["none", "partial", "tight"]),
  size: new Set(["small", "medium", "large"])
});
const CONDITION = Object.freeze({
  dualColumn: "condition_001",
  multiplePackages: "condition_002",
  similarColorway: "condition_003",
  reportedRegression: "condition_004"
});
const REQUIRED_CONDITIONS = Object.freeze(Object.values(CONDITION));
const FORBIDDEN_UNCONFIRMED_KEYS = new Set([
  "match",
  "score",
  "fcs",
  "fcs2",
  "tier",
  "alternatives",
  "nutrients",
  "estimatedDomains",
  "coverage",
  "domains"
]);
const NUTRITION_FIELDS = [
  "calories",
  "sodiumMg",
  "potassiumMg",
  "totalSugarsG",
  "addedSugarsG",
  "saturatedFatG",
  "fiberG",
  "proteinG",
  "carbsG",
  "totalFatG",
  "monoFatG",
  "polyFatG",
  "transFatG",
  "cholesterolMg",
  "calciumMg",
  "ironMg"
];
const NUTRITION_FACT_KEYS = ["servingSize", "servingGrams", "basis", ...NUTRITION_FIELDS];
const NUTRITION_DRAFT_KEYS = [
  "servingSize",
  "servingGrams",
  "servingsPerContainer",
  "selectedColumnHeading",
  "nutrition",
  "rows",
  "unusableRows",
  "omittedFields",
  "ingredientText",
  "warnings",
  "includedDomains",
  "carveOut",
  "confidence"
];
const NUTRITION_ROW_FIELDS = new Set([
  "calories", "total_fat", "saturated_fat", "trans_fat", "cholesterol", "sodium",
  "total_carbohydrate", "fiber", "total_sugars", "added_sugars", "protein", "potassium",
  "calcium", "iron", "mono_fat", "poly_fat"
]);
const NULL_TRUTH_REASONS = new Set(["omitted", "unreadable", "upper_bound"]);
const RELEASE_POLICY = Object.freeze({
  minimumCases: { front: 60, nutrition: 40, live: 20 },
  clearCoverageFloor: { front: 0.85, nutrition: 0.8 },
  minimumClearPerRequiredCell: 5,
  maximumCaps: {
    meanUpperBoundCostUsd: 0.02,
    caseUpperBoundCostUsd: 0.05,
    p95LatencyMs: 30_000
  },
  minimumRequiredValues: {
    language: 2,
    packageType: 5,
    glare: 2,
    skew: 2,
    crop: 2,
    size: 3
  }
});

function options(argv) {
  const result = {
    baseUrl: "http://127.0.0.1:3000",
    baseUrlProvided: false,
    manifest: "docs/qa/package-label-eval/manifest.local.json",
    release: false,
    selfTest: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--release") result.release = true;
    else if (value === "--self-test") result.selfTest = true;
    else if (value === "--base-url") {
      result.baseUrl = argv[++index];
      result.baseUrlProvided = true;
    }
    else if (value === "--manifest") result.manifest = argv[++index];
    else if (value === "--help") {
      console.log("Usage: npm run eval:package-label -- --manifest <private.json> [--base-url URL] [--release]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${value}`);
  }
  return result;
}

function childOutputError(label, code, chunks) {
  const output = Buffer.concat(chunks).toString("utf8").slice(-8_000).trim();
  return new Error(`${label} failed with exit code ${code}${output ? `: ${output}` : ""}`);
}

function runCommand(command, args, { env = process.env, label = command } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(childOutputError(label, code, chunks));
    });
  });
}

async function availableLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a loopback port")));
        return;
      }
      const port = address.port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function sourceSnapshot() {
  const commit = (await runCommand("git", ["rev-parse", "HEAD"], { label: "git revision" }))
    .toString("utf8")
    .trim();
  if (!/^[a-f0-9]{40,64}$/u.test(commit)) throw new Error("Could not resolve a concrete git revision");
  const [diff, status, untracked] = await Promise.all([
    runCommand("git", ["diff", "--binary", "HEAD", "--"], { label: "git diff" }),
    runCommand("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { label: "git status" }),
    runCommand("git", ["ls-files", "--others", "--exclude-standard", "-z"], { label: "git untracked files" })
  ]);
  const digest = createHash("sha256").update(commit).update(diff).update(status);
  const names = untracked
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  for (const name of names) {
    digest.update(name);
    digest.update(await readFile(path.resolve(name)));
  }
  const workingTreeHash = digest.digest("hex");
  const dirty = status.length > 0;
  return {
    commit,
    dirty,
    workingTreeHash,
    label: `${commit}${dirty ? `+dirty.${workingTreeHash.slice(0, 16)}` : ""}`
  };
}

async function exitsWithin(exited, milliseconds) {
  return Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), milliseconds))
  ]);
}

async function terminateProcessTree(child, exited, hasExited, label) {
  if (hasExited()) {
    await exited;
    return;
  }
  if (!Number.isSafeInteger(child.pid) || child.pid <= 0) {
    throw new Error(`${label} has no valid process id for cleanup`);
  }
  if (process.platform === "win32") {
    try {
      await runCommand("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        label: `${label} process-tree cleanup`
      });
    } catch (error) {
      if (!hasExited()) throw error;
    }
  } else {
    child.kill("SIGTERM");
    if (!(await exitsWithin(exited, 5_000))) child.kill("SIGKILL");
  }
  if (!(await exitsWithin(exited, 5_000))) {
    throw new Error(`${label} did not exit after process-tree termination`);
  }
}

function releaseDistDirectory() {
  const name = `.next-package-eval-${randomBytes(12).toString("hex")}`;
  return { name, absolute: path.resolve(name) };
}

async function removeReleaseDistDirectory(directory) {
  const root = path.resolve(".");
  if (
    path.dirname(directory.absolute) !== root ||
    path.basename(directory.absolute) !== directory.name ||
    !/^\.next-package-eval-[a-f0-9]{24}$/u.test(directory.name)
  ) {
    throw new Error("Refusing to remove an invalid evaluator build directory");
  }
  await rm(directory.absolute, { recursive: true, force: true });
}

async function verifyServedBuildArtifact(baseUrl, directory, buildId) {
  const diskBuildId = (await readFile(path.join(directory.absolute, "BUILD_ID"), "utf8")).trim();
  if (diskBuildId !== buildId) {
    throw new Error("The evaluator build artifact changed on disk");
  }
  const response = await fetch(endpoint(baseUrl, `/_next/static/${encodeURIComponent(buildId)}/_buildManifest.js`), {
    redirect: "error",
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) {
    throw new Error(`The running server is not serving evaluator build ${buildId}`);
  }
  const body = await response.text();
  if (!body.includes("__BUILD_MANIFEST")) {
    throw new Error("The served evaluator build manifest has an unexpected shape");
  }
}

async function startReleaseServer() {
  const passcode = randomBytes(32).toString("base64url");
  const attestation = randomBytes(32).toString("base64url");
  const buildId = `eval-${randomBytes(16).toString("hex")}`;
  const distDirectory = releaseDistDirectory();
  const beforeBuild = await sourceSnapshot();
  const env = {
    ...process.env,
    DEMO_PASSCODE: passcode,
    FOOD_PACKAGE_SESSION_SECRET: randomBytes(48).toString("base64url"),
    FOOD_PACKAGE_SCAN_ENABLED: "1",
    NEXT_PUBLIC_FOOD_PACKAGE_SCAN: "1",
    NEXT_DIST_DIR: distDirectory.name,
    PACKAGE_LABEL_EVAL_ATTESTATION: attestation,
    PACKAGE_LABEL_EVAL_BUILD_ID: buildId,
    PACKAGE_LABEL_EVAL_SOURCE_REVISION: beforeBuild.label,
    NEXT_TELEMETRY_DISABLED: "1"
  };
  const nextCli = path.resolve("node_modules/next/dist/bin/next");
  try {
    await runCommand(process.execPath, [nextCli, "build"], { env, label: "release eval Next build" });
    const artifactBuildId = (await readFile(path.join(distDirectory.absolute, "BUILD_ID"), "utf8")).trim();
    if (artifactBuildId !== buildId) {
      throw new Error("Next build did not preserve the evaluator's precommitted build id");
    }
    const afterBuild = await sourceSnapshot();
    if (
      beforeBuild.commit !== afterBuild.commit ||
      beforeBuild.workingTreeHash !== afterBuild.workingTreeHash
    ) {
      throw new Error("The checkout changed while the release evaluator was building it");
    }
  } catch (error) {
    try {
      await removeReleaseDistDirectory(distDirectory);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Release build and artifact cleanup both failed");
    }
    throw error;
  }
  const revision = {
    ...beforeBuild,
    buildId,
    label: `${beforeBuild.label}+build.${buildId}`
  };
  let port;
  try {
    port = await availableLoopbackPort();
  } catch (error) {
    try {
      await removeReleaseDistDirectory(distDirectory);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Port allocation and artifact cleanup both failed");
    }
    throw error;
  }
  const baseUrl = `http://127.0.0.1:${port}`;
  const chunks = [];
  const child = spawn(process.execPath, [nextCli, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: process.cwd(),
    env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  let exitCode;
  const exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      exitCode = code;
      resolve();
    });
  });
  const killOnParentExit = () => child.kill();
  process.once("exit", killOnParentExit);
  const deadline = Date.now() + RELEASE_START_TIMEOUT_MS;
  try {
    while (Date.now() < deadline) {
      if (exitCode !== undefined) throw childOutputError("release eval Next server", exitCode, chunks);
      let ready;
      try {
        ready = await fetch(endpoint(baseUrl, "/api/food/package/session"), {
          redirect: "error",
          signal: AbortSignal.timeout(2_000)
        });
      } catch {
        await Promise.race([
          exited,
          new Promise((resolve) => setTimeout(resolve, 250))
        ]);
        continue;
      }

      const expectedIdentity = {
        attestation,
        buildId,
        sourceRevision: beforeBuild.label
      };
      requireReleaseIdentity(ready, expectedIdentity, "Release readiness response");
      let readinessBody;
      try {
        readinessBody = await ready.json();
      } catch {
        throw new Error(`Release readiness returned non-JSON (${ready.status})`);
      }
      if (!ready.ok || typeof readinessBody.authorized !== "boolean") {
        throw new Error(`Release package service is not ready (${ready.status}, ${readinessBody.mode ?? "unknown"})`);
      }
      await verifyServedBuildArtifact(baseUrl, distDirectory, buildId);
      const initialSession = await openSession(baseUrl, passcode, expectedIdentity);
      let stopping = null;
      return {
        attestation,
        baseUrl,
        buildId,
        initialSession,
        passcode,
        revision,
        sourceRevision: beforeBuild.label,
        async verify() {
          const identityResponse = await fetch(endpoint(baseUrl, "/api/food/package/session"), {
            redirect: "error",
            signal: AbortSignal.timeout(5_000)
          });
          requireReleaseIdentity(identityResponse, expectedIdentity, "Release completion response");
          if (!identityResponse.ok) {
            throw new Error(`Release package service failed its completion check (${identityResponse.status})`);
          }
          await verifyServedBuildArtifact(baseUrl, distDirectory, buildId);
        },
        async stop() {
          if (stopping) return stopping;
          stopping = (async () => {
            await terminateProcessTree(
              child,
              exited,
              () => exitCode !== undefined,
              "release eval Next server"
            );
            process.removeListener("exit", killOnParentExit);
            await removeReleaseDistDirectory(distDirectory);
          })();
          return stopping;
        }
      };
    }
    throw new Error("Release eval Next server did not become ready in time");
  } catch (error) {
    try {
      await terminateProcessTree(
        child,
        exited,
        () => exitCode !== undefined,
        "release eval Next server"
      );
      process.removeListener("exit", killOnParentExit);
      await removeReleaseDistDirectory(distDirectory);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Release server startup and cleanup both failed");
    }
    throw error;
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validCorpusId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(value);
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function tokens(value) {
  return new Set(
    String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
  );
}

function hasEveryToken(text, required = []) {
  const actual = tokens(text);
  return required.every((token) => actual.has(String(token).toLowerCase()));
}

function hasNoToken(text, forbidden = []) {
  const actual = tokens(text);
  return forbidden.every((token) => !actual.has(String(token).toLowerCase()));
}

function forbiddenKeyPaths(value, currentPath = "$") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => forbiddenKeyPaths(item, `${currentPath}[${index}]`));
  }
  if (!isPlainObject(value)) return [];
  const paths = [];
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (FORBIDDEN_UNCONFIRMED_KEYS.has(key)) paths.push(childPath);
    paths.push(...forbiddenKeyPaths(child, childPath));
  }
  return paths;
}

function wilson(successes, total, z = 1.96) {
  if (total === 0) return { rate: null, low: null, high: null };
  const p = successes / total;
  const denominator = 1 + z ** 2 / total;
  const center = (p + z ** 2 / (2 * total)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p) + z ** 2 / (4 * total)) / total)) / denominator;
  return {
    rate: p,
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin)
  };
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(quantile * ordered.length) - 1)];
}

function mean(values) {
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;
}

async function normalizedJpeg(filePath, kind) {
  const source = await readFile(filePath);
  const pipeline = sharp(source, { failOn: "error" }).autoOrient();
  const edge = kind === "live" ? 768 : 2048;
  let quality = kind === "live" ? 70 : 90;
  let width = edge;
  const maximumChars = kind === "live" ? LIVE_MAX_IMAGE_CHARS : PACKAGE_MAX_IMAGE_CHARS;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const buffer = await pipeline
      .clone()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    if (dataUrl.length <= maximumChars) {
      const metadata = await sharp(buffer).metadata();
      return {
        dataUrl,
        width: metadata.width,
        height: metadata.height,
        bytes: buffer.length,
        jpegQuality: quality,
        normalizationAttempt: attempt + 1,
        sourceHash: sha256(source)
      };
    }
    if (quality > 58) quality -= 8;
    else width = Math.floor(width * 0.82);
  }
  throw new Error(`Could not normalize ${filePath} below the request cap`);
}

function endpoint(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl.replace(/\/$/u, "")}/`).toString();
}

function requestOrigin(baseUrl) {
  return new URL(baseUrl).origin;
}

function cookieFrom(response) {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("Package session did not set a cookie");
  return header.split(";", 1)[0];
}

function releaseIdentityVerified(response, expectedIdentity) {
  return expectedIdentity !== null && (
    response.headers.get("X-Ladder-Eval-Attestation") === expectedIdentity.attestation &&
    response.headers.get("X-Ladder-Eval-Source-Revision") === expectedIdentity.sourceRevision &&
    response.headers.get("X-Ladder-Eval-Build-Id") === expectedIdentity.buildId
  );
}

function requireReleaseIdentity(response, expectedIdentity, label) {
  if (expectedIdentity !== null && !releaseIdentityVerified(response, expectedIdentity)) {
    throw new Error(`${label} did not come from the attested checkout and build`);
  }
}

async function openSession(baseUrl, passcode, expectedIdentity = null) {
  const response = await fetch(endpoint(baseUrl, "/api/food/package/session"), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
    headers: {
      "Content-Type": "application/json",
      Origin: requestOrigin(baseUrl),
      "Sec-Fetch-Site": "same-origin"
    },
    body: JSON.stringify({ passcode, disclosureVersion: DISCLOSURE_VERSION })
  });
  requireReleaseIdentity(response, expectedIdentity, "Package session response");
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Package session returned non-JSON (${response.status})`);
  }
  if (!response.ok || body.authorized !== true) {
    throw new Error(`Package session failed (${response.status}, ${body.mode ?? "unknown"})`);
  }
  if (!Number.isSafeInteger(body.expiresAt) || body.expiresAt <= Date.now()) {
    throw new Error("Package session returned an invalid expiry");
  }
  return { cookie: cookieFrom(response), expiresAt: body.expiresAt };
}

function createPackageCoordinator({
  openSessionFn,
  initialSession = null,
  initialSessionRouteRequests = 0,
  clock = () => Date.now(),
  sleepFn = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
}) {
  let session = initialSession;
  let nextPackageStartAt = 0;
  let sessionRouteRequests = initialSessionRouteRequests;
  return {
    async prepare() {
      const waitMs = Math.max(0, nextPackageStartAt - clock());
      if (waitMs > 0) await sleepFn(waitMs);
      let now = clock();
      if (!session || now >= session.expiresAt - SESSION_RENEW_SAFETY_MS) {
        sessionRouteRequests += 1;
        session = await openSessionFn();
        now = clock();
      }
      nextPackageStartAt = now + PACKAGE_START_INTERVAL_MS;
      return session.cookie;
    },
    stats() {
      return { sessionRouteRequests, nextPackageStartAt };
    }
  };
}

function assertStringArray(value, label, { minimum = 0 } = {}) {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.some((item) => typeof item !== "string" || item.trim().length === 0) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${label} must be an array of distinct non-empty strings`);
  }
}

function validateNutritionTruth(truth, label) {
  if (!isPlainObject(truth) || !exactKeys(truth, NUTRITION_FIELDS)) {
    throw new Error(`${label} must declare exactly all ${NUTRITION_FIELDS.length} nutrition fields`);
  }
  for (const field of NUTRITION_FIELDS) {
    const entry = truth[field];
    if (!isPlainObject(entry) || !["exact", "null"].includes(entry.state)) {
      throw new Error(`${label}.${field} must have state exact or null`);
    }
    if (entry.state === "exact") {
      if (!exactKeys(entry, ["state", "value"]) || !Number.isFinite(entry.value) || entry.value < 0) {
        throw new Error(`${label}.${field} exact truth needs one non-negative finite value`);
      }
    } else if (
      !exactKeys(entry, ["state", "reason"]) ||
      !NULL_TRUTH_REASONS.has(entry.reason)
    ) {
      throw new Error(`${label}.${field} null truth needs reason omitted, unreadable, or upper_bound`);
    }
  }
}

function validateExpected(testCase, label) {
  const expected = testCase.expected;
  if (!isPlainObject(expected)) throw new Error(`${label}.expected is required`);
  assertStringArray(expected.alternateModes ?? [], `${label}.expected.alternateModes`);
  assertStringArray(expected.allowedRescanReasons ?? [], `${label}.expected.allowedRescanReasons`);
  const allowedPrimary =
    testCase.kind === "front"
      ? ["front", "needs_rescan"]
      : testCase.kind === "nutrition"
        ? ["nutrition", "needs_rescan"]
        : ["package", "candidate", "none"];
  if (!allowedPrimary.includes(expected.primaryMode)) {
    throw new Error(`${label}.expected.primaryMode is invalid for ${testCase.kind}`);
  }
  const allowedAlternates =
    testCase.kind === "live"
      ? new Set(["package", "candidate", "none"])
      : new Set(["needs_rescan"]);
  if ((expected.alternateModes ?? []).some((mode) => !allowedAlternates.has(mode))) {
    throw new Error(`${label}.expected.alternateModes contains an invalid mode`);
  }
  if (
    [expected.primaryMode, ...(expected.alternateModes ?? [])].includes("needs_rescan") &&
    (expected.allowedRescanReasons ?? []).length === 0
  ) {
    throw new Error(`${label} permits needs_rescan but has no allowedRescanReasons`);
  }
}

function acceptedModeIsPossible(testCase, mode) {
  return [testCase.expected.primaryMode, ...(testCase.expected.alternateModes ?? [])].includes(mode);
}

function validateIdentity(identity, label) {
  if (!isPlainObject(identity)) throw new Error(`${label} is required`);
  assertStringArray(identity.requiredTokens, `${label}.requiredTokens`, { minimum: 1 });
  assertStringArray(identity.forbiddenTokens, `${label}.forbiddenTokens`, { minimum: 1 });
  assertStringArray(identity.categoryTokens, `${label}.categoryTokens`, { minimum: 1 });
}

function validateSubgroups(subgroups, label) {
  if (!exactKeys(subgroups, [...SUBGROUP_FIELDS, "conditions"])) {
    throw new Error(`${label} must declare only the fixed subgroup fields and conditions`);
  }
  for (const field of SUBGROUP_FIELDS) {
    if (typeof subgroups[field] !== "string" || !SUBGROUP_TAXONOMY[field].has(subgroups[field])) {
      throw new Error(`${label}.${field} is outside the fixed subgroup taxonomy`);
    }
  }
  assertStringArray(subgroups.conditions, `${label}.conditions`);
  if (subgroups.conditions.some((condition) => !REQUIRED_CONDITIONS.includes(condition))) {
    throw new Error(`${label}.conditions contains an unknown opaque condition id`);
  }
}

function validateServingTruth(testCase, label) {
  if (testCase.servingBasis !== "per_serving" || testCase.columnTarget !== "per_serving") {
    throw new Error(`${label} must preregister per_serving basis and columnTarget`);
  }
  const serving = testCase.servingTruth;
  const keys = ["servingSize", "servingGrams", "servingsPerContainer", "selectedColumnHeading"];
  if (!exactKeys(serving, keys)) throw new Error(`${label}.servingTruth must declare exactly ${keys.join(", ")}`);
  if (typeof serving.servingSize !== "string" || serving.servingSize.length === 0) {
    throw new Error(`${label}.servingTruth.servingSize must be a non-empty string`);
  }
  if (serving.servingGrams !== null && (!Number.isFinite(serving.servingGrams) || serving.servingGrams <= 0)) {
    throw new Error(`${label}.servingTruth.servingGrams must be null or a positive number`);
  }
  for (const field of ["servingsPerContainer", "selectedColumnHeading"]) {
    if (serving[field] !== null && typeof serving[field] !== "string") {
      throw new Error(`${label}.servingTruth.${field} must be string or null`);
    }
  }
}

function validateReleaseCorpusCapacity(manifest) {
  for (const [kind, minimum] of Object.entries(RELEASE_POLICY.minimumCases)) {
    const count = manifest.cases.filter((testCase) => testCase.kind === kind).length;
    if (count < minimum) {
      throw new Error(`release corpus needs at least ${minimum} ${kind} cases before evaluation`);
    }
  }
  for (const kind of ["front", "nutrition"]) {
    for (const field of SUBGROUP_FIELDS) {
      for (const value of manifest.releaseCriteria.requiredSubgroups[kind][field]) {
        const clearCount = manifest.cases.filter(
          (testCase) => testCase.kind === kind && testCase.clear && testCase.subgroups[field] === value
        ).length;
        if (clearCount < RELEASE_POLICY.minimumClearPerRequiredCell) {
          throw new Error(
            `${kind}:${field}=${value} needs at least ${RELEASE_POLICY.minimumClearPerRequiredCell} preregistered clear cases before evaluation`
          );
        }
      }
    }
  }
}

function validateReleaseConfiguration(manifest) {
  if (!validCorpusId(manifest.corpusId)) {
    throw new Error("corpusId must be an 8-128 character reviewed opaque identifier");
  }
  if (manifest.releasePolicyVersion !== RELEASE_POLICY_VERSION) {
    throw new Error(`releasePolicyVersion must be ${RELEASE_POLICY_VERSION}`);
  }
  if (!isPlainObject(manifest.expectedModels)) throw new Error("expectedModels is required");
  assertStringArray(manifest.expectedModels.package, "expectedModels.package", { minimum: 1 });
  assertStringArray(manifest.expectedModels.live, "expectedModels.live", { minimum: 1 });
  if ([...manifest.expectedModels.package, ...manifest.expectedModels.live].some(
    (model) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(model)
  )) {
    throw new Error("expectedModels contains an invalid model identifier");
  }
  if (!isPlainObject(manifest.priceCard) || manifest.priceCard.currency !== "USD") {
    throw new Error("priceCard with USD currency is required");
  }
  if (typeof manifest.priceCard.asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(manifest.priceCard.asOf)) {
    throw new Error("priceCard.asOf must be YYYY-MM-DD");
  }
  if (!isPlainObject(manifest.priceCard.models)) throw new Error("priceCard.models is required");
  const expectedModels = [...manifest.expectedModels.package, ...manifest.expectedModels.live];
  for (const model of expectedModels) {
    const price = manifest.priceCard.models[model];
    if (!exactKeys(price, ["serviceTiers"]) || !isPlainObject(price.serviceTiers)) {
      throw new Error(`priceCard.models.${model}.serviceTiers is required`);
    }
    const tiers = Object.entries(price.serviceTiers);
    if (tiers.length === 0) throw new Error(`priceCard.models.${model}.serviceTiers cannot be empty`);
    for (const [tier, rates] of tiers) {
      if (
        !/^[a-z][a-z0-9_-]{0,63}$/u.test(tier) ||
        !exactKeys(rates, ["inputUsdPer1MTokens", "outputUsdPer1MTokens"]) ||
        !Number.isFinite(rates.inputUsdPer1MTokens) ||
        rates.inputUsdPer1MTokens <= 0 ||
        !Number.isFinite(rates.outputUsdPer1MTokens) ||
        rates.outputUsdPer1MTokens <= 0
      ) {
        throw new Error(`priceCard.models.${model}.serviceTiers.${tier} needs positive input/output prices`);
      }
    }
  }
  const criteria = manifest.releaseCriteria;
  if (!isPlainObject(criteria) || !isPlainObject(criteria.requiredSubgroups)) {
    throw new Error("releaseCriteria.requiredSubgroups is required");
  }
  for (const kind of ["front", "nutrition"]) {
    const byField = criteria.requiredSubgroups[kind];
    if (!isPlainObject(byField)) throw new Error(`releaseCriteria.requiredSubgroups.${kind} is required`);
    for (const field of SUBGROUP_FIELDS) {
      const minimum = RELEASE_POLICY.minimumRequiredValues[field];
      assertStringArray(byField[field], `releaseCriteria.requiredSubgroups.${kind}.${field}`, { minimum });
      if (byField[field].some((value) => !SUBGROUP_TAXONOMY[field].has(value))) {
        throw new Error(`releaseCriteria.requiredSubgroups.${kind}.${field} is outside the fixed taxonomy`);
      }
    }
    const language = byField.language;
    if (!language.includes("en") || (!language.includes("es") && !language.includes("bilingual"))) {
      throw new Error(`releaseCriteria.requiredSubgroups.${kind}.language must cover English and Spanish/bilingual labels`);
    }
    for (const field of ["glare", "skew", "crop"]) {
      if (!byField[field].includes("none") || byField[field].every((value) => value === "none")) {
        throw new Error(`releaseCriteria.requiredSubgroups.${kind}.${field} must cover none and a challenge value`);
      }
    }
  }
  assertStringArray(criteria.requiredConditions, "releaseCriteria.requiredConditions", {
    minimum: REQUIRED_CONDITIONS.length
  });
  for (const condition of REQUIRED_CONDITIONS) {
    if (!criteria.requiredConditions.includes(condition)) {
      throw new Error(`releaseCriteria.requiredConditions must include ${condition}`);
    }
  }
  for (const field of ["maxMeanUpperBoundCostUsd", "maxCaseUpperBoundCostUsd", "maxP95LatencyMs"]) {
    if (!Number.isFinite(criteria[field]) || criteria[field] <= 0) {
      throw new Error(`releaseCriteria.${field} must be a positive number`);
    }
  }
  if (criteria.maxMeanUpperBoundCostUsd > RELEASE_POLICY.maximumCaps.meanUpperBoundCostUsd) {
    throw new Error("releaseCriteria.maxMeanUpperBoundCostUsd exceeds the checked-in policy ceiling");
  }
  if (criteria.maxCaseUpperBoundCostUsd > RELEASE_POLICY.maximumCaps.caseUpperBoundCostUsd) {
    throw new Error("releaseCriteria.maxCaseUpperBoundCostUsd exceeds the checked-in policy ceiling");
  }
  if (criteria.maxP95LatencyMs > RELEASE_POLICY.maximumCaps.p95LatencyMs) {
    throw new Error("releaseCriteria.maxP95LatencyMs exceeds the checked-in policy ceiling");
  }

  const casesFor = (condition, kind) => manifest.cases.filter(
    (testCase) => testCase.kind === kind && testCase.subgroups.conditions.includes(condition)
  );
  if (casesFor(CONDITION.reportedRegression, "front").length === 0 || casesFor(CONDITION.reportedRegression, "live").length === 0) {
    throw new Error(`${CONDITION.reportedRegression} needs both front and live route cases`);
  }
  if (casesFor(CONDITION.similarColorway, "front").length === 0) {
    throw new Error(`${CONDITION.similarColorway} needs a front route case`);
  }
  if (casesFor(CONDITION.dualColumn, "nutrition").length === 0) {
    throw new Error(`${CONDITION.dualColumn} needs a nutrition route case`);
  }
  if (casesFor(CONDITION.multiplePackages, "front").length === 0) {
    throw new Error(`${CONDITION.multiplePackages} needs a front route case`);
  }
  validateReleaseCorpusCapacity(manifest);
}

function validateManifest(manifest, { release }) {
  if (!isPlainObject(manifest) || manifest.schemaVersion !== 2) {
    throw new Error("Manifest schemaVersion must be 2");
  }
  if (
    manifest.corpusId !== undefined &&
    !validCorpusId(manifest.corpusId)
  ) {
    throw new Error("corpusId must be an 8-128 character opaque identifier when provided");
  }
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error("Manifest must contain at least one case");
  }
  const ids = new Set();
  const kindHashes = new Set();
  for (const [index, testCase] of manifest.cases.entries()) {
    const label = `cases[${index}]`;
    if (!isPlainObject(testCase)) throw new Error(`${label} must be an object`);
    if (
      typeof testCase.id !== "string" ||
      !/^(?:front|nutrition|live)-\d{3,6}$/u.test(testCase.id) ||
      !testCase.id.startsWith(`${testCase.kind}-`)
    ) {
      throw new Error(`${label}.id must be an opaque kind-NNN identifier`);
    }
    if (ids.has(testCase.id)) throw new Error(`${label}.id is duplicated`);
    ids.add(testCase.id);
    if (!["front", "nutrition", "live"].includes(testCase.kind)) {
      throw new Error(`${label}.kind must be front, nutrition, or live`);
    }
    if (typeof testCase.path !== "string" || testCase.path.length === 0 || path.isAbsolute(testCase.path)) {
      throw new Error(`${label}.path must be a relative path`);
    }
    if (typeof testCase.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(testCase.sha256)) {
      throw new Error(`${label}.sha256 must be 64 lowercase hexadecimal characters`);
    }
    const kindHash = `${testCase.kind}:${testCase.sha256}`;
    if (kindHashes.has(kindHash)) throw new Error(`${label} duplicates a kind/image pair`);
    kindHashes.add(kindHash);
    if (typeof testCase.clear !== "boolean") throw new Error(`${label}.clear must be boolean`);
    assertStringArray(testCase.reviewers, `${label}.reviewers`, { minimum: 2 });
    if (new Set(testCase.reviewers.map((reviewer) => reviewer.trim().toLowerCase())).size < 2) {
      throw new Error(`${label}.reviewers must name two distinct people`);
    }
    validateExpected(testCase, label);
    validateSubgroups(testCase.subgroups, `${label}.subgroups`);
    if (
      !isPlainObject(testCase.expectedCounts) ||
      testCase.expectedCounts.routeRequests !== 1
    ) {
      throw new Error(`${label}.expectedCounts.routeRequests must be 1`);
    }
    const allowedCalls = testCase.expectedCounts.allowedUpstreamCalls;
    if (
      !Array.isArray(allowedCalls) ||
      allowedCalls.length === 0 ||
      allowedCalls.some((value) => !Number.isSafeInteger(value) || value < 1) ||
      new Set(allowedCalls).size !== allowedCalls.length
    ) {
      throw new Error(`${label}.expectedCounts.allowedUpstreamCalls must contain distinct positive integers`);
    }
    if (release && testCase.kind !== "live" && (allowedCalls.length !== 1 || allowedCalls[0] !== 1)) {
      throw new Error(`${label} must require exactly one package upstream call in release mode`);
    }
    if (
      (testCase.kind === "front" && acceptedModeIsPossible(testCase, "front")) ||
      (testCase.kind === "live" && acceptedModeIsPossible(testCase, "candidate")) ||
      testCase.subgroups.conditions.includes(CONDITION.reportedRegression) ||
      testCase.subgroups.conditions.includes(CONDITION.similarColorway)
    ) {
      validateIdentity(testCase.identity, `${label}.identity`);
    }
    if (testCase.kind === "nutrition" && acceptedModeIsPossible(testCase, "nutrition")) {
      validateNutritionTruth(testCase.nutritionTruth, `${label}.nutritionTruth`);
      validateServingTruth(testCase, label);
    }
    if (testCase.subgroups.conditions.includes(CONDITION.reportedRegression)) {
      const required = testCase.identity.requiredTokens.map((token) => token.toLowerCase());
      const forbidden = testCase.identity.forbiddenTokens.map((token) => token.toLowerCase());
      if (!required.includes("edamame") || !required.includes("ranch") || !forbidden.includes("doritos")) {
        throw new Error(`${label} edamame_ranch truth must require edamame/ranch and forbid doritos`);
      }
      if (testCase.kind === "live" && acceptedModeIsPossible(testCase, "candidate")) {
        throw new Error(`${label} live edamame_ranch must require package abstention or none, never an FNDDS candidate`);
      }
    }
    if (
      testCase.subgroups.conditions.includes(CONDITION.dualColumn) &&
      (testCase.kind !== "nutrition" ||
        testCase.expected.primaryMode !== "needs_rescan" ||
        !testCase.expected.allowedRescanReasons.some((reason) =>
          ["ambiguous_columns", "multiple_columns", "per_container_column", "unclear_column"].includes(reason)
        ))
    ) {
      throw new Error(`${label} dual_column must preregister a column-related nutrition rescan`);
    }
    if (
      testCase.subgroups.conditions.includes(CONDITION.multiplePackages) &&
      (testCase.kind !== "front" ||
        testCase.expected.primaryMode !== "needs_rescan" ||
        !testCase.expected.allowedRescanReasons.includes("multiple_packages"))
    ) {
      throw new Error(`${label} multiple_packages must preregister a front multiple_packages rescan`);
    }
  }
  if (release) validateReleaseConfiguration(manifest);
}

async function preflightSources(manifest, manifestDir) {
  const root = path.resolve(manifestDir);
  for (const testCase of manifest.cases) {
    const filePath = path.resolve(root, testCase.path);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      throw new Error(`${testCase.id}: image path escapes the manifest directory`);
    }
    const source = await readFile(filePath);
    if (sha256(source) !== testCase.sha256) {
      throw new Error(`${testCase.id}: source SHA-256 mismatch`);
    }
  }
}

function allowedMode(testCase, mode) {
  return [testCase.expected.primaryMode, ...(testCase.expected.alternateModes ?? [])].includes(mode);
}

function reportSubgroups(testCase) {
  return {
    ...Object.fromEntries(SUBGROUP_FIELDS.map((field) => [field, testCase.subgroups[field]])),
    conditions: [...testCase.subgroups.conditions]
  };
}

function inspectRescan(testCase, body) {
  const shapeOk = exactKeys(body, ["mode", "kind", "reason"]);
  const reason = isPlainObject(body) && typeof body.reason === "string" ? body.reason : "invalid";
  const reasonAllowed = (testCase.expected.allowedRescanReasons ?? []).includes(reason);
  return {
    pass: shapeOk && allowedMode(testCase, "needs_rescan") && reasonAllowed,
    accepted: false,
    correct: null,
    mode: "needs_rescan",
    reason: reasonAllowed ? reason : "invalid",
    shapeOk,
    reasonAllowed
  };
}

function inspectFront(testCase, body) {
  if (body?.mode === "needs_rescan") return inspectRescan(testCase, body);
  const shapeOk =
    exactKeys(body, ["mode", "candidate"]) &&
    body.mode === "front" &&
    exactKeys(body.candidate, [
      "brand",
      "product",
      "flavor",
      "displayName",
      "visibleText",
      "confidence",
      "quality"
    ]) &&
    [body.candidate.brand, body.candidate.product, body.candidate.flavor].every(
      (value) => value === null || typeof value === "string"
    ) &&
    typeof body.candidate.displayName === "string" &&
    Array.isArray(body.candidate.visibleText) &&
    body.candidate.visibleText.every((value) => typeof value === "string") &&
    Number.isFinite(body.candidate.confidence) &&
    body.candidate.confidence >= 0 &&
    body.candidate.confidence <= 1 &&
    body.candidate.quality === "good";
  if (!shapeOk || !allowedMode(testCase, "front")) {
    return { pass: false, accepted: false, correct: false, mode: "invalid", shapeOk };
  }
  const candidate = body.candidate;
  const identityText = [candidate.brand, candidate.product, candidate.flavor, candidate.displayName]
    .filter((value) => typeof value === "string")
    .join(" ");
  const categoryText = typeof candidate.product === "string" ? candidate.product : "";
  const requiredTokensPreserved = hasEveryToken(identityText, testCase.identity.requiredTokens);
  const forbiddenTokensAbsent = hasNoToken(identityText, testCase.identity.forbiddenTokens);
  const categoryTokensPreserved = hasEveryToken(categoryText, testCase.identity.categoryTokens);
  const correct = requiredTokensPreserved && forbiddenTokensAbsent && categoryTokensPreserved;
  return {
    pass: correct,
    accepted: true,
    correct,
    mode: "front",
    shapeOk,
    requiredTokensPreserved,
    forbiddenTokensAbsent,
    categoryTokensPreserved
  };
}

function validNutritionDraftShape(draft) {
  if (!exactKeys(draft, NUTRITION_DRAFT_KEYS) || !exactKeys(draft.nutrition, NUTRITION_FACT_KEYS)) {
    return false;
  }
  const nutrition = draft.nutrition;
  if (
    typeof draft.servingSize !== "string" ||
    (draft.servingGrams !== null && !Number.isFinite(draft.servingGrams)) ||
    (draft.servingsPerContainer !== null && typeof draft.servingsPerContainer !== "string") ||
    (draft.selectedColumnHeading !== null && typeof draft.selectedColumnHeading !== "string") ||
    typeof nutrition.servingSize !== "string" ||
    (nutrition.servingGrams !== null && !Number.isFinite(nutrition.servingGrams)) ||
    nutrition.basis !== "per_serving" ||
    NUTRITION_FIELDS.some((field) => nutrition[field] !== null && !Number.isFinite(nutrition[field])) ||
    !Array.isArray(draft.rows) ||
    !Array.isArray(draft.unusableRows) ||
    !Array.isArray(draft.omittedFields) ||
    !Array.isArray(draft.warnings) ||
    !Array.isArray(draft.includedDomains) ||
    (draft.ingredientText !== null && typeof draft.ingredientText !== "string") ||
    ![null, "zero_calorie"].includes(draft.carveOut) ||
    !Number.isFinite(draft.confidence) ||
    draft.confidence < 0 ||
    draft.confidence > 1
  ) return false;
  const validRawRow = (row, extraKeys) =>
    exactKeys(row, ["field", "printedLabel", "printedAmount", "printedUnit", ...extraKeys]) &&
    NUTRITION_ROW_FIELDS.has(row.field) &&
    typeof row.printedLabel === "string" &&
    typeof row.printedAmount === "string" &&
    (row.printedUnit === null || typeof row.printedUnit === "string");
  if (draft.rows.some((row) =>
    !validRawRow(row, ["value", "normalizedUnit", "precision"]) ||
    (row.value !== null && !Number.isFinite(row.value)) ||
    !["kcal", "g", "mg"].includes(row.normalizedUnit) ||
    !["exact", "upper_bound"].includes(row.precision)
  )) return false;
  if (draft.unusableRows.some((row) =>
    !validRawRow(row, ["reason"]) ||
    !["label_mismatch", "invalid_amount", "percent_daily_value", "wrong_unit", "above_cap"].includes(row.reason)
  )) return false;
  if (draft.omittedFields.some((field) => !NUTRITION_ROW_FIELDS.has(field))) return false;
  if (draft.includedDomains.some((domain) => !/^D[1-9]$/u.test(domain))) return false;
  return draft.warnings.every((warning) =>
    (exactKeys(warning, ["code", "field"]) &&
      warning.code === "upper_bound_normalized_to_null" &&
      NUTRITION_ROW_FIELDS.has(warning.field)) ||
    (exactKeys(warning, ["code", "calories", "macroCalories", "difference"]) &&
      warning.code === "macro_energy_mismatch" &&
      [warning.calories, warning.macroCalories, warning.difference].every(Number.isFinite))
  );
}

function inspectNutrition(testCase, body) {
  if (body?.mode === "needs_rescan") return inspectRescan(testCase, body);
  const shapeOk =
    exactKeys(body, ["mode", "draft"]) &&
    body.mode === "nutrition" &&
    validNutritionDraftShape(body.draft);
  if (!shapeOk || !allowedMode(testCase, "nutrition")) {
    return { pass: false, accepted: false, correct: false, mode: "invalid", shapeOk };
  }
  const mismatchedFields = [];
  for (const field of NUTRITION_FIELDS) {
    const truth = testCase.nutritionTruth[field];
    const expectedValue = truth.state === "exact" ? truth.value : null;
    if (body.draft.nutrition[field] !== expectedValue) mismatchedFields.push(field);
  }
  const servingMismatches = [];
  const servingPairs = [
    ["servingSize", body.draft.servingSize, testCase.servingTruth.servingSize],
    ["servingGrams", body.draft.servingGrams, testCase.servingTruth.servingGrams],
    ["servingsPerContainer", body.draft.servingsPerContainer, testCase.servingTruth.servingsPerContainer],
    ["selectedColumnHeading", body.draft.selectedColumnHeading, testCase.servingTruth.selectedColumnHeading],
    ["basis", body.draft.nutrition.basis, testCase.servingBasis]
  ];
  for (const [field, actual, expected] of servingPairs) {
    if (actual !== expected) servingMismatches.push(field);
  }
  const correct = mismatchedFields.length === 0 && servingMismatches.length === 0;
  return {
    pass: correct,
    accepted: true,
    correct,
    mode: "nutrition",
    shapeOk,
    mismatchedFields,
    servingMismatches
  };
}

function inspectLive(testCase, body) {
  const forbiddenPaths = forbiddenKeyPaths(body);
  if (!isPlainObject(body) || forbiddenPaths.length > 0) {
    return {
      pass: false,
      accepted: false,
      correct: false,
      mode: "invalid",
      shapeOk: false,
      forbiddenPaths
    };
  }
  if (body.mode === "package") {
    const shapeOk = exactKeys(body, ["mode"]);
    return {
      pass: shapeOk && allowedMode(testCase, "package"),
      accepted: false,
      correct: null,
      mode: "package",
      shapeOk,
      forbiddenPaths
    };
  }
  if (body.mode === "none") {
    const shapeOk = exactKeys(body, ["mode", "candidates"]) && Array.isArray(body.candidates) && body.candidates.length === 0;
    return {
      pass: shapeOk && allowedMode(testCase, "none"),
      accepted: false,
      correct: null,
      mode: "none",
      shapeOk,
      forbiddenPaths
    };
  }
  if (body.mode === "candidate") {
    const shapeOk =
      exactKeys(body, ["mode", "candidate"]) &&
      exactKeys(body.candidate, ["food"]) &&
      exactKeys(body.candidate.food, ["code", "description", "group"]) &&
      [body.candidate.food.code, body.candidate.food.description, body.candidate.food.group].every(
        (value) => typeof value === "string" && value.length > 0
      );
    if (!shapeOk || !allowedMode(testCase, "candidate") || !testCase.identity) {
      return { pass: false, accepted: false, correct: false, mode: "candidate", shapeOk, forbiddenPaths };
    }
    const description = body.candidate.food.description;
    const requiredTokensPreserved = hasEveryToken(description, testCase.identity.requiredTokens);
    const forbiddenTokensAbsent = hasNoToken(description, testCase.identity.forbiddenTokens);
    const categoryTokensPreserved = hasEveryToken(description, testCase.identity.categoryTokens);
    const correct = requiredTokensPreserved && forbiddenTokensAbsent && categoryTokensPreserved;
    return {
      pass: correct,
      accepted: true,
      correct,
      mode: "candidate",
      shapeOk,
      forbiddenPaths,
      requiredTokensPreserved,
      forbiddenTokensAbsent,
      categoryTokensPreserved
    };
  }
  return {
    pass: false,
    accepted: false,
    correct: false,
    mode: "invalid",
    shapeOk: false,
    forbiddenPaths
  };
}

function integerHeader(headers, name) {
  const raw = headers.get(name);
  if (raw === null || !/^\d+$/u.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function providerMetadata(testCase, response, manifest, { requireCost, expectedIdentity = null }) {
  const family = testCase.kind === "live" ? "live" : "package";
  const modelHeader = family === "live" ? "X-Ladder-Live-Model" : "X-Ladder-Package-Model";
  const rawModel = response.headers.get(modelHeader);
  const model = rawModel && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(rawModel) ? rawModel : null;
  const rawServiceTier = response.headers.get("X-Ladder-Service-Tier");
  const serviceTier = rawServiceTier && /^[a-z][a-z0-9_-]{0,63}$/u.test(rawServiceTier)
    ? rawServiceTier
    : null;
  const upstreamCalls = integerHeader(response.headers, "X-Ladder-Upstream-Calls");
  const usageCompleteHeader = response.headers.get("X-Ladder-Usage-Complete");
  const modelCompleteHeader = response.headers.get("X-Ladder-Model-Complete");
  const serviceTierCompleteHeader = response.headers.get("X-Ladder-Service-Tier-Complete");
  const inputTokens = integerHeader(response.headers, "X-Ladder-Input-Tokens");
  const outputTokens = integerHeader(response.headers, "X-Ladder-Output-Tokens");
  const totalTokens = integerHeader(response.headers, "X-Ladder-Total-Tokens");
  const errors = [];
  const attestationVerified = expectedIdentity === null
    ? null
    : releaseIdentityVerified(response, expectedIdentity);
  if (expectedIdentity !== null && !attestationVerified) errors.push("release_attestation_mismatch");
  if (!model) errors.push("missing_or_invalid_model_header");
  if (modelCompleteHeader !== "1") errors.push("model_incomplete");
  if (!serviceTier) errors.push("missing_or_invalid_service_tier");
  if (serviceTierCompleteHeader !== "1") errors.push("service_tier_incomplete");
  if (upstreamCalls === null) errors.push("missing_or_invalid_upstream_calls");
  else if (!testCase.expectedCounts.allowedUpstreamCalls.includes(upstreamCalls)) {
    errors.push("unexpected_upstream_calls");
  }
  if (usageCompleteHeader !== "1") errors.push("usage_incomplete");
  if (
    inputTokens === null ||
    outputTokens === null ||
    totalTokens === null ||
    inputTokens <= 0 ||
    outputTokens <= 0 ||
    totalTokens <= 0
  ) {
    errors.push("missing_or_invalid_usage_tokens");
  } else if (totalTokens !== inputTokens + outputTokens) {
    errors.push("usage_total_mismatch");
  }
  const expectedModels = manifest.expectedModels?.[family] ?? [];
  if (model && expectedModels.length > 0 && !expectedModels.includes(model)) {
    errors.push("unexpected_model");
  }
  let upperBoundCostUsd = null;
  let pricing = null;
  if (model && serviceTier && inputTokens !== null && outputTokens !== null) {
    const price = manifest.priceCard?.models?.[model]?.serviceTiers?.[serviceTier];
    if (
      price &&
      Number.isFinite(price.inputUsdPer1MTokens) &&
      Number.isFinite(price.outputUsdPer1MTokens)
    ) {
      upperBoundCostUsd =
        (inputTokens * price.inputUsdPer1MTokens + outputTokens * price.outputUsdPer1MTokens) /
        1_000_000;
      pricing = {
        currency: manifest.priceCard?.currency ?? null,
        asOf: manifest.priceCard?.asOf ?? null,
        inputUsdPer1MTokens: price.inputUsdPer1MTokens,
        outputUsdPer1MTokens: price.outputUsdPer1MTokens
      };
    } else if (requireCost) {
      errors.push("missing_model_price");
    }
  }
  return {
    model,
    serviceTier,
    attestationVerified,
    usage: {
      complete: usageCompleteHeader === "1",
      inputTokens,
      outputTokens,
      totalTokens
    },
    upperBoundCostUsd,
    pricing,
    upstreamCalls,
    errors
  };
}

function failedNetworkResult(testCase, image, latencyMs, routeRequests, error) {
  return {
    id: testCase.id,
    kind: testCase.kind,
    clear: testCase.clear,
    subgroups: reportSubgroups(testCase),
    dimensions: {
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      dataUrlChars: image.dataUrl.length,
      outputMime: "image/jpeg",
      jpegQuality: image.jpegQuality,
      normalizationAttempt: image.normalizationAttempt
    },
    latencyMs,
    counts: { routeRequests, upstreamCalls: null },
    httpStatus: null,
    mode: "network_error",
    reason: error instanceof Error ? error.name : "network_error",
    accepted: false,
    correct: false,
    pass: false,
    shapeOk: false,
    forbiddenPaths: [],
    provider: {
      model: null,
      serviceTier: null,
      attestationVerified: false,
      usage: { complete: false, inputTokens: null, outputTokens: null, totalTokens: null },
      upperBoundCostUsd: null,
      pricing: null,
      errors: ["network_error"]
    }
  };
}

async function runCase({
  baseUrl,
  coordinator,
  manifest,
  manifestDir,
  passcode,
  release,
  expectedIdentity,
  testCase
}) {
  const filePath = path.resolve(manifestDir, testCase.path);
  const image = await normalizedJpeg(filePath, testCase.kind);
  if (image.sourceHash !== testCase.sha256) throw new Error(`${testCase.id}: source SHA-256 changed after preflight`);
  let routeRequests = 0;
  let response;
  let startedAt = null;
  const packageCookie = testCase.kind === "live" ? null : await coordinator.prepare();
  try {
    if (testCase.kind === "live") {
      startedAt = performance.now();
      routeRequests += 1;
      response = await fetch(endpoint(baseUrl, "/api/food/identify"), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: image.dataUrl, passcode, patientId: "package-label-eval" })
      });
    } else {
      startedAt = performance.now();
      routeRequests += 1;
      response = await fetch(endpoint(baseUrl, "/api/food/package"), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          Cookie: packageCookie,
          Origin: requestOrigin(baseUrl),
          "Sec-Fetch-Site": "same-origin"
        },
        body: JSON.stringify({
          kind: testCase.kind,
          image: image.dataUrl,
          patientId: "package-label-eval"
        })
      });
    }
  } catch (error) {
    return failedNetworkResult(
      testCase,
      image,
      startedAt === null ? 0 : Math.round(performance.now() - startedAt),
      routeRequests,
      error
    );
  }
  if (startedAt === null) throw new Error(`${testCase.id}: request timing was not initialized`);
  const latencyMs = Math.round(performance.now() - startedAt);
  let body;
  try {
    body = JSON.parse(await response.text());
  } catch {
    body = null;
  }
  const assessment =
    testCase.kind === "front"
      ? inspectFront(testCase, body)
      : testCase.kind === "nutrition"
        ? inspectNutrition(testCase, body)
        : inspectLive(testCase, body);
  const leakPaths = forbiddenKeyPaths(body);
  const metadata = providerMetadata(testCase, response, manifest, {
    requireCost: release,
    expectedIdentity
  });
  const routeCountOk = routeRequests === testCase.expectedCounts.routeRequests;
  const httpOk = response.ok;
  const noLeak = leakPaths.length === 0;
  const pass = assessment.pass && routeCountOk && httpOk && noLeak && metadata.errors.length === 0;
  return {
    id: testCase.id,
    kind: testCase.kind,
    clear: testCase.clear,
    subgroups: reportSubgroups(testCase),
    dimensions: {
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      dataUrlChars: image.dataUrl.length,
      outputMime: "image/jpeg",
      jpegQuality: image.jpegQuality,
      normalizationAttempt: image.normalizationAttempt
    },
    latencyMs,
    counts: { routeRequests, upstreamCalls: metadata.upstreamCalls },
    httpStatus: response.status,
    responseContentType: response.headers.get("content-type")?.split(";", 1)[0] ?? null,
    ...assessment,
    forbiddenPaths: leakPaths,
    routeCountOk,
    httpOk,
    provider: {
      model: metadata.model,
      serviceTier: metadata.serviceTier,
      attestationVerified: metadata.attestationVerified,
      usage: metadata.usage,
      upperBoundCostUsd: metadata.upperBoundCostUsd,
      pricing: metadata.pricing,
      errors: metadata.errors
    },
    pass
  };
}

function aggregateRows(rows) {
  const clear = rows.filter((row) => row.clear);
  const accepted = rows.filter((row) => row.accepted);
  const acceptedCorrect = accepted.filter((row) => row.correct === true);
  const costs = rows
    .map((row) => row.provider.upperBoundCostUsd)
    .filter((value) => typeof value === "number");
  return {
    total: rows.length,
    passed: rows.filter((row) => row.pass).length,
    accepted: accepted.length,
    clearN: clear.length,
    clearCoverage: wilson(clear.filter((row) => row.accepted).length, clear.length),
    acceptedCorrectness: wilson(acceptedCorrect.length, accepted.length),
    latencyMs: { mean: mean(rows.map((row) => row.latencyMs)), p95: percentile(rows.map((row) => row.latencyMs), 0.95) },
    upperBoundCostUsd: { mean: mean(costs), maximum: costs.length === 0 ? null : Math.max(...costs) }
  };
}

function subgroupEntries(results) {
  const groups = new Map();
  const add = (key, row) => {
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  };
  for (const row of results) {
    for (const field of SUBGROUP_FIELDS) {
      add(`${row.kind}:${field}=${row.subgroups[field]}`, row);
    }
    for (const condition of row.subgroups.conditions) {
      add(`${row.kind}:conditions=${condition}`, row);
    }
  }
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rows]) => [key, aggregateRows(rows)])
  );
}

function aggregate(results) {
  const byKind = {};
  for (const kind of ["front", "nutrition", "live"]) {
    byKind[kind] = aggregateRows(results.filter((row) => row.kind === kind));
  }
  return {
    ...aggregateRows(results),
    byKind,
    bySubgroup: subgroupEntries(results)
  };
}

function releaseFailures(manifest, results, summary) {
  const failures = [];
  for (const [kind, minimum] of Object.entries(RELEASE_POLICY.minimumCases)) {
    if (results.filter((row) => row.kind === kind).length < minimum) {
      failures.push(`release corpus needs at least ${minimum} ${kind} cases`);
    }
  }
  if (results.some((row) => !row.pass)) failures.push("every case must satisfy its preregistered safe outcome and route contract");
  if (results.some((row) => row.accepted && row.correct !== true)) {
    failures.push("accepted front/live identities and nutrition values must be 100% correct");
  }
  for (const kind of ["front", "nutrition"]) {
    const coverage = summary.byKind[kind].clearCoverage.rate;
    const floor = RELEASE_POLICY.clearCoverageFloor[kind];
    if (coverage === null || coverage < floor) {
      failures.push(`clear ${kind} review coverage is below ${(floor * 100).toFixed(0)}%`);
    }
  }
  if (results.some((row) => row.kind === "live" && (row.mode === "match" || row.forbiddenPaths.length > 0))) {
    failures.push("a live response leaked a match or score-bearing field before confirmation");
  }
  if (results.some((row) => row.counts.routeRequests !== 1)) {
    failures.push("one explicit attempt must equal one route request");
  }
  if (results.some((row) => row.kind !== "live" && row.counts.upstreamCalls !== 1)) {
    failures.push("every front/nutrition attempt must equal one upstream call");
  }
  if (results.some((row) => row.provider.errors.length > 0)) {
    failures.push("provider model/count/usage/cost metadata must be complete and expected");
  }
  const criteria = manifest.releaseCriteria;
  const costs = results.map((row) => row.provider.upperBoundCostUsd);
  if (costs.some((value) => typeof value !== "number")) {
    failures.push("every case needs a price-card upper-bound cost");
  } else {
    const meanCost = mean(costs);
    const maxCost = Math.max(...costs);
    if (meanCost > criteria.maxMeanUpperBoundCostUsd) failures.push("mean upper-bound cost exceeds the preregistered cap");
    if (maxCost > criteria.maxCaseUpperBoundCostUsd) failures.push("a case exceeds the preregistered upper-bound cost cap");
  }
  if (summary.latencyMs.p95 === null || summary.latencyMs.p95 > criteria.maxP95LatencyMs) {
    failures.push("p95 route latency exceeds the preregistered cap");
  }
  for (const kind of ["front", "nutrition"]) {
    for (const field of SUBGROUP_FIELDS) {
      for (const value of criteria.requiredSubgroups[kind][field]) {
        const key = `${kind}:${field}=${value}`;
        const cell = summary.bySubgroup[key];
        if (!cell || cell.clearN < RELEASE_POLICY.minimumClearPerRequiredCell) {
          failures.push(`${key} needs at least ${RELEASE_POLICY.minimumClearPerRequiredCell} clear cases`);
          continue;
        }
        const floor = RELEASE_POLICY.clearCoverageFloor[kind];
        if (cell.clearCoverage.rate === null || cell.clearCoverage.rate < floor) {
          failures.push(`${key} clear coverage is below ${(floor * 100).toFixed(0)}%`);
        }
        if (cell.acceptedCorrectness.rate !== null && cell.acceptedCorrectness.rate !== 1) {
          failures.push(`${key} accepted correctness is below 100%`);
        }
      }
    }
  }
  for (const condition of criteria.requiredConditions) {
    const rows = results.filter((row) => row.subgroups.conditions.includes(condition));
    if (rows.length === 0) failures.push(`required condition ${condition} has no cases`);
    else if (rows.some((row) => !row.pass)) failures.push(`required condition ${condition} has an unsafe result`);
  }
  return [...new Set(failures)];
}

function releaseGateLabel(releaseGate) {
  if (!releaseGate.requested) return "NOT RUN";
  return releaseGate.passed ? "PASS" : "FAIL";
}

function markdown(report) {
  const models = [
    ...report.actualModels.package.map((model) => `package:${model}`),
    ...report.actualModels.live.map((model) => `live:${model}`)
  ].join(", ");
  const serviceTiers = [
    ...report.actualServiceTiers.package.map((tier) => `package:${tier}`),
    ...report.actualServiceTiers.live.map((tier) => `live:${tier}`)
  ].join(", ");
  const lines = [
    "# Package label evaluation",
    "",
    `- Run: ${report.runAt}`,
    `- Corpus ID: ${report.corpusId ?? "unverified external corpus"}`,
    `- Route revision: ${report.routeRevision}`,
    `- Actual models: ${models || "none"}`,
    `- Actual service tiers: ${serviceTiers || "none"}`,
    `- Passed: ${report.summary.passed}/${report.summary.total}`,
    `- Session route requests: ${report.execution.sessionRouteRequests}`,
    `- Release gate: ${releaseGateLabel(report.releaseGate)}`,
    "",
    "| Kind | Cases | Accepted | Clear coverage | Accepted correctness | p95 latency |",
    "|---|---:|---:|---:|---:|---:|"
  ];
  for (const [kind, value] of Object.entries(report.summary.byKind)) {
    const coverage = value.clearCoverage.rate === null ? "n/a" : `${(value.clearCoverage.rate * 100).toFixed(1)}%`;
    const correctness =
      value.acceptedCorrectness.rate === null
        ? "n/a"
        : `${(value.acceptedCorrectness.rate * 100).toFixed(1)}%`;
    lines.push(`| ${kind} | ${value.total} | ${value.accepted} | ${coverage} | ${correctness} | ${value.latencyMs.p95 ?? "n/a"} ms |`);
  }
  if (report.releaseGate.failures.length) {
    lines.push("", "## Gate failures", "", ...report.releaseGate.failures.map((item) => `- ${item}`));
  }
  return `${lines.join("\n")}\n`;
}

async function selfTestProcessCleanup() {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    shell: false,
    windowsHide: true,
    stdio: "ignore"
  });
  let exitCode;
  const exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      exitCode = code;
      resolve();
    });
  });
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  await terminateProcessTree(child, exited, () => exitCode !== undefined, "self-test child");
  if (exitCode === undefined) throw new Error("self-test failed: child cleanup was not confirmed");
}

async function selfTest() {
  if (validCorpusId("<replace-with-reviewed-opaque-corpus-id>") || !validCorpusId("package-label-corpus-2026q3-v1")) {
    throw new Error("self-test failed: corpus ID validation");
  }
  if (
    releaseGateLabel({ requested: false, passed: null }) !== "NOT RUN" ||
    releaseGateLabel({ requested: true, passed: true }) !== "PASS" ||
    releaseGateLabel({ requested: true, passed: false }) !== "FAIL"
  ) {
    throw new Error("self-test failed: release gate label");
  }
  if (!options(["--release", "--base-url", "http://example.invalid"]).baseUrlProvided) {
    throw new Error("self-test failed: explicit base URL was not tracked");
  }
  const subgroup = {
    language: "en",
    packageType: "pouch",
    glare: "none",
    skew: "none",
    crop: "none",
    size: "medium",
    conditions: []
  };
  for (const invalid of [
    { ...subgroup, productName: "private product" },
    { ...subgroup, conditions: ["unknown_condition"] }
  ]) {
    let rejected = false;
    try {
      validateSubgroups(invalid, "self.subgroups");
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("self-test failed: invalid subgroup metadata was accepted");
  }
  let impossibleCorpusRejected = false;
  try {
    validateReleaseCorpusCapacity({ cases: [], releaseCriteria: { requiredSubgroups: {} } });
  } catch {
    impossibleCorpusRejected = true;
  }
  if (!impossibleCorpusRejected) {
    throw new Error("self-test failed: structurally impossible release corpus was accepted");
  }
  const liveCase = {
    expected: { primaryMode: "candidate", alternateModes: [] },
    identity: {
      requiredTokens: ["edamame", "ranch"],
      forbiddenTokens: ["doritos"],
      categoryTokens: ["edamame"]
    }
  };
  const leaked = inspectLive(liveCase, {
    mode: "candidate",
    candidate: { food: { code: "1", description: "Edamame Ranch", group: "snacks", score: 99 } }
  });
  if (leaked.pass || leaked.forbiddenPaths[0] !== "$.candidate.food.score") {
    throw new Error("self-test failed: nested score leak was not rejected");
  }
  const exactTruth = Object.fromEntries(
    NUTRITION_FIELDS.map((field) => [field, { state: "null", reason: "omitted" }])
  );
  exactTruth.calories = { state: "exact", value: 130 };
  validateNutritionTruth(exactTruth, "self.nutritionTruth");
  const incomplete = { ...exactTruth };
  delete incomplete.ironMg;
  let rejectedIncomplete = false;
  try {
    validateNutritionTruth(incomplete, "self.incomplete");
  } catch {
    rejectedIncomplete = true;
  }
  if (!rejectedIncomplete) throw new Error("self-test failed: incomplete nutrition truth was accepted");
  const nutritionCase = {
    expected: { primaryMode: "nutrition", alternateModes: [] },
    nutritionTruth: exactTruth,
    servingBasis: "per_serving",
    servingTruth: {
      servingSize: "1 oz (28g)",
      servingGrams: 28,
      servingsPerContainer: "4",
      selectedColumnHeading: "Amount per serving"
    }
  };
  const hallucinatedNutrition = Object.fromEntries(NUTRITION_FIELDS.map((field) => [field, null]));
  hallucinatedNutrition.calories = 130;
  hallucinatedNutrition.ironMg = 1;
  const exactDraft = {
      servingSize: "1 oz (28g)",
      servingGrams: 28,
      servingsPerContainer: "4",
      selectedColumnHeading: "Amount per serving",
      nutrition: {
        servingSize: "1 oz (28g)",
        servingGrams: 28,
        basis: "per_serving",
        ...hallucinatedNutrition
      },
      rows: [],
      unusableRows: [],
      omittedFields: [],
      ingredientText: null,
      warnings: [],
      includedDomains: ["D1"],
      carveOut: null,
      confidence: 0.9
  };
  const nutrition = inspectNutrition(nutritionCase, { mode: "nutrition", draft: exactDraft });
  if (nutrition.pass || !nutrition.mismatchedFields.includes("ironMg")) {
    throw new Error("self-test failed: hallucinated null field was not rejected");
  }
  const extraDraftKey = inspectNutrition(nutritionCase, {
    mode: "nutrition",
    draft: { ...exactDraft, hiddenExtra: true }
  });
  if (extraDraftKey.shapeOk) throw new Error("self-test failed: extra nutrition draft key was accepted");
  const categoryOnlyInDisplayName = inspectFront(
    {
      expected: { primaryMode: "front", alternateModes: [] },
      identity: {
        requiredTokens: ["edamame", "ranch"],
        forbiddenTokens: ["doritos"],
        categoryTokens: ["edamame"]
      }
    },
    {
      mode: "front",
      candidate: {
        brand: "Example",
        product: "Snack",
        flavor: "Ranch",
        displayName: "Example Edamame Ranch",
        visibleText: ["Example", "Edamame", "Ranch"],
        confidence: 0.95,
        quality: "good"
      }
    }
  );
  if (categoryOnlyInDisplayName.pass || categoryOnlyInDisplayName.categoryTokensPreserved) {
    throw new Error("self-test failed: display name satisfied the product category proxy");
  }
  let now = 0;
  let sessionCalls = 0;
  const sleeps = [];
  const coordinator = createPackageCoordinator({
    clock: () => now,
    sleepFn: async (milliseconds) => {
      sleeps.push(milliseconds);
      now += milliseconds;
    },
    openSessionFn: async () => {
      sessionCalls += 1;
      return { cookie: `session-${sessionCalls}`, expiresAt: now + (sessionCalls === 1 ? 200_000 : 900_000) };
    }
  });
  if ((await coordinator.prepare()) !== "session-1") throw new Error("self-test failed: first session");
  now += 5_000;
  if ((await coordinator.prepare()) !== "session-1" || sleeps[0] !== 5_100) {
    throw new Error("self-test failed: package pacing");
  }
  now = 80_000;
  if ((await coordinator.prepare()) !== "session-2" || sessionCalls !== 2) {
    throw new Error("self-test failed: renewal safety window");
  }
  const headers = new Headers({
    "X-Ladder-Package-Model": "model-a",
    "X-Ladder-Model-Complete": "1",
    "X-Ladder-Service-Tier": "default",
    "X-Ladder-Service-Tier-Complete": "1",
    "X-Ladder-Upstream-Calls": "2",
    "X-Ladder-Usage-Complete": "1",
    "X-Ladder-Input-Tokens": "120",
    "X-Ladder-Output-Tokens": "30",
    "X-Ladder-Total-Tokens": "150"
  });
  const metadata = providerMetadata(
    { kind: "front", expectedCounts: { allowedUpstreamCalls: [1] } },
    { headers },
    {
      expectedModels: { package: ["model-a"] },
      priceCard: {
        models: {
          "model-a": {
            serviceTiers: { default: { inputUsdPer1MTokens: 1, outputUsdPer1MTokens: 2 } }
          }
        }
      }
    },
    {
      requireCost: true,
      expectedIdentity: {
        attestation: "attested-run",
        sourceRevision: "source-a",
        buildId: "build-a"
      }
    }
  );
  if (
    !metadata.errors.includes("unexpected_upstream_calls") ||
    !metadata.errors.includes("release_attestation_mismatch") ||
    metadata.upperBoundCostUsd !== 0.00018
  ) {
    throw new Error("self-test failed: falsified call count or cost calculation");
  }
  const missingTierHeaders = new Headers(headers);
  missingTierHeaders.delete("X-Ladder-Service-Tier");
  const missingTier = providerMetadata(
    { kind: "front", expectedCounts: { allowedUpstreamCalls: [2] } },
    { headers: missingTierHeaders },
    {
      expectedModels: { package: ["model-a"] },
      priceCard: {
        models: {
          "model-a": {
            serviceTiers: { default: { inputUsdPer1MTokens: 1, outputUsdPer1MTokens: 2 } }
          }
        }
      }
    },
    { requireCost: true }
  );
  if (!missingTier.errors.includes("missing_or_invalid_service_tier")) {
    throw new Error("self-test failed: missing service tier was accepted");
  }
  if (missingTier.attestationVerified !== null || missingTier.errors.includes("release_attestation_mismatch")) {
    throw new Error("self-test failed: external server was reported as attested");
  }
  let renewalFailed = false;
  const failedCoordinator = createPackageCoordinator({
    openSessionFn: async () => {
      throw new Error("renewal unavailable");
    }
  });
  try {
    await failedCoordinator.prepare();
  } catch {
    renewalFailed = true;
  }
  if (!renewalFailed) throw new Error("self-test failed: session failure was swallowed");
  if (wilson(8, 10).rate !== 0.8) throw new Error("self-test failed: Wilson interval");
  await selfTestProcessCleanup();
  console.log("package-label eval self-test passed");
}

async function main() {
  const config = options(process.argv.slice(2));
  if (config.selfTest) {
    await selfTest();
    return;
  }
  if (config.release && config.baseUrlProvided) {
    throw new Error("Release evaluation rejects --base-url and launches the current checkout itself");
  }
  const manifestPath = path.resolve(config.manifest);
  const manifestSource = await readFile(manifestPath);
  const manifest = JSON.parse(manifestSource.toString("utf8"));
  validateManifest(manifest, { release: config.release });
  const manifestDir = path.dirname(manifestPath);
  await preflightSources(manifest, manifestDir);
  let releaseServer = null;
  try {
    if (config.release) releaseServer = await startReleaseServer();
    const baseUrl = releaseServer?.baseUrl ?? config.baseUrl;
    const passcode = releaseServer?.passcode ??
      process.env.PACKAGE_LABEL_EVAL_PASSCODE ??
      process.env.DEMO_PASSCODE;
    if (!passcode) {
      throw new Error("Set PACKAGE_LABEL_EVAL_PASSCODE (or DEMO_PASSCODE) for a non-release eval server");
    }
    const expectedIdentity = releaseServer
      ? {
          attestation: releaseServer.attestation,
          buildId: releaseServer.buildId,
          sourceRevision: releaseServer.sourceRevision
        }
      : null;
    const coordinator = createPackageCoordinator({
      openSessionFn: () => openSession(baseUrl, passcode, expectedIdentity),
      initialSession: releaseServer?.initialSession ?? null,
      initialSessionRouteRequests: releaseServer ? 1 : 0
    });
    const results = [];
    for (const testCase of manifest.cases) {
      results.push(
        await runCase({
          baseUrl,
          coordinator,
          expectedIdentity,
          manifest,
          manifestDir,
          passcode,
          release: config.release,
          testCase
        })
      );
    }
    await releaseServer?.verify();
    const summary = aggregate(results);
    const failures = config.release
      ? releaseFailures(manifest, results, summary)
      : results.filter((row) => !row.pass).map((row) => `${row.id} failed`);
    const actualModels = {
      package: [
        ...new Set(
          results
            .filter((row) => row.kind !== "live")
            .map((row) => row.provider.model)
            .filter((model) => typeof model === "string")
        )
      ].sort(),
      live: [
        ...new Set(
          results
            .filter((row) => row.kind === "live")
            .map((row) => row.provider.model)
            .filter((model) => typeof model === "string")
        )
      ].sort()
    };
    const actualServiceTiers = {
      package: [
        ...new Set(
          results
            .filter((row) => row.kind !== "live")
            .map((row) => row.provider.serviceTier)
            .filter((tier) => typeof tier === "string")
        )
      ].sort(),
      live: [
        ...new Set(
          results
            .filter((row) => row.kind === "live")
            .map((row) => row.provider.serviceTier)
            .filter((tier) => typeof tier === "string")
        )
      ].sort()
    };
    const priceCard = manifest.priceCard
      ? {
          currency: manifest.priceCard.currency,
          asOf: manifest.priceCard.asOf,
          models: Object.fromEntries(
            [...new Set([...manifest.expectedModels.package, ...manifest.expectedModels.live])]
              .sort()
              .map((model) => [model, manifest.priceCard.models[model]])
          )
        }
      : null;
    const report = {
      schemaVersion: 2,
      corpusId: manifest.corpusId ?? null,
      releasePolicyVersion: manifest.releasePolicyVersion ?? null,
      runAt: new Date().toISOString(),
      routeRevision: releaseServer?.revision.label ?? "external-server-unverified",
      sourceRevision: releaseServer?.revision ?? null,
      actualModels,
      actualServiceTiers,
      preprocessing: {
        live: {
          outputMime: "image/jpeg",
          maximumLongEdgePx: 768,
          initialJpegQuality: 70,
          maximumDataUrlChars: LIVE_MAX_IMAGE_CHARS,
          maximumAttempts: 8
        },
        package: {
          outputMime: "image/jpeg",
          maximumLongEdgePx: 2048,
          initialJpegQuality: 90,
          minimumJpegQualityBeforeResize: 58,
          resizeFactor: 0.82,
          maximumDataUrlChars: PACKAGE_MAX_IMAGE_CHARS,
          maximumAttempts: 8
        }
      },
      execution: {
        serverMode: config.release ? "self_built_loopback_production" : "external_unverified",
        attestationVerified: config.release && results.every((row) => row.provider.attestationVerified),
        cleanupVerified: config.release ? false : null,
        attestationHash: expectedIdentity ? sha256(expectedIdentity.attestation) : null,
        packageStartIntervalMs: PACKAGE_START_INTERVAL_MS,
        sessionRenewSafetyMs: SESSION_RENEW_SAFETY_MS,
        automaticRetries: 0,
        sessionRouteRequests: coordinator.stats().sessionRouteRequests
      },
      priceCardHash: priceCard ? sha256(JSON.stringify(priceCard)) : null,
      priceCard,
      summary,
      results,
      releaseGate: {
        requested: config.release,
        passed: config.release ? failures.length === 0 : null,
        failures
      }
    };
    if (releaseServer) {
      await releaseServer.stop();
      releaseServer = null;
      report.execution.cleanupVerified = true;
    }
    const stamp = report.runAt.replace(/[:.]/g, "-");
    const outputDir = path.resolve("artifacts/package-label-eval");
    await mkdir(outputDir, { recursive: true });
    await Promise.all([
      writeFile(path.join(outputDir, `${stamp}.json`), `${JSON.stringify(report, null, 2)}\n`),
      writeFile(path.join(outputDir, `${stamp}.md`), markdown(report))
    ]);
    console.log(`Package label eval: ${summary.passed}/${summary.total} passed; report ${outputDir}`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await releaseServer?.stop();
  }
}

await main();
