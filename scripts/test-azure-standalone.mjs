import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const standaloneRoot = path.join(projectRoot, ".next", "standalone");

for (const name of ["fcs2-foods.json", "fndds-nutrients.json"]) {
  const raw = await readFile(path.join(standaloneRoot, "src", "data", "food-compass", name), "utf8");
  assert.ok(JSON.parse(raw), `${name} must contain valid JSON`);
}

const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      reject(new Error("Could not allocate a local verification port."));
      return;
    }
    const selectedPort = address.port;
    server.close((error) => error ? reject(error) : resolve(selectedPort));
  });
});

const output = [];
const child = spawn(process.execPath, ["server.js"], {
  cwd: standaloneRoot,
  env: {
    ...process.env,
    APP_SURFACE: "foodlens",
    HEALTH_AI_PROVIDER: "mock",
    FOOD_PACKAGE_SCAN_ENABLED: "0",
    NEXT_PUBLIC_FOOD_PACKAGE_SCAN: "0",
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    PORT: String(port)
  },
  stdio: ["ignore", "pipe", "pipe"]
});

for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    output.push(chunk);
    if (output.join("").length > 20_000) output.shift();
  });
}

const baseUrl = `http://127.0.0.1:${port}`;

async function waitForHealth() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Standalone server exited early.\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return response;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Standalone server did not become healthy.\n${output.join("")}`);
}

async function postJson(pathname, value) {
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value)
  });
}

try {
  const health = await waitForHealth();
  assert.deepEqual(await health.json(), { status: "healthy", surface: "foodlens" });

  const root = await fetch(`${baseUrl}/?lang=es`, { redirect: "manual" });
  assert.equal(root.status, 307);
  const rootLocation = new URL(root.headers.get("location"), baseUrl);
  assert.equal(rootLocation.pathname, "/food/demo");
  assert.equal(rootLocation.search, "?lang=es");

  const compass = await fetch(`${baseUrl}/compass?lang=es`, { redirect: "manual" });
  assert.equal(compass.status, 308);
  const compassLocation = new URL(compass.headers.get("location"), baseUrl);
  assert.equal(compassLocation.pathname, "/food/demo");
  assert.equal(compassLocation.search, "?lang=es");

  assert.equal((await fetch(`${baseUrl}/food/demo`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/today`)).status, 404);
  assert.equal((await postJson("/api/food/package", {})).status, 404);

  const plate = await postJson("/api/food/plate", {});
  assert.equal(plate.status, 400);
  assert.deepEqual(await plate.json(), { mode: "error", message: "empty_request" });

  const identified = await postJson("/api/food/identify", { text: "pizza" });
  assert.equal(identified.status, 200);
  const identifiedBody = await identified.json();
  assert.equal(identifiedBody.mode, "match");
  assert.equal(identifiedBody.match.score.fcs, 21);

  const lookup = await postJson("/api/food/lookup", { barcode: "051000012616" });
  assert.equal(lookup.status, 200);
  assert.equal((await lookup.json()).found, true);

  const token = await postJson("/api/realtime/token", { probe: true });
  assert.equal(token.status, 200);
  assert.equal((await token.json()).mode, "mock");

  console.log("Azure standalone artifact passed health, boundary, redirect, data, and mock-mode probes.");
} finally {
  child.kill();
}
