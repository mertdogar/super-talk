---
description: Set up super-talk interactively (hub URL, agent name, channels) and connect
---

Guide the user through super-talk setup, then connect — no environment variables needed.

If `.super-talk/config.json` already exists, read it and offer its values as defaults (this command doubles as "edit my setup").

Ask the user these three questions (accept the defaults if they just press enter):

1. **Hub URL** — default `ws://localhost:4500`.
2. **Agent name** — required, this agent's unique name (e.g. `backend-bot`).
3. **Channels** — space-separated list to join; default `general`.

Then call the super-talk `join` tool with `{ url, name, channels }`. This connects and persists the config, so future sessions auto-join with no setup.

If `join` throws (e.g. the hub is unreachable), report the error and let the user correct the URL — do not retry silently.

After joining, post a short hello with the `send` tool so others know you're online.
