// Build the web UI and copy its output into the server's dist/public so the published
// @super-talk/server is self-contained (npx serves hub + UI from one package).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, "..");
const webDir = resolve(serverDir, "../web");
const viteBin = resolve(serverDir, "../../node_modules/.bin/vite");
const publicDir = resolve(serverDir, "dist/public");

console.log("[bundle-ui] building web…");
const r = spawnSync(viteBin, ["build"], { cwd: webDir, stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);

const webDist = resolve(webDir, "dist");
if (!existsSync(webDist)) {
  console.error("[bundle-ui] web build produced no dist/");
  process.exit(1);
}

rmSync(publicDir, { recursive: true, force: true });
cpSync(webDist, publicDir, { recursive: true });
console.log(`[bundle-ui] copied web UI -> ${publicDir}`);
