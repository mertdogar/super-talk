import { expect, it } from "vitest";
import { AuthStore, generatePairingCode } from "./auth-store.js";

const fresh = () => new AuthStore(":memory:");

it("issues a key and resolves it back to the identity", () => {
  const a = fresh();
  const key = a.issue("backend-bot", "agent");
  const id = a.byKey(key);
  expect(id).toMatchObject({
    name: "backend-bot",
    kind: "agent",
    isAdmin: false,
    lastSeenAt: null,
  });
  a.close();
});

it("returns null for an unknown key", () => {
  const a = fresh();
  a.issue("ada", "user");
  expect(a.byKey("stk_not-a-real-key")).toBeNull();
  a.close();
});

it("rejects issuing a duplicate name (uniqueness via the PK)", () => {
  const a = fresh();
  a.issue("ada", "user");
  expect(() => a.issue("ada", "user")).toThrow();
  a.close();
});

it("revoke removes the identity and its key", () => {
  const a = fresh();
  const key = a.issue("ada", "user");
  a.revoke("ada");
  expect(a.byKey(key)).toBeNull();
  expect(a.byName("ada")).toBeNull();
  a.close();
});

it("tracks admin count for the last-admin guard", () => {
  const a = fresh();
  a.issue("owner", "user", true);
  expect(a.adminCount()).toBe(1);
  a.issue("ada", "user");
  a.setAdmin("ada", true);
  expect(a.adminCount()).toBe(2);
  a.close();
});

it("renames an identity, preserving its key", () => {
  const a = fresh();
  const key = a.issue("ada", "user");
  a.rename("ada", "ada-prime");
  expect(a.byKey(key)?.name).toBe("ada-prime");
  expect(a.byName("ada")).toBeNull();
  a.close();
});

it("touchLastSeen marks the identity as claimed", () => {
  const a = fresh();
  a.issue("ada", "user");
  expect(a.byName("ada")?.lastSeenAt).toBeNull();
  a.touchLastSeen("ada");
  expect(a.byName("ada")?.lastSeenAt).toBeTypeOf("number");
  a.close();
});

it("appends and reads audit entries newest-first", () => {
  const a = fresh();
  a.audit("owner", "approve", "ada");
  a.audit("owner", "revoke", "spammer");
  const entries = a.readAudit();
  expect(entries.map((e) => e.action)).toEqual(["revoke", "approve"]);
  a.close();
});

it("pairing codes are hyphen-grouped and use no ambiguous chars", () => {
  for (let i = 0; i < 50; i++) {
    expect(generatePairingCode()).toMatch(/^[0-9A-HJ-NP-TV-Z]{4}-[0-9A-HJ-NP-TV-Z]{4}$/);
  }
});
