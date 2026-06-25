import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AuthStore } from "./auth-store.js";
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

// `keys` subcommand — manage identities offline (recovery / headless provisioning), without the hub.
if (process.argv[2] === "keys") {
  const [, , , sub, name] = process.argv;
  const flags = process.argv.slice(4);
  const auth = new AuthStore(process.env.SUPERTALK_AUTH_DB || "./super-talk-auth.db");
  if (sub === "list") {
    for (const id of auth.list()) {
      const tags = [id.kind, id.isAdmin && "admin", id.lastSeenAt ? "seen" : "never-used"]
        .filter(Boolean)
        .join(", ");
      console.log(`${id.isAdmin ? "★" : "·"} ${id.name}  (${tags})`);
    }
  } else if (sub === "add" && name) {
    const kind = flags.includes("--agent") ? "agent" : "user";
    const key = auth.issue(name, kind, flags.includes("--admin"));
    console.log(
      `issued "${name}" (${kind}${flags.includes("--admin") ? ", admin" : ""}):\n\n    ${key}\n`,
    );
  } else if (sub === "revoke" && name) {
    if (!auth.byName(name)) {
      console.error(`no identity "${name}"`);
      process.exit(1);
    }
    auth.revoke(name);
    console.log(`revoked "${name}"`);
  } else {
    console.log(
      "usage: super-talk-server keys <list | add <name> [--admin] [--agent] | revoke <name>>",
    );
  }
  auth.close();
  process.exit(0);
}

const { exit, options } = loadConfig(process.argv.slice(2), process.env, process.cwd(), version());
if (exit !== undefined) {
  console.log(exit);
  process.exit(0);
}

// the web UI ships bundled next to this file at dist/public; override with --web-dir / SUPERTALK_WEB_DIR
const publicDir = options.publicDir ?? fileURLToPath(new URL("./public", import.meta.url));
const dbFile = options.dbFile ?? "./super-talk.db";
const authDbFile = options.authDbFile ?? "./super-talk-auth.db";

const hub = await createHub({ ...options, dbFile, authDbFile, publicDir });

const hasUI = existsSync(publicDir);
const onPublicInterface = !hub.host || (hub.host !== "127.0.0.1" && hub.host !== "localhost");
if (onPublicInterface) {
  console.error(
    "[super-talk] warning: bound to a public interface. Put the hub behind a TLS-terminating " +
      "reverse proxy (wss://) — keys travel in the WebSocket URL and must not cross plaintext.",
  );
}
console.error(
  `super-talk hub on port ${hub.port} (per-identity key auth)` +
    `\n  bind:      ${hub.host ?? "all interfaces"}` +
    `\n  websocket: ws://localhost:${hub.port}` +
    (hasUI ? `\n  web ui:    http://localhost:${hub.port}` : "\n  web ui:    (not bundled)") +
    `\n  store:     ${dbFile}` +
    `\n  auth:      ${authDbFile}`,
);

const shutdown = async () => {
  await hub.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
