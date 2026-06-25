import { createHash, randomBytes, randomInt } from "node:crypto";
import { createRequire } from "node:module";
import type { AuditEntry, IdentityKind } from "@super-talk/core";

// `node:sqlite` is newer than esbuild's builtin list — a static import gets mis-rewritten to a bare
// (missing) `sqlite` package in the tsup bundle. Load it through a non-literal specifier so the
// bundler can't touch it; the source still typechecks via the type-only import below.
const { DatabaseSync } = createRequire(import.meta.url)(
  ["node", "sqlite"].join(":"),
) as typeof import("node:sqlite");

export interface Identity {
  name: string;
  kind: IdentityKind;
  isAdmin: boolean;
  createdAt: number;
  lastSeenAt: number | null;
}

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A high-entropy bearer key (~256 bits). Shown once on issue, then only its hash is stored. */
const generateKey = () => `stk_${randomBytes(32).toString("base64url")}`;

// Crockford-ish base32 minus ambiguous chars (no I/L/O/U). 8 chars ≈ 40 bits, hyphen-grouped.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function generatePairingCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

interface Row {
  name: string;
  kind: string;
  is_admin: number;
  key_hash: string;
  created_at: number;
  last_seen_at: number | null;
}
const toIdentity = (r: Row): Identity => ({
  name: r.name,
  kind: r.kind as IdentityKind,
  isAdmin: r.is_admin === 1,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
});

/**
 * Server-private identity + audit store, backed by node:sqlite (built-in — no extra dependency).
 * Holds only key HASHES; never exposed as a super-line Resource. Pass `:memory:` in tests.
 */
export class AuthStore {
  #db: InstanceType<typeof DatabaseSync>;

  constructor(file: string) {
    this.#db = new DatabaseSync(file);
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS identities (
        name        TEXT PRIMARY KEY,
        kind        TEXT NOT NULL,
        is_admin    INTEGER NOT NULL DEFAULT 0,
        key_hash    TEXT NOT NULL UNIQUE,
        created_at  INTEGER NOT NULL,
        last_seen_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS audit (
        ts     INTEGER NOT NULL,
        actor  TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL
      );
    `);
  }

  count(): number {
    return (this.#db.prepare("SELECT COUNT(*) AS n FROM identities").get() as { n: number }).n;
  }

  adminCount(): number {
    return (
      this.#db.prepare("SELECT COUNT(*) AS n FROM identities WHERE is_admin = 1").get() as {
        n: number;
      }
    ).n;
  }

  /** Mint a new identity and return its plaintext key (the only time it is ever available). */
  issue(name: string, kind: IdentityKind, isAdmin = false): string {
    const key = generateKey();
    this.#db
      .prepare(
        "INSERT INTO identities (name, kind, is_admin, key_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, NULL)",
      )
      .run(name, kind, isAdmin ? 1 : 0, hashKey(key), Date.now());
    return key;
  }

  byKey(key: string): Identity | null {
    const row = this.#db
      .prepare("SELECT * FROM identities WHERE key_hash = ?")
      .get(hashKey(key)) as Row | undefined;
    return row ? toIdentity(row) : null;
  }

  byName(name: string): Identity | null {
    const row = this.#db.prepare("SELECT * FROM identities WHERE name = ?").get(name) as
      | Row
      | undefined;
    return row ? toIdentity(row) : null;
  }

  list(): Identity[] {
    const rows = this.#db
      .prepare("SELECT * FROM identities ORDER BY created_at")
      .all() as unknown as Row[];
    return rows.map(toIdentity);
  }

  revoke(name: string): void {
    this.#db.prepare("DELETE FROM identities WHERE name = ?").run(name);
  }

  setAdmin(name: string, isAdmin: boolean): void {
    this.#db
      .prepare("UPDATE identities SET is_admin = ? WHERE name = ?")
      .run(isAdmin ? 1 : 0, name);
  }

  rename(oldName: string, newName: string): void {
    this.#db.prepare("UPDATE identities SET name = ? WHERE name = ?").run(newName, oldName);
  }

  touchLastSeen(name: string): void {
    this.#db.prepare("UPDATE identities SET last_seen_at = ? WHERE name = ?").run(Date.now(), name);
  }

  audit(actor: string, action: string, target: string): void {
    this.#db
      .prepare("INSERT INTO audit (ts, actor, action, target) VALUES (?, ?, ?, ?)")
      .run(Date.now(), actor, action, target);
  }

  readAudit(limit = 100): AuditEntry[] {
    return this.#db
      .prepare("SELECT ts, actor, action, target FROM audit ORDER BY rowid DESC LIMIT ?")
      .all(limit) as unknown as AuditEntry[];
  }

  close(): void {
    this.#db.close();
  }
}
