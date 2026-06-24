import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createSuperLineClient, type SuperLineClient } from "@super-line/client";
import { webSocketClientTransport } from "@super-line/transport-websocket";
import { api, type Delivery } from "@super-talk/core";
import { readConfig, writeConfig } from "./config.js";
import { channelNotificationFor } from "./delivery.js";

const ENV_URL = process.env.SUPERTALK_URL || "";
const ENV_NAME = process.env.SUPERTALK_AGENT_NAME || "";
const TOKEN = process.env.SUPERTALK_TOKEN || "";
const DEFAULT_URL = "ws://localhost:4500";

const PRIMER = `You are connected to super-talk, shared channels where AI agents and humans collaborate.

Incoming messages arrive as <channel> blocks (meta carries from / channel / message_id).
You actively participate: reply when you have something substantive to add. But keep the
conversation from spinning in circles:
1. No new info → stay silent. If you'd only be acknowledging ("ok", "thanks", "got it"), don't send.
2. Never reply to your own messages.
3. Don't rapidly ping-pong in one channel — the hub rate-limits runaway senders.
4. Each delivery includes recent thread context; read it and notice when a thread is winding down.

Tools: join (connect + join channels), send (post to a channel), create_channel, channels (list),
history (catch up on a channel), who (see who's online), leave/disconnect.`;

const mcp = new Server(
  { name: "super-talk", version: "0.1.0" },
  {
    capabilities: { tools: {}, prompts: {}, experimental: { "claude/channel": {} } },
    instructions: PRIMER,
  },
);

let client: SuperLineClient<typeof api, "agent"> | null = null;
let selfName = "";
let selfUrl = "";
let joinedChannels: string[] = [];

function deliver(d: Delivery) {
  const note = channelNotificationFor(d, selfName); // null when it's our own message (loop guard #2)
  if (!note) return;
  void mcp.notification({
    method: "notifications/claude/channel",
    params: note as unknown as Record<string, unknown>,
  });
}

function persist() {
  writeConfig({ name: selfName, channels: joinedChannels, url: selfUrl });
}

async function connect(name: string, url: string, channels?: string[]) {
  selfName = name;
  selfUrl = url;
  client = createSuperLineClient(api, {
    transport: webSocketClientTransport({ url }),
    role: "agent",
    params: { name, ...(TOKEN ? { token: TOKEN } : {}) },
  });
  client.on("message", deliver);
  const res = await client.join({ channels });
  joinedChannels = res.channels;
  persist();
  return res;
}

function requireClient(): SuperLineClient<typeof api, "agent"> {
  if (!client) throw new Error("not connected — call the `join` tool first");
  return client;
}

const TOOLS = [
  {
    name: "join",
    description:
      "Connect to the super-talk hub under a name and join channels. Call this first. " +
      "Name defaults to SUPERTALK_AGENT_NAME if omitted.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: 'This agent’s unique name (e.g. "backend-bot").' },
        channels: { type: "array", items: { type: "string" }, description: "Channels to join." },
      },
    },
  },
  {
    name: "send",
    description:
      "Send a message to a channel. The channel must exist (create it with create_channel).",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel to send to." },
        text: { type: "string", description: "Message text." },
      },
      required: ["channel", "text"],
    },
  },
  {
    name: "create_channel",
    description: "Create a new channel.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Channel name." } },
      required: ["name"],
    },
  },
  {
    name: "channels",
    description: "List the channels that exist.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "history",
    description: "Fetch recent messages from a channel to catch up.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel to read." },
        limit: { type: "number", description: "Max messages (most recent)." },
      },
      required: ["channel"],
    },
  },
  {
    name: "who",
    description: "List who is online (humans and agents).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "leave",
    description: "Leave a channel, or all channels if none given (stays connected).",
    inputSchema: {
      type: "object",
      properties: { channel: { type: "string", description: "Channel to leave (optional)." } },
    },
  },
  {
    name: "disconnect",
    description: "Disconnect from the super-talk hub entirely.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  try {
    const result = await runTool(req.params.name, args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true };
  }
});

async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "join": {
      const saved = readConfig();
      const agentName = (args.name as string) || ENV_NAME || saved?.name || "";
      if (!agentName) throw new Error("no name given and SUPERTALK_AGENT_NAME is not set");
      const channels = args.channels as string[] | undefined;
      if (client) {
        const res = await client.join({ channels });
        joinedChannels = res.channels;
        persist();
        return res;
      }
      const url = ENV_URL || saved?.url || DEFAULT_URL;
      return connect(agentName, url, channels);
    }
    case "send":
      return requireClient().send({
        channel: args.channel as string,
        text: args.text as string,
      });
    case "create_channel":
      return requireClient().createChannel({ name: args.name as string });
    case "channels":
      return requireClient().channels();
    case "history":
      return requireClient().history({
        channel: args.channel as string,
        limit: args.limit as number | undefined,
      });
    case "who":
      return requireClient().who({});
    case "leave": {
      const res = await requireClient().leave({ channel: args.channel as string | undefined });
      joinedChannels = res.channels;
      persist();
      return res;
    }
    case "disconnect": {
      // session-scoped: drop the connection but keep the config so next start auto-joins
      client?.close();
      client = null;
      selfName = "";
      return { ok: true };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

const PROMPTS = [
  {
    name: "join",
    description: "Join super-talk under a name and announce yourself.",
    arguments: [
      { name: "name", description: "The name to join as.", required: true },
      { name: "channels", description: "Space-separated channels to join.", required: false },
    ],
  },
  { name: "protocol", description: "The super-talk etiquette and loop-guard rules." },
];

mcp.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));

mcp.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const a = (req.params.arguments ?? {}) as Record<string, string>;
  if (req.params.name === "protocol") {
    return { messages: [{ role: "user", content: { type: "text", text: PRIMER } }] };
  }
  if (req.params.name === "join") {
    const name = a.name || ENV_NAME || "<pick-a-name>";
    const channels = a.channels ? a.channels.split(/\s+/).filter(Boolean) : [];
    const chArg = channels.length ? `, channels: ${JSON.stringify(channels)}` : "";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Call the super-talk \`join\` tool with name: "${name}"${chArg}. ` +
              `Then post a brief hello so others know you're online.`,
          },
        },
      ],
    };
  }
  throw new Error(`unknown prompt: ${req.params.name}`);
});

await mcp.connect(new StdioServerTransport());

// Auto-join: if a previous session saved a config, reconnect silently (no hello). Fire-and-forget
// so startup never blocks; graceful on failure (hub down or name already taken) — the join tool
// can still be used to (re)connect with another name.
{
  const saved = readConfig();
  if (saved?.name) {
    connect(saved.name, ENV_URL || saved.url || DEFAULT_URL, saved.channels).catch((err) => {
      console.error(`[super-talk] auto-join failed: ${(err as Error).message}`);
    });
  }
}
