// Compress every glTF model under public/models that is not compressed yet, in place, with meshopt.
//
//   npm run models:compress            compress what needs it
//   npm run models:compress -- --check list what would change, and fail if anything does
//
// Meshopt quantizes positions, normals and texture coordinates to small integers and packs the result; the game's
// loader decodes it (src/components/scene/gltf.ts). File names, textures and the buffers' names stay as they were.
// The tool runs from npm on demand, pinned to one version, so it never weighs on the app's own install.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = "@gltf-transform/cli@4.5.0";
const ROOT = fileURLToPath(new URL("../public/models/", import.meta.url));
const check = process.argv.includes("--check");

/** The JSON part of a .gltf, or of a .glb's first chunk. */
function json(file) {
  const bytes = readFileSync(file);
  if (file.endsWith(".gltf")) return JSON.parse(bytes.toString("utf8"));
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString("utf8"));
}

const models = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return models(path);
    return /\.(glb|gltf)$/.test(name) ? [path] : [];
  });

const pending = models(ROOT).filter((file) => !(json(file).extensionsUsed ?? []).includes("EXT_meshopt_compression"));
if (pending.length === 0) {
  console.log("Every model is already compressed.");
  process.exit(0);
}
if (check) {
  console.log(`Not yet compressed:\n${pending.map((f) => `  ${f}`).join("\n")}`);
  process.exit(1);
}
// On Windows npx is a batch file, which only runs through a shell, and the shell splits paths with spaces unless quoted.
const windows = process.platform === "win32";
const arg = (a) => (windows ? `"${a}"` : a);
for (const file of pending) {
  const before = statSync(file).size;
  execFileSync(windows ? "npx.cmd" : "npx", ["--yes", TOOL, "meshopt", file, file, "--level", "medium"].map(arg), { stdio: ["ignore", "ignore", "inherit"], shell: windows });
  console.log(`${file}: ${before} -> ${statSync(file).size} bytes`);
}
