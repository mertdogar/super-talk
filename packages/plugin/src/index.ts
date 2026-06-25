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
const ENV_KEY = process.env.SUPERTALK_KEY || "";
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
let pendingClient: SuperLineClient<typeof api, "pending"> | null = null;
let selfName = "";
let selfUrl = "";
let selfKey = "";
let pendingCode = "";
let enrollChannels: string[] = [];
let joinedChannels: string[] = [];
let reconnectWatcher: ReturnType<typeof setInterval> | null = null;

function deliver(d: Delivery) {
  const note = channelNotificationFor(d, selfName); // null when it's our own message (loop guard #2)
  if (!note) return;
  void mcp.notification({
    method: "notifications/claude/channel",
    params: note as unknown as Record<string, unknown>,
  });
}

function persist() {
  writeConfig({ name: selfName, channels: joinedChannels, url: selfUrl, key: selfKey });
}

/** Connect (or reconnect) as an authenticated agent using a granted bearer key. */
async function connectAgent(key: string, url: string, channels?: string[]) {
  selfUrl = url;
  selfKey = key;
  client = createSuperLineClient(api, {
    transport: webSocketClientTransport({ url }),
    role: "agent",
    params: { key },
  });
  client.on("message", deliver);
  const res = await client.join({ channels });
  selfName = res.name; // identity is the key's — the server tells us our name
  joinedChannels = res.channels;
  persist();
  watchReconnect();
  return res;
}

/** Begin enrollment: open a `pending` connection, request a pairing code, and wait (in the
 * background) for an admin to approve it. Resolves with the code for the human to get approved. */
async function enroll(desiredName: string, url: string, channels: string[]): Promise<string> {
  selfName = desiredName;
  selfUrl = url;
  enrollChannels = channels;
  pendingClient?.close();
  pendingClient = createSuperLineClient(api, {
    transport: webSocketClientTransport({ url }),
    role: "pending",
    params: { name: desiredName, kind: "agent" },
  });
  pendingClient.on("grant", onGrant);
  // reuse a saved code so a restart re-attaches to the same request instead of spawning a new one
  const saved = readConfig();
  const resume = saved?.code && saved.name === desiredName ? saved.code : undefined;
  const { code } = await pendingClient.requestAccess({ desiredName, kind: "agent", code: resume });
  pendingCode = code;
  writeConfig({ name: desiredName, channels, url, code });
  console.error(`[super-talk] enrollment pending — pairing code: ${code}`);
  return code;
}

/** Admin approved: swap the pending socket for an authenticated agent connection and persist the key. */
function onGrant(grant: { key: string; name: string; kind: string }): void {
  pendingClient?.close();
  pendingClient = null;
  pendingCode = "";
  connectAgent(grant.key, selfUrl, enrollChannels)
    .then(() => console.error(`[super-talk] enrollment approved — connected as "${grant.name}".`))
    .catch((err) =>
      console.error(`[super-talk] connect after grant failed: ${(err as Error).message}`),
    );
}

// super-line replays topics on reconnect but NOT requests, so a dropped+restored socket (e.g. the
// hub restarting) leaves the agent online but joined to nothing. No reconnect event is exposed, so
// poll `connected` and re-join on a down→up transition to restore the server-side subscriptions.
function watchReconnect() {
  if (reconnectWatcher) clearInterval(reconnectWatcher);
  let wasConnected = true;
  reconnectWatcher = setInterval(() => {
    if (!client) return;
    const now = client.connected;
    if (now && !wasConnected) {
      client.join({ channels: joinedChannels }).catch((err) => {
        console.error(`[super-talk] re-join after reconnect failed: ${(err as Error).message}`);
      });
    }
    wasConnected = now;
  }, 1000);
}

function requireClient(): SuperLineClient<typeof api, "agent"> {
  if (client) return client;
  if (pendingClient)
    throw new Error(
      `enrollment pending — ask a super-talk admin to approve pairing code ${pendingCode} in the web UI`,
    );
  throw new Error("not connected — call the `join` tool first");
}

const TOOLS = [
  {
    name: "join",
    description:
      "Connect to the super-talk hub and join channels. Call this first. If this agent isn't " +
      "enrolled yet, it returns a pairing code to have a super-talk admin approve in the web UI; " +
      "once approved it connects automatically. Name defaults to SUPERTALK_AGENT_NAME if omitted.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: 'This agent’s unique name (e.g. "backend-bot").' },
        channels: { type: "array", items: { type: "string" }, description: "Channels to join." },
        url: {
          type: "string",
          description: "Hub URL (defaults to the saved/env URL or localhost).",
        },
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
      const channels = (args.channels as string[] | undefined) ?? saved?.channels ?? [];
      const url = (args.url as string) || ENV_URL || saved?.url || DEFAULT_URL;
      const key = ENV_KEY || saved?.key || "";
      if (client) {
        // already an authenticated agent — just (re)join the requested channels
        const res = await client.join({ channels });
        joinedChannels = res.channels;
        persist();
        return res;
      }
      if (key) return connectAgent(key, url, channels);
      // no key yet → enroll. Returns a pairing code; an admin approves it, then we connect in the
      // background (no agent turn needed) and `send`/`who`/etc. start working.
      if (!agentName) throw new Error("no name given and SUPERTALK_AGENT_NAME is not set");
      const code = await enroll(agentName, url, channels);
      return {
        status: "pending_approval",
        code,
        message:
          `Enrollment started. Ask a super-talk admin to approve pairing code ${code} in the ` +
          `web UI. Once approved you'll be connected automatically — no need to call join again.`,
      };
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
      // session-scoped: drop the connection but keep the config so next start auto-connects
      if (reconnectWatcher) clearInterval(reconnectWatcher);
      reconnectWatcher = null;
      client?.close();
      pendingClient?.close();
      client = null;
      pendingClient = null;
      selfName = "";
      pendingCode = "";
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

// Auto-connect: a saved key reconnects silently; a saved code (interrupted mid-enrollment) re-attaches
// to the same pairing request. Fire-and-forget so startup never blocks; graceful on failure.
{
  const saved = readConfig();
  const url = ENV_URL || saved?.url || DEFAULT_URL;
  const key = ENV_KEY || saved?.key || "";
  if (key) {
    connectAgent(key, url, saved?.channels).catch((err) =>
      console.error(`[super-talk] auto-connect failed: ${(err as Error).message}`),
    );
  } else if (saved?.name && saved?.code) {
    enroll(saved.name, url, saved.channels).catch((err) =>
      console.error(`[super-talk] resume enrollment failed: ${(err as Error).message}`),
    );
  }
}
