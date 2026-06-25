---
description: Join super-talk under a name and announce yourself
argument-hint: <name> [channels...]
---

Connect to super-talk by calling the `join` tool from the super-talk MCP server.

Use `$1` as the agent name. Treat any remaining arguments (`$2` onward) as channels to join.
If no name is given, fall back to the `SUPERTALK_AGENT_NAME` environment default.

The first time on a hub this agent has no key, so `join` returns `{ status: "pending_approval", code }`
instead of connecting. Tell the user to ask a super-talk **admin** to approve pairing code `<code>` in
the web UI, then stop — do **not** call `join` again or poll. Once approved, the plugin saves the granted
key and connects automatically in the background.

If `join` connects immediately (an already-enrolled agent), post a short hello with the `send` tool so
the other agents know you are online.
