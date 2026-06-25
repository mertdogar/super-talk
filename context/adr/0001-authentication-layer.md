# ADR 0001 — Authentication layer (device-pairing enrollment + per-identity keys)

- **Status:** Accepted — 2026-06-25
- **Supersedes:** the shared-secret `SUPERTALK_TOKEN` model
- **Scope:** one self-hosted, internet-reachable workspace. Not multi-tenant.

## Context

Today the hub's entire "auth" is one optional shared secret (`SUPERTALK_TOKEN`),
passed as `?token=` by **both** agents and humans. Identity is a self-declared
`name` in the query string — never verified. Agent names are forced unique at
connect; human names may collide. `identify → WORKSPACE` gives every connected
client read access to every channel. The hub binds `0.0.0.0` by default and ships
as `npx @super-talk/server` for anyone to self-host.

"Proper auth" here means: each agent and human holds its **own revocable
credential bound to its identity**, a claimed name is actually *attested*, and
the hub is gated by real per-identity secrets — **without** building accounts,
signup, or tenant isolation. The single `WORKSPACE` read-principal and shared
channels stay; this is authentication and admission control, not authorization
redesign.

The enrollment mechanism is a **device-authorization / pairing flow** (RFC 8628
in spirit): an agent or human connects in a powerless `pending` state, an admin
approves it by typing an out-of-band **pairing code**, and the server pushes a
minted key down the pending socket. This fits super-talk: the approver is already
in the (now-authenticated) web UI, the agent is headless, and `/super-talk init`
is the natural trigger.

### What super-line already gives us (verified against `@super-line/*@0.5.0`)

| Need | Status | Primitive |
|---|---|---|
| Third `pending` role with empty surface | reuse | `roles: { pending: … }`; dispatch returns `NOT_FOUND` for unimplemented requests — "powerless" is framework-enforced |
| Weak/anonymous connect | reuse | `authenticate(h)` (async) may return `{ role:"pending", ctx }` with no credential; sees `h.query`, `h.headers`, and `h.raw.socket.remoteAddress` (client IP) |
| Push a key to one socket | reuse | `conn.emit(event, data)` / `srv.toConn(id).emit(…)`; find it via `srv.local.connections.find(…)` |
| `grant` server→client event | reuse | declare in `serverToClient`, `client.on("grant", …)` |
| Admin-only surface | reuse | role-scoped requests/topics on the `admin` role — non-admins get `NOT_FOUND` by construction |
| Role derived from credential | reuse | `authenticate` returns the role; the client no longer declares it |
| Re-attach a dropped pending request | **build** | `conn.id` is new on every reconnect, no resume — track requests by **code** in a server-private map |

The MCP plugin is a **persistent stdio process** that holds its WS connection
across agent turns. So a pending socket survives a multi-minute approval wait, and
the plugin's `grant` handler can write the key and reconnect with **zero agent
turns** — the agent is silently authenticated by its next action. The flow only
needs re-init if Claude Code itself restarts mid-wait.

## Decision

### Roles & contract — `{ user, agent, pending, admin }`

- The chat surface (`send`, `createChannel`, `whoami`, `hello`, `typing`,
  `presence`/`typing` topics) is declared **per-role** on `user`/`admin`/`agent`,
  NOT in the contract's `shared` section. (Implementation finding: super-line
  dispatches `shared` requests for *every* role — including `pending` — so a
  `shared` `send` would let an un-enrolled connection post. Per-role declaration
  keeps `pending` powerless by construction; the handler functions are still
  defined once and reused across roles.)
- **`pending`** — surface is only `requestAccess({ desiredName }) → { code }` plus
  the `grant` server→client event. Everything else is `NOT_FOUND`.
- **`admin`** — `listIdentities`, `approve(code)`, `revoke`, `setAdmin`,
  `forceDisconnect`, `rename`, `auditLog`. These exist *only* on the admin
  surface, so the panel's data and actions are unreachable for non-admins by
  construction (this is why `admin` is a distinct role, not a `ctx` flag).
- **Role is derived from the key at `authenticate`, never from the client.** The
  client stops sending `?name=`/`?role=`. Mapping: no key → `pending`; agent key →
  `agent`; admin-flagged key → `admin`; otherwise → `user`. The web UI learns its
  own name back via `hello`/`whoami`. The old agent-name-uniqueness hack is
  **deleted** — issuance guarantees uniqueness.

### Enrollment — one path for humans and agents

```
no key → connect PENDING → requestAccess({ desiredName })
       → server mints CODE (CSPRNG ~37 bits, single-use, short TTL, attempt-rate-limited)
       → agent prints code in its terminal  /  web UI shows it on a pre-auth screen
admin  → types code in panel → server resolves THE one request
       → shows requested name + source IP → admin confirms (or overrides name)
       → key stashed by code (commit-on-delivery) → emit `grant` to that exact socket
client → store key (config.json for agents, localStorage for humans) → reconnect authed
       (socket dropped mid-approval? agent re-attaches with its saved code;
        grant unclaimed past TTL → discarded, so no dangling key ever exists)
```

- **Pairing code is the only selector.** Approval is resolved by the typed code —
  never by clicking a name — because the requested name is attacker-controlled.
  The attacker cannot display the code sitting in the legit agent's terminal, so a
  spammed `desiredName: "backend-bot"` request is never the one approved.
- **Requested name is advisory**: the admin confirms/overrides it; collisions with
  an active identity are rejected.

### Admin panel (Full) & bootstrap

- Admin-only web view: identity table (name, role, admin?, online, created, last
  seen), code-entry approval, revoke, promote/demote, force-disconnect, rename,
  audit log.
- **Promote/demote** takes effect on the target's next connect (role is fixed at
  `authenticate`); use force-disconnect to hurry it.
- **Rename** rebinds the name on the key record — future attribution + roster only;
  already-sent messages keep their old `from` (history is immutable).
- **Guard, always on: cannot revoke or demote the last admin.**
- **Bootstrap:** first run with no identities prints a one-time **owner key** to
  stdout; the operator pastes it into the UI once (the sole key-paste in the
  system) → becomes the first admin → approves everyone else thereafter.

### Storage & transport

- **`super-talk-auth.db`** — a server-private SQLite database, separate from the
  chat Store and **never exposed as a `WORKSPACE` Resource**:
  - `identities(name PK, role, is_admin, key_hash, created_at, last_seen_at)`
  - `audit(ts, actor, action, target)`
  - only key **hashes** are stored.
- Pending requests and stashed-but-undelivered grants live in **in-memory maps**
  keyed by code (same pattern as the existing `online` / `typing` / `sends` maps),
  with a TTL sweep.
- Keys are **long-lived + revocable** — revocation (panel + CLI) is the kill
  switch; rotation = revoke + re-enroll. No expiry/refresh machinery in v1.
- The CLI demotes to `keys list` / `keys revoke` (+ lock-out recovery).

## Decisions (locked)

| Area | Decision |
|---|---|
| Trust model | One self-hosted, internet-reachable workspace; per-identity creds; **no** accounts/tenancy/signup |
| Credential | One unified per-identity **bearer key**; same verify path for agents and humans |
| Human auth | Same key as agents; auto-stored in `localStorage` (no passwords/OAuth/sessions in v1) |
| Issuance | **Device-pairing**: `requestAccess` → code → admin `approve(code)` → `grant` push → store. CLI demoted to list/revoke |
| Identity source | Server derives `name` + `role` from the key record; client no longer declares them; spoofing closed |
| Roles | `{ user, agent, pending, admin }`; chat surface declared per-role (NOT `shared`, which `pending` would inherit); admin is a distinct role (secure by construction) |
| Who approves | **Admin tier** (owner + promoted admins), not flat |
| Pairing code | **Typed** by the admin (RFC 8628 model): CSPRNG ~37 bits, single-use, short TTL, attempt-rate-limited |
| Pending queue | **Dropped** — code-entry is the selector; no broadcast queue to leak or phish |
| Drop handling | **Stash-by-code, commit-on-delivery**; re-attach by saved code; TTL-discard → no dangling key |
| Admin panel | **Full**: list, approve, revoke, promote/demote, force-disconnect, rename, audit log |
| Storage | Server-private **SQLite** (`super-talk-auth.db`); only key hashes; isolated from the chat Store |
| Token lifetime | **Long-lived + revocable**; no expiry/refresh in v1 |
| wss posture | **Warn-only** on non-loopback-without-TLS (operator's call) |
| Bootstrap | First-run one-time **owner key** to stdout; sole key-paste; becomes first admin |
| Name uniqueness | Guaranteed by issuance; requested name advisory; active-identity collisions rejected |

## Consequences

**Changes from today**
- `SUPERTALK_TOKEN` shared secret is superseded by per-identity keys.
- Client no longer sends `?name=`/`?role=`; both come from the key record.
- Agent-name-uniqueness hack (`"name is already in use"`) is **removed**.
- Name changes are now an **admin `rename`**, not a client reconnect-under-new-name
  (supersedes the plugin's name-change-while-connected behavior).
- Humans no longer type a free-form name to "sign in"; they enroll once and the key
  is stored — better UX than the pre-auth name form.
- `WORKSPACE` single read-principal and shared channels are **unchanged**. The door
  to per-identity principals (private channels / DMs) stays open via `identify`,
  but is out of scope here.

**Baked in regardless of the wss choice**
- Strip query strings from the hub's own WS access logs (log path only). This is
  hygiene we control; it does not depend on the operator's TLS setup.

### Residual risk (accepted)

**Warn-only wss + long-lived keys + key-in-query-string.** super-line's stock
transport carries the bearer key in the WS **URL query string** (browsers can't set
headers; the Node transport doesn't expose them). If a self-hoster ignores the
warning and exposes the hub without TLS — or behind a proxy that logs query strings
— a long-lived key travels in cleartext URLs and can land in logs/history. This is
the highest-residual item in the design. Compensating controls we *do* apply:
hub-side log scrubbing (above) and first-class revocation. The control we **cannot**
enforce (the operator's upstream proxy) is why a `--behind-tls` ack-flag was
considered and declined; revisit if abuse or a leak is observed.

## Out of scope / deferred

- Accounts, signup, multi-tenant isolation, billing.
- DMs / private channels (would need per-identity `identify` principals).
- Short-lived keys + refresh/rotation; OAuth/SSO; magic-link.
- CAPTCHA/Turnstile on the enrollment endpoint (revisit if the queue is abused).
- Sending the bearer as the first WS message instead of the query string (needs a
  custom transport; revisit if super-line gains header/first-message auth).

---

## Build sequence

Each step typechecks and tests before the next. Tests run over a loopback
(`store-memory` + the new auth db pointed at a temp file).

1. **`core` — contract.** Add the `pending` and `admin` roles; declare the chat
   surface per-role (NOT `shared`); add `requestAccess`/`grant` (pending), and
   `listIdentities`/`approve`/`revoke`/`setAdmin`/`forceDisconnect`/`rename`/`auditLog`
   (admin); extend `MemberSchema` role enum. Typecheck.

2. **`server` — identity store.** New `super-talk-auth.db` module (SQLite, server-private):
   `identities` + `audit` tables, key hashing (verify on connect), `last_seen_at`
   bump. CLI `keys list` / `keys revoke`. Unit-test hashing + revoke + last-admin guard.

3. **`server` — authenticate.** Replace the token/name logic: look up the key →
   derive `{ role, name, is_admin }`; no key → `pending` with `{ desiredName, code…,
   clientIp }` in `conn.data`. First-run owner-key bootstrap printed to stdout when
   `identities` is empty. wss warn on non-loopback-without-TLS. Strip query from WS
   access logs.

4. **`server` — enrollment + admin handlers.** In-memory `pendingRequests` + stashed
   `grants` maps (keyed by code, TTL swept). `requestAccess` mints a code; `approve`
   resolves by code, mints the key, writes the hash + audit row, stashes
   commit-on-delivery, and `emit`s `grant` to the pending socket (or holds for
   re-attach). `revoke`/`setAdmin`/`forceDisconnect`/`rename`/`listIdentities`/`auditLog`.
   Loopback tests for the full pending→approve→grant→reconnect path, drop/re-attach,
   and the phishing case (wrong code never resolves the legit request).

5. **`plugin` — pending mode.** `/super-talk init` (and auto-connect) connects
   `pending` when no key is saved, calls `requestAccess`, prints the code, listens
   for `grant`, writes `token` into `.super-talk/config.json`, reconnects with the
   key. Save the code for re-attach across a restart. Extend `SuperTalkConfig` with
   `token`. Test: pending → grant → reconnect; re-init after drop.

6. **`web` — enrollment + admin panel.** Pre-auth screen: connect `pending`, show the
   pairing code, store the granted key in `localStorage`, reconnect as `user`/`admin`,
   learn own name via `hello`/`whoami`. Admin-only panel (gated by the `admin` role):
   identity table, code-entry approval, revoke, promote/demote, force-disconnect,
   rename, audit log.

7. **Cross-cutting.** README + docs: enrollment walkthrough, bootstrap owner key,
   the wss warning and how to terminate TLS upstream, CLI `keys` reference. Then
   `pnpm -r build && pnpm typecheck && pnpm test && pnpm lint`.
