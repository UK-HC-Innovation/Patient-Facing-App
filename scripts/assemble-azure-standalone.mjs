import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const standaloneRoot = path.join(projectRoot, ".next", "standalone");

async function assertFile(file) {
  const details = await stat(file);
  if (!details.isFile()) {
    throw new Error(`Expected a file at ${file}`);
  }
}

await assertFile(path.join(standaloneRoot, "server.js"));

const copies = [
  [path.join(projectRoot, "public"), path.join(standaloneRoot, "public")],
  [path.join(projectRoot, ".next", "static"), path.join(standaloneRoot, ".next", "static")],
  [
    path.join(projectRoot, "src", "data", "food-compass"),
    path.join(standaloneRoot, "src", "data", "food-compass")
  ]
];

for (const [source, destination] of copies) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

console.log("Azure standalone artifact assembled with public, static, and Food Compass data files.");
