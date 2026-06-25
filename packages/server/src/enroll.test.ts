import { createSuperLineClient, type SuperLineClient } from "@super-line/client";
import { memoryStoreServer } from "@super-line/store-memory";
import { webSocketClientTransport } from "@super-line/transport-websocket";
import { api } from "@super-talk/core";
import { afterEach, beforeEach, expect, it } from "vitest";
import { AuthStore } from "./auth-store.js";
import { createHub, type Hub } from "./index.js";

let hub: Hub;
let auth: AuthStore;
const clients: { close(): void }[] = [];

beforeEach(async () => {
  auth = new AuthStore(":memory:");
  hub = await createHub({ port: 0, store: memoryStoreServer(), authStore: auth });
});

afterEach(async () => {
  for (const c of clients) c.close();
  clients.length = 0;
  await hub.close();
  auth.close();
});

function connect<R extends "user" | "agent" | "admin" | "pending">(
  role: R,
  params: Record<string, string>,
): SuperLineClient<typeof api, R> {
  const c = createSuperLineClient(api, {
    transport: webSocketClientTransport({ url: `ws://localhost:${hub.port}` }),
    role,
    params,
    reconnect: false,
  });
  clients.push(c);
  return c;
}

function nextGrant(
  c: SuperLineClient<typeof api, "pending">,
): Promise<{ key: string; name: string; kind: string }> {
  return new Promise((resolve) => {
    const off = c.on("grant", (g) => {
      off();
      resolve(g);
    });
  });
}

it("enrolls a pending agent end-to-end via admin approval", async () => {
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  const pending = connect("pending", {});

  const { code } = await pending.requestAccess({ desiredName: "newbot", kind: "agent" });
  expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);

  const grantP = nextGrant(pending);
  const res = await admin.approve({ code });
  expect(res).toMatchObject({ ok: true, name: "newbot" });

  const grant = await grantP;
  expect(grant).toMatchObject({ name: "newbot", kind: "agent" });
  expect(grant.key).toMatch(/^stk_/);

  // reconnect with the granted key as a real agent
  const agent = connect("agent", { key: grant.key });
  const joined = await agent.join({ channels: ["general"] });
  expect(joined.name).toBe("newbot");
});

it("derives the admin role from the key (whoami)", async () => {
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  expect(await admin.whoami()).toEqual({ name: "owner", role: "admin" });
});

it("lookupPending surfaces the request before approval", async () => {
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  const pending = connect("pending", {});
  const { code } = await pending.requestAccess({ desiredName: "newbot", kind: "agent" });
  const found = await admin.lookupPending({ code });
  expect(found).toMatchObject({ found: true, desiredName: "newbot", kind: "agent" });
});

it("rejects approval of an unknown code (the phishing-resistant selector)", async () => {
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  await expect(admin.approve({ code: "ZZZZ-ZZZZ" })).rejects.toThrow();
});

it("rejects approval when the name collides with an existing identity", async () => {
  hub.auth.issue("taken", "user");
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  const pending = connect("pending", {});
  const { code } = await pending.requestAccess({ desiredName: "taken", kind: "user" });
  await expect(admin.approve({ code })).rejects.toThrow();
});

it("refuses to revoke the last admin", async () => {
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  await expect(admin.revoke({ name: "owner" })).rejects.toThrow();
});

it("revoke removes the identity and invalidates its key", async () => {
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  const victimKey = hub.auth.issue("ada", "user");
  expect(hub.auth.byKey(victimKey)).not.toBeNull();
  await admin.revoke({ name: "ada" });
  expect(hub.auth.byKey(victimKey)).toBeNull();
});

it("promote/demote flips the admin flag and audits it", async () => {
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  hub.auth.issue("ada", "user");
  await admin.setAdmin({ name: "ada", admin: true });
  expect(hub.auth.byName("ada")?.isAdmin).toBe(true);
  const { entries } = await admin.auditLog({});
  expect(entries.some((e) => e.action === "promote" && e.target === "ada")).toBe(true);
});

it("bootstraps a first owner admin when the auth store is empty", async () => {
  const h = await createHub({ port: 0, store: memoryStoreServer(), authDbFile: ":memory:" });
  expect(h.auth.byName("owner")).toMatchObject({ isAdmin: true, kind: "user" });
  await h.close();
});

it("lists identities with online status", async () => {
  const admin = connect("admin", { key: hub.auth.issue("owner", "user", true) });
  const { identities } = await admin.listIdentities();
  const owner = identities.find((i) => i.name === "owner");
  expect(owner).toMatchObject({ kind: "user", isAdmin: true, online: true });
});
