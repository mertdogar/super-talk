# super-talk — Plan (v2)

A communication primitive for AI agents **and humans**. One hub relays messages between agents
(over MCP, pushed into each agent via Claude Code's `claude/channel`) and humans (a web UI). All
channels and message history live in a durable **Store** (SQLite); the UI reads it live, agents
read it on demand and get pushed new messages.

## The spine

- **Store is the single source of truth.** Channels (`channels` index) and history
  (`messages:<channel>`) are Resources in a `chat` Store, server-written, backed by
  `@super-line/store-sqlite` (durable) — `store-memory` in tests.
- **Send path (one shared handler, both roles):** `send({channel, text})` →
  append to `messages:<channel>` (durable + UI live-sync via `useResource`) **and**
  `conn.emit('message', …)` to agent connections in that channel (→ claude/channel push).
  Humans receive via the Store; agents via the event.
- **Receive:** humans via `useResource` (reactive). Agents via the `message` event → the plugin
  emits `notifications/claude/channel` → Claude Code injects a `<channel>` block next turn.

## Roles (one hub, two surfaces)

- **`user`** (web UI): `hello`, `typing` requests; `presence`, `typing` topics; reads Resources.
- **`agent`** (MCP plugin): `join`/`leave` (room membership = push scope, tracked in `conn.data`),
  `history`, `who`, `channels` requests; receives the `message` event.
- **`shared`**: `send`, `createChannel` — both roles call the same handlers.

## Decisions (locked)

| Area | Decision |
|---|---|
| Source of truth | sqlite **Store**, canonical; server **dual-writes** (Store + agent `message` event) |
| Persistence | **Durable** (survives restart). `store-sqlite` in prod, `store-memory` in tests |
| History size | **Unbounded v1** (whole-doc LWW; known scaling debt — O(n) writes over time) |
| Namespace | **Shared**: humans + agents in the same channels & presence list |
| Identity | `identify → WORKSPACE` (shared Store read-principal). DMs would need per-name principals → none in v1 |
| Dedup / auth | Agent names **unique**; human names may repeat (multi-tab); `SUPERTALK_TOKEN` gates **both** roles if set |
| DMs | **None in v1** — channels only; `send` requires a channel |
| UI | Vendored from super-line's `advanced-chat-app` into `packages/web` (adapted: `@super-talk/core`, hub URL, rebrand) |
| Deps | published `@super-line/{store-sqlite,store-memory,react,client,core,server,transport-websocket}` |
| Loop guards | kept: no-new-info (prompt), self-drop (plugin), per-**channel** cooldown (hub), `recent` thread context on the agent event |

## Repo layout

```
packages/
  core/    → rewritten: two-role Store-based contract (user + agent + shared), message/channel schemas
  server/  → merged two-role hub: sqlite Store, presence + typing, createChannel/send (+ agent push),
             agent join/leave/history/who/channels, token auth + per-channel cooldown. super-talk-server bin
  plugin/  → lightly adjusted: drop DMs (`to`), `send` requires a channel, add `channels` tool
  web/     → vendored chat UI (React + Vite + Tailwind + shadcn), role `user`, points at the hub
```

## Store details

- ACL: every Resource created `{ WORKSPACE: { read: true, write: false } }`; server is sole writer.
- Per-key read-modify-write **serialized** (whole-doc LWW would otherwise clobber concurrent appends).
- Seed `general` on first run; subsequent restarts reuse the SQLite file.
- `messages:<channel> = { items: Message[] }`, `channels = { channels: Channel[] }`.
- `Message = { id, from, text, at }`, `Channel = { id, name, createdAt }`.

## Build sequence

1. `core` — two-role contract + schemas. Typecheck.
2. `server` — merged hub (Store + presence/typing + agent push + auth/cooldown). Tests over a loopback (store-memory).
3. `web` — vendor + adapt the UI.
4. `plugin` — drop DMs, add `channels`, update delivery mapping.
5. Verify: typecheck, tests, lint across all packages.

## Known debt / out of scope (v1)

- Unbounded per-channel array (O(n) writes); add windowing/archival later.
- No DMs, no human↔agent direct messaging.
- No message search / scrollback beyond the live Resource.
- `claude/channel` injection still only fully verifiable inside Claude Code with `--channels`.
