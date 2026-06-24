import { createHub } from "./index.js";

const port = process.env.SUPERTALK_PORT ? Number(process.env.SUPERTALK_PORT) : 4500;
const token = process.env.SUPERTALK_TOKEN || undefined;
const dbFile = process.env.SUPERTALK_DB || "./super-talk.db";

const hub = await createHub({ port, token, dbFile });

console.error(
  `super-talk hub listening on ws://0.0.0.0:${hub.port}` +
    (token ? " (token required)" : " (open — no token set)") +
    `\n  store: ${dbFile}`,
);

const shutdown = async () => {
  await hub.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
