import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import http from "node:http";
import { type ServerStore, SuperLineError } from "@super-line/core";
import sirv from "sirv";
import { type Conn, createSuperLineServer, type SuperLineServer } from "@super-line/server";
import { webSocketServerTransport } from "@super-line/transport-websocket";
import {
  api,
  type ChannelsDoc,
  type Delivery,
  type IdentityKind,
  type Member,
  type MembersDoc,
  type Message,
  type MessagesDoc,
} from "@super-talk/core";
import { AuthStore, generatePairingCode } from "./auth-store.js";

export interface HubOptions {
  /** Port to listen on. Defaults to 4500. */
  port?: number;
  /** Host/interface to bind. Defaults to Node's default (all interfaces). Set e.g. `127.0.0.1` to restrict. */
  host?: string;
  /** @deprecated Superseded by per-identity keys (see the auth store). Ignored; warned about on boot. */
  token?: string;
  /** The `chat` Store's server half. Defaults to a SQLite store at `dbFile`. */
  store?: ServerStore;
  /** SQLite file for the default chat store. Defaults to `./super-talk.db`. Ignored if `store` is given. */
  dbFile?: string;
  /** Server-private identity/audit store. Inject one (e.g. `new AuthStore(":memory:")`) in tests. */
  authStore?: AuthStore;
  /** File for the server-private auth store. Defaults to `./super-talk-auth.db`. Ignored if `authStore` is given. */
  authDbFile?: string;
  /** Directory of the built web UI to serve over HTTP. When unset/missing, runs WebSocket-only. */
  publicDir?: string;
  /** Recent messages attached as thread context on each agent delivery. Defaults to 6. */
  threadContext?: number;
  /** Cooldown backstop: max sends to one channel per window before rejection. Defaults to 12. */
  cooldownMax?: number;
  /** Cooldown window in ms. Defaults to 10_000. */
  cooldownWindowMs?: number;
}

type Ctx = { name: string };
type PendingCtx = { name: string; desiredName: string; kind: IdentityKind; ip: string };
type AgentData = { channels: string[] };

type Auth =
  | { role: "user"; ctx: Ctx }
  | { role: "admin"; ctx: Ctx }
  | { role: "agent"; ctx: Ctx }
  | { role: "pending"; ctx: PendingCtx };

export interface Hub {
  srv: SuperLineServer<typeof api, Auth>;
  http: http.Server;
  /** The server-private identity store — exposed for tests + CLI key management. */
  auth: AuthStore;
  port: number;
  host?: string;
  close(): Promise<void>;
}

const WORKSPACE = "workspace";
const READABLE = { [WORKSPACE]: { read: true, write: false } };
const CHANNELS = "channels";
const msgKey = (id: string) => `messages:${id}`;
const memKey = (id: string) => `members:${id}`;
const nameOf = (conn: Conn) => (conn.ctx as Ctx).name;
const memberRoleOf = (conn: Conn): Member["role"] => (conn.role === "agent" ? "agent" : "user");
const remoteIp = (raw: unknown): string =>
  (raw as http.IncomingMessage | undefined)?.socket?.remoteAddress ?? "?";
const emitTo = <T>(conn: Conn, event: string, data: T) =>
  (conn as unknown as { emit: (e: string, d: T) => void }).emit(event, data);
const slug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

interface PendingReq {
  code: string;
  desiredName: string;
  kind: IdentityKind;
  ip: string;
  at: number;
  connId: string;
}
interface Grant {
  key: string;
  name: string;
  kind: IdentityKind;
}

const GRANT_TTL = 5 * 60_000;
const PENDING_TTL = 10 * 60_000;
const MAX_PENDING = 100;

/** Create and start a super-talk hub. Resolves once it is listening. */
export async function createHub(opts: HubOptions = {}): Promise<Hub> {
  const port = opts.port ?? 4500;
  const host = opts.host;
  const threadContext = opts.threadContext ?? 6;
  const cooldownMax = opts.cooldownMax ?? 12;
  const cooldownWindowMs = opts.cooldownWindowMs ?? 10_000;

  if (opts.token) {
    console.error(
      "[super-talk] warning: `token` is deprecated and ignored — auth is now per-identity keys.",
    );
  }

  // ---- server-private identity store (key hashes + audit; never a WORKSPACE Resource) ----
  const auth = opts.authStore ?? new AuthStore(opts.authDbFile ?? "./super-talk-auth.db");
  if (!opts.authStore && auth.count() === 0) {
    const ownerKey = auth.issue("owner", "user", true);
    console.error(
      `\n[super-talk] no identities yet — created bootstrap admin "owner".\n` +
        `[super-talk] OWNER KEY (paste into the web UI once, then keep it secret):\n\n    ${ownerKey}\n`,
    );
  }

  // lazy import: only load store-sqlite (native) when actually using it, so tests/typecheck that
  // pass an in-memory store never touch the native binding.
  const chatStore =
    opts.store ??
    (await import("@super-line/store-sqlite")).sqliteStoreServer({
      file: opts.dbFile ?? "./super-talk.db",
    });

  // ---- presence: ephemeral, name-keyed online counts (a name may have several connections) ----
  const online = new Map<string, number>();
  const presenceList = () => [...online.keys()].sort();
  const publishPresence = () => {
    const users = presenceList();
    srv.forRole("user").publish("presence", { users });
    srv.forRole("admin").publish("presence", { users });
  };
  const bumpPresence = (name: string, delta: number) => {
    const next = (online.get(name) ?? 0) + delta;
    if (next <= 0) online.delete(name);
    else online.set(name, next);
    publishPresence();
  };

  // ---- typing: ephemeral, per-channel, auto-expiring ----
  const TYPING_TTL = 4000;
  const typing = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();
  const publishTyping = () => {
    const byChannel: Record<string, string[]> = {};
    for (const [ch, users] of typing) if (users.size) byChannel[ch] = [...users.keys()].sort();
    srv.forRole("user").publish("typing", { byChannel });
    srv.forRole("admin").publish("typing", { byChannel });
  };
  const clearTyping = (channel: string, name: string) => {
    const users = typing.get(channel);
    if (!users?.has(name)) return;
    clearTimeout(users.get(name));
    users.delete(name);
    if (!users.size) typing.delete(channel);
    publishTyping();
  };
  const markTyping = (channel: string, name: string) => {
    let users = typing.get(channel);
    if (!users) typing.set(channel, (users = new Map()));
    clearTimeout(users.get(name));
    users.set(
      name,
      setTimeout(() => clearTyping(channel, name), TYPING_TTL),
    );
    publishTyping();
  };

  // ---- enrollment: in-memory pending requests + stashed-but-undelivered grants (keyed by code) ----
  const pending = new Map<string, PendingReq>();
  const grants = new Map<string, Grant>();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of pending) if (now - r.at > PENDING_TTL) pending.delete(code);
  }, 60_000);
  sweep.unref?.();

  const deliverGrant = (code: string, connId: string, grant: Grant) => {
    const conn = srv.local.connections.find((c) => c.id === connId);
    if (conn) emitTo(conn, "grant", grant);
    else grants.set(code, grant); // hold for re-claim when the agent reconnects with its saved code
    // Cleanup: a granted key only becomes "real" when its owner connects (sets last_seen_at). If it
    // is never claimed within the TTL, revoke it so a dropped delivery leaves no dangling credential.
    setTimeout(() => {
      grants.delete(code);
      const id = auth.byName(grant.name);
      if (id && id.lastSeenAt == null) {
        auth.revoke(grant.name);
        auth.audit("system", "expire-unclaimed", grant.name);
      }
    }, GRANT_TTL).unref?.();
  };

  const disconnectName = (name: string) => {
    for (const c of srv.local.connections.filter((c) => nameOf(c) === name)) {
      try {
        srv.toConn(c.id).close();
      } catch {
        /* already gone */
      }
    }
  };

  // ---- per-resource-key serialization (whole-doc LWW would clobber concurrent appends) ----
  const chains = new Map<string, Promise<unknown>>();
  const serialize = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const run = (chains.get(key) ?? Promise.resolve()).then(fn, fn);
    chains.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  };

  // ---- cooldown backstop, keyed by `${from}->#${channel}` ----
  const sends = new Map<string, number[]>();
  const cooldownCheck = (from: string, channel: string) => {
    const key = `${from}->#${channel}`;
    const now = Date.now();
    const recent = (sends.get(key) ?? []).filter((t) => now - t < cooldownWindowMs);
    if (recent.length >= cooldownMax) {
      throw new SuperLineError("BAD_REQUEST", `rate limited: too many messages to #${channel}`);
    }
    recent.push(now);
    sends.set(key, recent);
  };

  const pushToAgents = (channel: string, delivery: Delivery) => {
    const agents = srv.local.connections.filter((c) => c.role === "agent");
    for (const c of agents) {
      const joined = (c.data as AgentData).channels ?? [];
      if (!joined.includes(channel)) continue;
      emitTo(c, "message", delivery);
    }
  };

  // Serve the built web UI over HTTP on the same port as the WebSocket (separate `upgrade` event).
  const serveUI =
    opts.publicDir && existsSync(opts.publicDir)
      ? sirv(opts.publicDir, { single: true, etag: true })
      : null;
  const server = http.createServer((req, res) => {
    if (serveUI) {
      serveUI(req, res, () => {
        res.statusCode = 404;
        res.end("Not found");
      });
    } else {
      res.statusCode = 404;
      res.end("super-talk hub (WebSocket only)");
    }
  });

  const srv = createSuperLineServer(api, {
    transports: [webSocketServerTransport({ server })],
    stores: { chat: chatStore },
    heartbeat: { interval: 30_000, maxMissed: 2 },
    identify: () => WORKSPACE, // shared Store read-principal; all clients read the same Resources
    authenticate: (h): Auth => {
      const key = typeof h.query.key === "string" ? h.query.key : "";
      if (key) {
        const id = auth.byKey(key);
        if (!id) throw new SuperLineError("UNAUTHORIZED", "invalid key");
        const role = id.kind === "agent" ? "agent" : id.isAdmin ? "admin" : "user";
        return { role, ctx: { name: id.name } };
      }
      // no key → enrollment: a powerless `pending` connection that may only requestAccess + receive grant
      const desiredName = typeof h.query.name === "string" ? h.query.name.trim() : "";
      const kind: IdentityKind = h.query.kind === "agent" ? "agent" : "user";
      return {
        role: "pending",
        ctx: { name: desiredName || "(pending)", desiredName, kind, ip: remoteIp(h.raw) },
      };
    },
    onConnection: (conn) => {
      if (conn.role === "pending") return;
      if (conn.role === "agent") conn.data = { channels: [] } as AgentData;
      auth.touchLastSeen(nameOf(conn));
      bumpPresence(nameOf(conn), +1);
    },
    onDisconnect: (conn) => {
      if (conn.role !== "pending") bumpPresence(nameOf(conn), -1);
    },
  });

  const store = srv.store("chat");

  // seed the default channel once; on restart the data is already in the Store
  if (!(await store.read(CHANNELS))) {
    await store.create(msgKey("general"), { items: [] } satisfies MessagesDoc, READABLE);
    await store.create(memKey("general"), { members: [] } satisfies MembersDoc, READABLE);
    await store.create(
      CHANNELS,
      {
        channels: [{ id: "general", name: "general", createdAt: Date.now() }],
      } satisfies ChannelsDoc,
      READABLE,
    );
  }

  // Upsert a participant into a channel's roster (read by the UI for @mention completion). Members
  // are added on join/send and never auto-removed — the roster outlives presence so offline/silent
  // participants stay mentionable.
  const touchMember = (channel: string, name: string, role: Member["role"]) =>
    serialize(memKey(channel), async () => {
      const res = await store.read(memKey(channel));
      const members = ((res?.data as MembersDoc | undefined)?.members ?? []).filter(
        (m) => m.name !== name,
      );
      members.push({ name, role, lastSeen: Date.now() });
      if (res) await store.write(memKey(channel), { members } satisfies MembersDoc);
      else await store.create(memKey(channel), { members } satisfies MembersDoc, READABLE);
    });

  // ---- handlers shared across roles (declared per-role in the contract, so `pending` never gets them) ----
  const sendFn = async (
    { channel, text }: { channel: string; text: string },
    ctx: Ctx,
    conn: Conn,
  ) => {
    const trimmed = text.trim();
    if (!trimmed) throw new SuperLineError("BAD_REQUEST", "empty message");
    cooldownCheck(ctx.name, channel);
    const id = await serialize(msgKey(channel), async () => {
      const res = await store.read(msgKey(channel));
      if (!res) throw new SuperLineError("NOT_FOUND", `no channel #${channel}`);
      const doc = res.data as MessagesDoc;
      const msg: Message = { id: randomUUID(), from: ctx.name, text: trimmed, at: Date.now() };
      const recent = doc.items.slice(-threadContext);
      await store.write(msgKey(channel), { items: [...doc.items, msg] } satisfies MessagesDoc);
      clearTyping(channel, ctx.name);
      pushToAgents(channel, { ...msg, channel, recent });
      return msg.id;
    });
    await touchMember(channel, ctx.name, memberRoleOf(conn));
    return { id };
  };

  const createChannelFn = async ({ name }: { name: string }, ctx: Ctx, conn: Conn) => {
    const id = slug(name);
    if (!id) throw new SuperLineError("BAD_REQUEST", "channel name is empty");
    await serialize(CHANNELS, async () => {
      if (await store.read(msgKey(id)))
        throw new SuperLineError("CONFLICT", `#${id} already exists`);
      await store.create(msgKey(id), { items: [] } satisfies MessagesDoc, READABLE);
      await store.create(memKey(id), { members: [] } satisfies MembersDoc, READABLE);
      const index = (await store.read(CHANNELS))?.data as ChannelsDoc;
      const channel = { id, name: name.trim(), createdAt: Date.now() };
      await store.write(CHANNELS, { channels: [...index.channels, channel] } satisfies ChannelsDoc);
    });
    await touchMember(id, ctx.name, memberRoleOf(conn));
    return { id };
  };

  const whoamiFn = async (_input: void, ctx: Ctx, conn: Conn) => ({
    name: ctx.name,
    role: conn.role as "user" | "agent" | "admin" | "pending",
  });
  const helloFn = async () => ({ users: presenceList() });
  const typingFn = async ({ channel }: { channel: string }, ctx: Ctx) => {
    markTyping(channel, ctx.name);
    return { ok: true };
  };

  const humanHandlers = {
    send: sendFn,
    createChannel: createChannelFn,
    whoami: whoamiFn,
    hello: helloFn,
    typing: typingFn,
  };

  srv.implement({
    user: humanHandlers,

    admin: {
      ...humanHandlers,
      listIdentities: async () => {
        const onlineSet = new Set(presenceList());
        return {
          identities: auth.list().map((i) => ({ ...i, online: onlineSet.has(i.name) })),
        };
      },
      lookupPending: async ({ code }) => {
        const r = pending.get(code);
        return r
          ? { found: true, desiredName: r.desiredName, kind: r.kind, ip: r.ip, at: r.at }
          : { found: false };
      },
      approve: async ({ code, name }, ctx) => {
        const req = pending.get(code);
        if (!req) throw new SuperLineError("NOT_FOUND", "no pending request for that code");
        const finalName = (name ?? req.desiredName).trim();
        if (!finalName) throw new SuperLineError("BAD_REQUEST", "a name is required");
        if (auth.byName(finalName))
          throw new SuperLineError("CONFLICT", `identity "${finalName}" already exists`);
        const key = auth.issue(finalName, req.kind, false);
        auth.audit(ctx.name, "approve", finalName);
        pending.delete(code);
        deliverGrant(code, req.connId, { key, name: finalName, kind: req.kind });
        return { ok: true, name: finalName };
      },
      revoke: async ({ name }, ctx) => {
        const id = auth.byName(name);
        if (!id) throw new SuperLineError("NOT_FOUND", `no identity "${name}"`);
        if (id.isAdmin && auth.adminCount() <= 1)
          throw new SuperLineError("FORBIDDEN", "cannot revoke the last admin");
        auth.revoke(name);
        auth.audit(ctx.name, "revoke", name);
        disconnectName(name);
        return { ok: true };
      },
      setAdmin: async ({ name, admin }, ctx) => {
        const id = auth.byName(name);
        if (!id) throw new SuperLineError("NOT_FOUND", `no identity "${name}"`);
        if (admin && id.kind === "agent")
          throw new SuperLineError("BAD_REQUEST", "agents cannot be admins");
        if (!admin && id.isAdmin && auth.adminCount() <= 1)
          throw new SuperLineError("FORBIDDEN", "cannot demote the last admin");
        auth.setAdmin(name, admin);
        auth.audit(ctx.name, admin ? "promote" : "demote", name);
        disconnectName(name); // reconnect picks up the new role
        return { ok: true };
      },
      forceDisconnect: async ({ name }, ctx) => {
        disconnectName(name);
        auth.audit(ctx.name, "force-disconnect", name);
        return { ok: true };
      },
      rename: async ({ name, newName }, ctx) => {
        const id = auth.byName(name);
        if (!id) throw new SuperLineError("NOT_FOUND", `no identity "${name}"`);
        const next = newName.trim();
        if (!next) throw new SuperLineError("BAD_REQUEST", "a new name is required");
        if (auth.byName(next))
          throw new SuperLineError("CONFLICT", `identity "${next}" already exists`);
        auth.rename(name, next);
        auth.audit(ctx.name, "rename", `${name} -> ${next}`);
        disconnectName(name);
        return { ok: true };
      },
      auditLog: async ({ limit }) => ({ entries: auth.readAudit(limit ?? 100) }),
    },

    agent: {
      send: sendFn,
      createChannel: createChannelFn,
      whoami: whoamiFn,
      join: async ({ channels }, ctx, conn) => {
        const joined = new Set(conn.data.channels);
        const added: string[] = [];
        for (const ch of channels ?? []) {
          if (!joined.has(ch)) added.push(ch);
          joined.add(ch);
        }
        conn.data.channels = [...joined];
        for (const ch of added) await touchMember(ch, ctx.name, "agent");
        return { name: ctx.name, channels: conn.data.channels };
      },
      leave: async ({ channel }, _ctx, conn) => {
        conn.data.channels = channel ? conn.data.channels.filter((c) => c !== channel) : [];
        return { channels: conn.data.channels };
      },
      history: async ({ channel, limit }) => {
        const res = await store.read(msgKey(channel));
        if (!res) throw new SuperLineError("NOT_FOUND", `no channel #${channel}`);
        const items = (res.data as MessagesDoc).items;
        return { messages: limit ? items.slice(-limit) : items };
      },
      who: async () => ({ agents: presenceList().map((name) => ({ name, online: true })) }),
      channels: async () => {
        const res = await store.read(CHANNELS);
        return { channels: (res?.data as ChannelsDoc | undefined)?.channels ?? [] };
      },
    },

    pending: {
      requestAccess: async ({ desiredName, kind, code }, ctx, conn) => {
        // re-attach / re-claim after a reconnect with a previously-issued code
        if (code) {
          const g = grants.get(code);
          if (g) {
            grants.delete(code);
            emitTo(conn, "grant", g);
            return { code };
          }
          const existing = pending.get(code);
          if (existing) {
            existing.connId = conn.id;
            return { code };
          }
        }
        if (pending.size >= MAX_PENDING)
          throw new SuperLineError("BAD_REQUEST", "too many pending requests; try again later");
        const name = desiredName.trim().slice(0, 60);
        let newCode = generatePairingCode();
        while (pending.has(newCode)) newCode = generatePairingCode();
        pending.set(newCode, {
          code: newCode,
          desiredName: name,
          kind,
          ip: ctx.ip,
          at: Date.now(),
          connId: conn.id,
        });
        return { code: newCode };
      },
    },
  });

  await new Promise<void>((resolve) => server.listen({ port, host }, resolve));
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;

  return {
    srv,
    http: server,
    auth,
    port: actualPort,
    host,
    close: async () => {
      clearInterval(sweep);
      await srv.close();
      if (!opts.authStore) auth.close();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}
