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
  type Member,
  type MembersDoc,
  type Message,
  type MessagesDoc,
} from "@super-talk/core";

export interface HubOptions {
  /** Port to listen on. Defaults to 4500. */
  port?: number;
  /** Shared secret. When set, clients (UI + agents) must pass a matching `token` handshake param. */
  token?: string;
  /** The `chat` Store's server half. Defaults to a SQLite store at `dbFile`. */
  store?: ServerStore;
  /** SQLite file for the default store. Defaults to `./super-talk.db`. Ignored if `store` is given. */
  dbFile?: string;
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
type AgentData = { channels: string[] };

type Auth = { role: "user"; ctx: Ctx } | { role: "agent"; ctx: Ctx };

export interface Hub {
  srv: SuperLineServer<typeof api, Auth>;
  http: http.Server;
  port: number;
  close(): Promise<void>;
}

const WORKSPACE = "workspace";
const READABLE = { [WORKSPACE]: { read: true, write: false } };
const CHANNELS = "channels";
const msgKey = (id: string) => `messages:${id}`;
const memKey = (id: string) => `members:${id}`;
const nameOf = (conn: Conn) => (conn.ctx as Ctx).name;
const slug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** Create and start a super-talk hub. Resolves once it is listening. */
export async function createHub(opts: HubOptions = {}): Promise<Hub> {
  const port = opts.port ?? 4500;
  const token = opts.token;
  const threadContext = opts.threadContext ?? 6;
  const cooldownMax = opts.cooldownMax ?? 12;
  const cooldownWindowMs = opts.cooldownWindowMs ?? 10_000;
  // lazy import: only load store-sqlite (better-sqlite3, native) when actually using it, so tests
  // and typecheck that pass an in-memory store never touch the native binding.
  const chatStore =
    opts.store ??
    (await import("@super-line/store-sqlite")).sqliteStoreServer({
      file: opts.dbFile ?? "./super-talk.db",
    });

  // ---- presence: ephemeral, name-keyed online counts (a name may have several connections) ----
  const online = new Map<string, number>();
  const presenceList = () => [...online.keys()].sort();
  const publishPresence = () => srv.forRole("user").publish("presence", { users: presenceList() });
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
    let pushed = 0;
    for (const c of agents) {
      const joined = (c.data as AgentData).channels ?? [];
      const match = joined.includes(channel);
      console.log(
        `[super-talk] push #${channel} -> agent "${nameOf(c)}" joined=[${joined.join(", ")}] ${match ? "DELIVER" : "skip"}`,
      );
      if (!match) continue;
      (c as unknown as { emit: (event: "message", data: Delivery) => void }).emit(
        "message",
        delivery,
      );
      pushed++;
    }
    console.log(
      `[super-talk] "${delivery.from}" sent to #${channel}: ${agents.length} agent conn(s), delivered to ${pushed}`,
    );
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
    authenticate: (h) => {
      if (token && h.query.token !== token)
        throw new SuperLineError("UNAUTHORIZED", "invalid token");
      const name = typeof h.query.name === "string" ? h.query.name.trim() : "";
      if (!name) throw new SuperLineError("UNAUTHORIZED", "a non-empty `name` is required");
      if (h.query.role === "agent") {
        if (srv.local.connections.some((c) => nameOf(c) === name)) {
          throw new SuperLineError("FORBIDDEN", `the name "${name}" is already in use`);
        }
        return { role: "agent" as const, ctx: { name } satisfies Ctx };
      }
      return { role: "user" as const, ctx: { name } satisfies Ctx };
    },
    onConnection: (conn) => {
      if (conn.role === "agent") conn.data = { channels: [] } as AgentData;
      bumpPresence(nameOf(conn), +1);
    },
    onDisconnect: (conn) => bumpPresence(nameOf(conn), -1),
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

  srv.implement({
    shared: {
      send: async ({ channel, text }, ctx, conn) => {
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
        await touchMember(channel, ctx.name, conn.role);
        return { id };
      },

      createChannel: async ({ name }, ctx, conn) => {
        const id = slug(name);
        if (!id) throw new SuperLineError("BAD_REQUEST", "channel name is empty");
        await serialize(CHANNELS, async () => {
          if (await store.read(msgKey(id)))
            throw new SuperLineError("CONFLICT", `#${id} already exists`);
          await store.create(msgKey(id), { items: [] } satisfies MessagesDoc, READABLE);
          await store.create(memKey(id), { members: [] } satisfies MembersDoc, READABLE);
          const index = (await store.read(CHANNELS))?.data as ChannelsDoc;
          const channel = { id, name: name.trim(), createdAt: Date.now() };
          await store.write(CHANNELS, {
            channels: [...index.channels, channel],
          } satisfies ChannelsDoc);
        });
        await touchMember(id, ctx.name, conn.role);
        return { id };
      },
    },

    user: {
      hello: async () => ({ users: presenceList() }),
      typing: async ({ channel }, ctx) => {
        markTyping(channel, ctx.name);
        return { ok: true };
      },
    },

    agent: {
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
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;

  return {
    srv,
    http: server,
    port: actualPort,
    close: async () => {
      await srv.close();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}
