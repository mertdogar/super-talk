import { z } from "zod";
import { defineContract } from "@super-line/core";

/** A single chat message (as stored in a `messages:<channelId>` Resource). */
export const MessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  text: z.string(),
  at: z.number(),
});
export type Message = z.infer<typeof MessageSchema>;

/** A channel (as stored in the `channels` index Resource). */
export const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
});
export type Channel = z.infer<typeof ChannelSchema>;

/** What the hub pushes to agents: the message + its channel + recent thread context (loop guard #4). */
export const DeliverySchema = MessageSchema.extend({
  channel: z.string(),
  recent: z.array(MessageSchema).optional(),
});
export type Delivery = z.infer<typeof DeliverySchema>;

export const AgentInfoSchema = z.object({ name: z.string(), online: z.boolean() });
export type AgentInfo = z.infer<typeof AgentInfoSchema>;

/** A channel participant (as stored in a `members:<channelId>` Resource). */
export const MemberSchema = z.object({
  name: z.string(),
  role: z.enum(["user", "agent"]),
  lastSeen: z.number(),
});
export type Member = z.infer<typeof MemberSchema>;

/** The kind of an identity: a human (`user`) or an AI agent (`agent`). The `admin` super-line role
 * is a `user` whose key is flagged admin — admin is a privilege, not a separate kind. */
export const IdentityKindSchema = z.enum(["user", "agent"]);
export type IdentityKind = z.infer<typeof IdentityKindSchema>;

/** A row of the server-private identity store, as surfaced to the admin panel (never the key). */
export const IdentityInfoSchema = z.object({
  name: z.string(),
  kind: IdentityKindSchema,
  isAdmin: z.boolean(),
  createdAt: z.number(),
  lastSeenAt: z.number().nullable(),
  online: z.boolean(),
});
export type IdentityInfo = z.infer<typeof IdentityInfoSchema>;

/** An append-only audit row for an admin action (server-private). */
export const AuditEntrySchema = z.object({
  ts: z.number(),
  actor: z.string(),
  action: z.string(),
  target: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/** The `channels` index Resource shape (read by the UI via useResource). */
export interface ChannelsDoc {
  channels: Channel[];
}
/** A `messages:<channelId>` Resource shape (read by the UI via useResource). */
export interface MessagesDoc {
  items: Message[];
}
/** A `members:<channelId>` Resource shape — everyone who has joined/spoken (read by the UI for @mentions). */
export interface MembersDoc {
  members: Member[];
}

// ---- request/event specs, declared once and shared across roles ----------------------------------
// NOTE: there is intentionally NO `shared` contract section. `shared` requests are dispatchable by
// EVERY role (including `pending`), which would let an un-enrolled connection call `send`. Declaring
// the chat surface per-role keeps `pending` powerless by construction.

const send = {
  input: z.object({ channel: z.string(), text: z.string() }),
  output: z.object({ id: z.string() }),
};
const createChannel = {
  input: z.object({ name: z.string() }),
  output: z.object({ id: z.string() }),
};
const whoami = {
  input: z.void(),
  output: z.object({ name: z.string(), role: z.enum(["user", "agent", "admin", "pending"]) }),
};
const hello = { input: z.void(), output: z.object({ users: z.array(z.string()) }) };
const typing = { input: z.object({ channel: z.string() }), output: z.object({ ok: z.boolean() }) };

/** Requests every authenticated human (`user` + `admin`) can call. */
const humanRequests = { send, createChannel, whoami, hello, typing };
/** Topics every authenticated human subscribes to. */
const humanEvents = {
  presence: { payload: z.object({ users: z.array(z.string()) }), subscribe: true },
  typing: {
    payload: z.object({ byChannel: z.record(z.string(), z.array(z.string())) }),
    subscribe: true,
  },
} as const;

/** Admin-only management surface. Lives ONLY on the `admin` role → non-admins get NOT_FOUND. */
const adminRequests = {
  listIdentities: {
    input: z.void(),
    output: z.object({ identities: z.array(IdentityInfoSchema) }),
  },
  /** Resolve the one pending request bound to `code` (typed by the admin), optionally overriding the
   * requested name. Mints a key and pushes it to the pending socket. */
  approve: {
    input: z.object({ code: z.string(), name: z.string().optional() }),
    output: z.object({ ok: z.boolean(), name: z.string() }),
  },
  /** Read-only: look up a pending request by code to show name + IP before confirming. */
  lookupPending: {
    input: z.object({ code: z.string() }),
    output: z.object({
      found: z.boolean(),
      desiredName: z.string().optional(),
      kind: IdentityKindSchema.optional(),
      ip: z.string().optional(),
      at: z.number().optional(),
    }),
  },
  revoke: { input: z.object({ name: z.string() }), output: z.object({ ok: z.boolean() }) },
  setAdmin: {
    input: z.object({ name: z.string(), admin: z.boolean() }),
    output: z.object({ ok: z.boolean() }),
  },
  forceDisconnect: { input: z.object({ name: z.string() }), output: z.object({ ok: z.boolean() }) },
  rename: {
    input: z.object({ name: z.string(), newName: z.string() }),
    output: z.object({ ok: z.boolean() }),
  },
  auditLog: {
    input: z.object({ limit: z.number().int().positive().optional() }),
    output: z.object({ entries: z.array(AuditEntrySchema) }),
  },
};

/**
 * The single super-talk contract, shared by the hub and all clients (web UI + agent plugin).
 *
 * Four roles: `user` (human), `admin` (human with the management surface), `agent` (MCP plugin),
 * and `pending` (a connection with no key yet — it may only `requestAccess` and receive `grant`).
 * Role is derived server-side from the bearer key; the client never declares it authoritatively.
 *
 * Channels and history are NOT on the wire — they live off-contract in the `chat` Store
 * (persisted by store-sqlite, read live by the UI via useResource). The contract carries the
 * server-authoritative WRITES (`send`, `createChannel`), the agent push (`message` event), the
 * ephemeral presence/typing topics, the admin surface, and the enrollment handshake.
 */
export const api = defineContract({
  roles: {
    user: {
      clientToServer: { ...humanRequests },
      serverToClient: { ...humanEvents },
    },
    admin: {
      clientToServer: { ...humanRequests, ...adminRequests },
      serverToClient: { ...humanEvents },
    },
    agent: {
      // joined channels — scopes which channels' messages get pushed to this agent
      data: z.object({ channels: z.array(z.string()) }),
      clientToServer: {
        send,
        createChannel,
        whoami,
        join: {
          input: z.object({ channels: z.array(z.string()).optional() }),
          output: z.object({ name: z.string(), channels: z.array(z.string()) }),
        },
        leave: {
          input: z.object({ channel: z.string().optional() }),
          output: z.object({ channels: z.array(z.string()) }),
        },
        history: {
          input: z.object({ channel: z.string(), limit: z.number().int().positive().optional() }),
          output: z.object({ messages: z.array(MessageSchema) }),
        },
        who: {
          input: z.object({ channel: z.string().optional() }),
          output: z.object({ agents: z.array(AgentInfoSchema) }),
        },
        channels: { input: z.void(), output: z.object({ channels: z.array(ChannelSchema) }) },
      },
      serverToClient: {
        message: { payload: DeliverySchema },
      },
    },
    pending: {
      clientToServer: {
        /** Request enrollment. First call (no `code`) mints a pairing code; re-calling with a saved
         * `code` re-attaches this socket (and re-delivers an approved grant after a reconnect). */
        requestAccess: {
          input: z.object({
            desiredName: z.string(),
            kind: IdentityKindSchema,
            code: z.string().optional(),
          }),
          output: z.object({ code: z.string() }),
        },
      },
      serverToClient: {
        /** The minted key, pushed to the exact pending socket once an admin approves. */
        grant: {
          payload: z.object({ key: z.string(), name: z.string(), kind: IdentityKindSchema }),
        },
      },
    },
  },
});

export type Api = typeof api;
