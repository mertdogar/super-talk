import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { HubOptions } from "./index.js";

export const DEFAULT_CONFIG_FILE = "super-talk.config.json";

/** A super-talk hub config: every key optional, merged across flags > env > file > defaults. */
export interface ResolvedConfig {
  port?: number;
  host?: string;
  token?: string;
  dbFile?: string;
  authDbFile?: string;
  publicDir?: string;
}

const HELP = `super-talk-server — run the super-talk hub (web UI + WebSocket on one port)

Usage: super-talk-server [options]

Options:
  --port <n>        Port to listen on (default 4500)
  --host <addr>     Host/interface to bind (default: all interfaces; e.g. 127.0.0.1)
  --token <secret>  Deprecated — ignored (auth is now per-identity keys)
  --db <path>       SQLite file for the chat Store (default ./super-talk.db)
  --auth-db <path>  SQLite file for the identity store (default ./super-talk-auth.db)
  --web-dir <path>  Directory of the built web UI to serve
  --config <path>   Load a JSON config file (default: ./super-talk.config.json if present)
  --help            Show this help and exit
  --version         Show version and exit

Subcommands:
  keys list                       List identities.
  keys add <name> [--admin] [--agent]   Issue a key (printed once).
  keys revoke <name>              Revoke an identity's key.

Precedence (highest first): flags > environment > config file > defaults.
Env vars: SUPERTALK_PORT, SUPERTALK_HOST, SUPERTALK_DB, SUPERTALK_AUTH_DB, SUPERTALK_WEB_DIR.`;

function toPort(value: string, source: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error(`invalid port from ${source}: ${JSON.stringify(value)}`);
  }
  return n;
}

function readFile(path: string, explicit: boolean): Partial<ResolvedConfig> {
  if (!existsSync(path)) {
    if (explicit) throw new Error(`config file not found: ${path}`);
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`invalid JSON in config file ${path}: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`config file ${path} must contain a JSON object`);
  }
  const obj = parsed as Record<string, unknown>;
  const out: Partial<ResolvedConfig> = {};
  if (obj.port !== undefined) out.port = toPort(String(obj.port), `config file ${path}`);
  if (typeof obj.host === "string") out.host = obj.host;
  if (typeof obj.token === "string") out.token = obj.token;
  if (typeof obj.db === "string") out.dbFile = obj.db;
  if (typeof obj.authDb === "string") out.authDbFile = obj.authDb;
  if (typeof obj.webDir === "string") out.publicDir = obj.webDir;
  return out;
}

function fromEnv(env: NodeJS.ProcessEnv): Partial<ResolvedConfig> {
  const out: Partial<ResolvedConfig> = {};
  if (env.SUPERTALK_PORT) out.port = toPort(env.SUPERTALK_PORT, "SUPERTALK_PORT");
  if (env.SUPERTALK_HOST) out.host = env.SUPERTALK_HOST;
  if (env.SUPERTALK_TOKEN) out.token = env.SUPERTALK_TOKEN;
  if (env.SUPERTALK_DB) out.dbFile = env.SUPERTALK_DB;
  if (env.SUPERTALK_AUTH_DB) out.authDbFile = env.SUPERTALK_AUTH_DB;
  if (env.SUPERTALK_WEB_DIR) out.publicDir = env.SUPERTALK_WEB_DIR;
  return out;
}

export interface LoadResult {
  /** When set, the CLI should print this and exit 0 without starting the hub. */
  exit?: string;
  options: HubOptions;
}

/**
 * Resolve hub options from flags, environment, and an optional JSON config file.
 * Precedence (highest first): flags > env > config file > built-in defaults.
 * Throws on unknown flags, unparseable values, a missing explicit `--config`, or malformed JSON.
 */
export function loadConfig(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  version = "",
): LoadResult {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      token: { type: "string" },
      db: { type: "string" },
      "auth-db": { type: "string" },
      "web-dir": { type: "string" },
      config: { type: "string" },
      help: { type: "boolean" },
      version: { type: "boolean" },
    },
  });

  if (values.help) return { exit: HELP, options: {} };
  if (values.version) return { exit: version, options: {} };

  const configPath = values.config ? values.config : join(cwd, DEFAULT_CONFIG_FILE);
  const fileLayer = readFile(configPath, values.config !== undefined);
  const envLayer = fromEnv(env);

  const flagLayer: Partial<ResolvedConfig> = {};
  if (values.port !== undefined) flagLayer.port = toPort(values.port, "--port");
  if (values.host !== undefined) flagLayer.host = values.host;
  if (values.token !== undefined) flagLayer.token = values.token;
  if (values.db !== undefined) flagLayer.dbFile = values.db;
  if (values["auth-db"] !== undefined) flagLayer.authDbFile = values["auth-db"];
  if (values["web-dir"] !== undefined) flagLayer.publicDir = values["web-dir"];

  const merged: ResolvedConfig = { ...fileLayer, ...envLayer, ...flagLayer };
  return { options: merged };
}
