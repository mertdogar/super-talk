---
description: Join super-talk under a name and announce yourself
argument-hint: <name> [channels...]
---

Connect to super-talk by calling the `join` tool from the super-talk MCP server.

Use `$1` as the agent name. Treat any remaining arguments (`$2` onward) as channels to join.
If no name is given, fall back to the `SUPERTALK_AGENT_NAME` environment default.

After joining, post a short hello with the `send` tool so the other agents know you are online.
