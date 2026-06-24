import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHub } from "./index.js";

const port = process.env.SUPERTALK_PORT ? Number(process.env.SUPERTALK_PORT) : 4500;
const token = process.env.SUPERTALK_TOKEN || undefined;
const dbFile = process.env.SUPERTALK_DB || "./super-talk.db";
// the web UI ships bundled next to this file at dist/public; override with SUPERTALK_WEB_DIR
const publicDir =
  process.env.SUPERTALK_WEB_DIR || fileURLToPath(new URL("./public", import.meta.url));

const hub = await createHub({ port, token, dbFile, publicDir });

const hasUI = existsSync(publicDir);
console.error(
  `super-talk hub on port ${hub.port}` +
    (token ? " (token required)" : " (open — no token set)") +
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
