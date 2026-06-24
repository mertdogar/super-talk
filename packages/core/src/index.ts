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

/**
 * The single super-talk contract, shared by the hub and both clients (web UI + agent plugin).
 *
 * Channels and history are NOT on the wire — they live off-contract in the `chat` Store
 * (persisted by store-sqlite, read live by the UI via useResource). The contract carries the
 * server-authoritative WRITES (`send`, `createChannel` — shared by both roles), the agent push
 * (`message` event), and the ephemeral presence/typing topics.
 */
export const api = defineContract({
  shared: {
    clientToServer: {
      send: {
        input: z.object({ channel: z.string(), text: z.string() }),
        output: z.object({ id: z.string() }),
      },
      createChannel: {
        input: z.object({ name: z.string() }),
        output: z.object({ id: z.string() }),
      },
    },
  },
  roles: {
    user: {
      clientToServer: {
        // seed the current presence list on mount (topics aren't retained)
        hello: { input: z.void(), output: z.object({ users: z.array(z.string()) }) },
        typing: { input: z.object({ channel: z.string() }), output: z.object({ ok: z.boolean() }) },
      },
      serverToClient: {
        presence: { payload: z.object({ users: z.array(z.string()) }), subscribe: true },
        typing: {
          payload: z.object({ byChannel: z.record(z.string(), z.array(z.string())) }),
          subscribe: true,
        },
      },
    },
    agent: {
      // joined channels — scopes which channels' messages get pushed to this agent
      data: z.object({ channels: z.array(z.string()) }),
      clientToServer: {
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
  },
});

export type Api = typeof api;
