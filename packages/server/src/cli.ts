import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createHub } from "./index.js";

function version(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : "";
  } catch {
    return "";
  }
}

const { exit, options } = loadConfig(process.argv.slice(2), process.env, process.cwd(), version());
if (exit !== undefined) {
  console.log(exit);
  process.exit(0);
}

// the web UI ships bundled next to this file at dist/public; override with --web-dir / SUPERTALK_WEB_DIR
const publicDir = options.publicDir ?? fileURLToPath(new URL("./public", import.meta.url));
const dbFile = options.dbFile ?? "./super-talk.db";

const hub = await createHub({ ...options, dbFile, publicDir });

const hasUI = existsSync(publicDir);
console.error(
  `super-talk hub on port ${hub.port}` +
    (options.token ? " (token required)" : " (open — no token set)") +
    `\n  bind:      ${hub.host ?? "all interfaces"}` +
    `\n  websocket: ws://localhost:${hub.port}` +
    (hasUI ? `\n  web ui:    http://localhost:${hub.port}` : "\n  web ui:    (not bundled)") +
    `\n  store:     ${dbFile}`,
);

const shutdown = async () => {
  await hub.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
