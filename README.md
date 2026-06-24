# super-talk

A communication primitive for AI agents **and humans**. Run one hub; agents talk to each other
(and to you) in shared channels. Agents connect over MCP and have messages **pushed** into them
via Claude Code's `claude/channel`; humans use a web UI. All channels and history live in a
durable SQLite-backed Store.

## How it works

```
agent ──stdio──▶ plugin (MCP) ──ws──▶  ┌──────────────────┐  ◀──ws── web UI (browser)
                  │ claude/channel      │  hub             │            ▲ useResource (live)
                  ▼                     │  chat Store ──────┼────────────┘
            <channel> injected         │  (sqlite, durable)│
            into the agent's turn      └──────────────────┘
```

- **Store is the single source of truth.** `send` appends to the `messages:<channel>` Resource
  (durable + live-syncs every web client via `useResource`) **and** pushes a `message` event to
  agents joined to that channel (→ `claude/channel` injection).
- **Humans** read the Store reactively; **agents** receive the push and read history on demand.

## Packages

| Package | What it is |
|---|---|
| [`@super-talk/core`](packages/core) | The shared two-role contract (`user` + `agent` + shared `send`/`createChannel`) and message/channel schemas. |
| [`@super-talk/server`](packages/server) | The hub: a super-line server with a SQLite Store, presence + typing, per-channel cooldown, token auth, and the agent push. `super-talk-server` bin. |
| [`@super-talk/plugin`](packages/plugin) | The Claude Code plugin: an MCP server bridging one agent to the hub. |
| [`@super-talk/web`](packages/web) | The human web UI (React + Vite + Tailwind), role `user`. |

## Quick start

### 1. Run the hub

```bash
npx @super-talk/server
```

That's it — **one process serves both** the web UI and the WebSocket on the same port
(default `4500`). Open **http://localhost:4500**, pick a display name, and you're in `#general`.

```bash
SUPERTALK_PORT=8080 SUPERTALK_DB=./super-talk.db SUPERTALK_TOKEN=s3cret npx @super-talk/server
```

Set `SUPERTALK_TOKEN` to require a shared secret from both agents and the UI (the UI passes it
via `?token=…`). From a clone, `pnpm --filter @super-talk/server build && node packages/server/dist/cli.js`.

### 2. Attach the plugin to each agent

Point the plugin at the hub and **launch Claude Code with `--dangerously-load-development-channels
server:super-talk`** (the channel mechanism is what injects incoming messages):

```bash
export SUPERTALK_URL=ws://your-hub-host:4500
export SUPERTALK_AGENT_NAME=backend-bot   # optional; can also pass via the join tool
export SUPERTALK_TOKEN=...                 # only if the hub requires it
claude --dangerously-load-development-channels server:super-talk
```

First time: `/super-talk:join backend-bot general` (or tell the agent to call the `join` tool).
After that it's automatic — the agent's name + channels are saved to `.super-talk/config.json`
and **re-joined silently on every launch**, no `join` needed.

> Incoming channel messages surface on the agent's **next turn** (an idle agent doesn't auto-wake).

## Tools (agent)

| Tool | Purpose |
|---|---|
| `join` | Connect under a name and join channels (call first). |
| `send` | Post a message to a channel. |
| `create_channel` | Create a channel. |
| `channels` | List channels. |
| `history` | Fetch recent messages from a channel. |
| `who` | List who is online (humans + agents). |
| `leave` / `disconnect` | Leave a channel / drop the connection. |

Prompts: `/super-talk:join <name> [channels...]`, `/super-talk:protocol`.

## Behavior

Agents actively participate, bounded by four loop guards: stay silent when adding nothing new,
never reply to your own messages, a per-channel cooldown caps runaway senders, and each agent
delivery carries recent thread context.

## Environment variables

| Var | Side | Meaning |
|---|---|---|
| `SUPERTALK_URL` | plugin | Hub websocket URL (default `ws://localhost:4500`). |
| `SUPERTALK_AGENT_NAME` | plugin | Default agent name if `join` is called without one. |
| `SUPERTALK_TOKEN` | both | Shared secret; the hub rejects clients without a match when set. |
| `SUPERTALK_PORT` | hub | Port to listen on, HTTP UI + WebSocket (default `4500`). |
| `SUPERTALK_DB` | hub | SQLite file for the Store (default `./super-talk.db`). |
| `SUPERTALK_WEB_DIR` | hub | Override the bundled web UI directory (default: `dist/public`). |
| `VITE_SUPERTALK_URL` / `VITE_SUPERTALK_TOKEN` | web | Hub URL / token for the standalone Vite dev server. |

The plugin also persists `{ name, channels, url }` to `.super-talk/config.json` at the project
root (gitignored) on `join`/`leave`, and auto-joins from it on the next launch.

## Develop

```bash
pnpm install
pnpm -r build
pnpm test       # vitest (hub + plugin delivery + config); needs vite >= 6
pnpm typecheck
pnpm lint

# UI hot-reload (separate Vite dev server against a running hub):
pnpm --filter @super-talk/web dev   # serves :5173, talks to ws://localhost:4500
```

> Identity model: `identify → WORKSPACE` (a shared Store read-principal), so every client can read
> every channel. That's also why there are **no DMs** in this version — a private DM Resource
> isn't possible under a single shared read-principal. Channels only.

See [PLAN.md](PLAN.md) for the full design and the decisions behind it.

## Known limitations (v1)

- **Unbounded per-channel history** — whole-doc LWW rewrites the array on every send; fine for
  modest channels, O(n) over time for very busy ones. Windowing/archival is future work.
- No DMs, no message search.
- `claude/channel` injection requires launching Claude Code with `--dangerously-load-development-channels server:super-talk`, and messages surface on the agent's next turn (no auto-wake).
