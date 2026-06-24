import { createSuperLineClient, type SuperLineClient } from "@super-line/client";
import { memoryStoreServer } from "@super-line/store-memory";
import { webSocketClientTransport } from "@super-line/transport-websocket";
import { api, type Delivery, type MembersDoc } from "@super-talk/core";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createHub, type Hub } from "./index.js";

let hub: Hub;
const clients: { close(): void }[] = [];

beforeEach(async () => {
  hub = await createHub({
    port: 0,
    store: memoryStoreServer(),
    cooldownMax: 3,
    cooldownWindowMs: 1000,
  });
});

afterEach(async () => {
  for (const c of clients) c.close();
  clients.length = 0;
  await hub.close();
});

function connect<R extends "user" | "agent">(
  role: R,
  name: string,
): SuperLineClient<typeof api, R> {
  const c = createSuperLineClient(api, {
    transport: webSocketClientTransport({ url: `ws://localhost:${hub.port}` }),
    role,
    params: { name },
    reconnect: false,
  });
  clients.push(c);
  return c;
}

function nextMessage(c: SuperLineClient<typeof api, "agent">): Promise<Delivery> {
  return new Promise((resolve) => {
    const off = c.on("message", (d) => {
      off();
      resolve(d);
    });
  });
}

it("pushes a channel message to a joined agent", async () => {
  const agent = connect("agent", "a");
  const user = connect("user", "u");
  await agent.join({ channels: ["general"] });

  const got = nextMessage(agent);
  await user.send({ channel: "general", text: "tests pass" });
  const msg = await got;

  expect(msg.from).toBe("u");
  expect(msg.channel).toBe("general");
  expect(msg.text).toBe("tests pass");
});

it("does not push channels an agent has not joined", async () => {
  const agent = connect("agent", "a");
  const user = connect("user", "u");
  await agent.join({ channels: ["general"] });
  await user.createChannel({ name: "marketing" });

  let leaked = false;
  agent.on("message", (d) => {
    if (d.channel === "marketing") leaked = true;
  });
  await user.send({ channel: "marketing", text: "psst" });
  await new Promise((r) => setTimeout(r, 100));
  expect(leaked).toBe(false);
});

it("persists history in the Store", async () => {
  const agent = connect("agent", "a");
  const user = connect("user", "u");
  await agent.join({});
  await user.send({ channel: "general", text: "one" });
  await user.send({ channel: "general", text: "two" });

  const { messages } = await agent.history({ channel: "general" });
  expect(messages.map((m) => m.text)).toEqual(["one", "two"]);
});

it("attaches recent thread context to agent deliveries", async () => {
  const agent = connect("agent", "a");
  const user = connect("user", "u");
  await agent.join({ channels: ["general"] });

  const seen: Delivery[] = [];
  agent.on("message", (d) => seen.push(d));
  await user.send({ channel: "general", text: "first" });
  await user.send({ channel: "general", text: "second" });
  await new Promise((r) => setTimeout(r, 100));

  const second = seen.find((m) => m.text === "second");
  expect(second).toBeDefined();
  expect(second!.recent?.at(-1)?.text).toBe("first");
});

it("creates a channel and lists it", async () => {
  const agent = connect("agent", "a");
  const user = connect("user", "u");
  await agent.join({});
  await user.createChannel({ name: "Marketing" });

  const { channels } = await agent.channels();
  expect(channels.map((c) => c.id).sort()).toEqual(["general", "marketing"]);
});

it("rejects sending to a missing channel", async () => {
  const user = connect("user", "u");
  await expect(user.send({ channel: "nope", text: "hi" })).rejects.toThrow();
});

it("lists who is online (humans + agents)", async () => {
  const agent = connect("agent", "a");
  const user = connect("user", "u");
  await agent.join({});
  await user.hello();

  const { agents } = await agent.who({});
  expect(agents.map((x) => x.name).sort()).toEqual(["a", "u"]);
});

it("records channel members with roles on join and send", async () => {
  const agent = connect("agent", "a");
  const user = connect("user", "u");
  await agent.join({ channels: ["general"] });
  await user.send({ channel: "general", text: "hi" });
  await new Promise((r) => setTimeout(r, 50));

  const doc = (await hub.srv.store("chat").read("members:general"))?.data as MembersDoc;
  const byName = Object.fromEntries(doc.members.map((m) => [m.name, m.role]));
  expect(byName).toMatchObject({ a: "agent", u: "user" });
});

it("rejects a duplicate agent name", async () => {
  const a = connect("agent", "a");
  await a.join({});
  const dup = connect("agent", "a");
  await expect(dup.join({})).rejects.toThrow();
});

it("rate-limits a runaway sender (cooldown backstop)", async () => {
  const user = connect("user", "u");
  await user.send({ channel: "general", text: "1" });
  await user.send({ channel: "general", text: "2" });
  await user.send({ channel: "general", text: "3" });
  await expect(user.send({ channel: "general", text: "4" })).rejects.toThrow();
});
