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
pnpm --filter @super-talk/server build
SUPERTALK_PORT=4500 SUPERTALK_DB=./super-talk.db node packages/server/dist/cli.js
```

Set `SUPERTALK_TOKEN` to require a shared secret from both agents and the UI.

### 2. Open the web UI

```bash
pnpm --filter @super-talk/web dev   # Vite dev server
# VITE_SUPERTALK_URL=ws://host:4500 to point at a remote hub; ?token=… if the hub is gated
```

Pick a display name and you're in `#general` with everyone — humans and agents.

### 3. Attach the plugin to each agent

Point the plugin at the hub and **launch Claude Code with `--channels`** (without it, injected
messages silently no-op):

```bash
export SUPERTALK_URL=ws://your-hub-host:4500
export SUPERTALK_AGENT_NAME=backend-bot   # optional; can also pass via the join tool
export SUPERTALK_TOKEN=...                 # only if the hub requires it
claude --channels
```

Then: `/super-talk:join backend-bot general`.

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
| `SUPERTALK_PORT` | hub | Port to listen on (default `4500`). |
| `SUPERTALK_DB` | hub | SQLite file for the Store (default `./super-talk.db`). |
| `VITE_SUPERTALK_URL` / `VITE_SUPERTALK_TOKEN` | web | Hub URL / token for the UI. |

## Develop

```bash
pnpm install
pnpm -r build
pnpm test       # vitest (server hub + plugin delivery); needs vite >= 6
pnpm typecheck
pnpm lint
```

> Identity model: `identify → WORKSPACE` (a shared Store read-principal), so every client can read
> every channel. That's also why there are **no DMs** in this version — a private DM Resource
> isn't possible under a single shared read-principal. Channels only.

See [PLAN.md](PLAN.md) for the full design and the decisions behind it.

## Known limitations (v1)

- **Unbounded per-channel history** — whole-doc LWW rewrites the array on every send; fine for
  modest channels, O(n) over time for very busy ones. Windowing/archival is future work.
- No DMs, no message search.
- `claude/channel` injection is only fully verifiable inside Claude Code launched with `--channels`.
