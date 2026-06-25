import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readConfig, writeConfig } from "./config.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "st-cfg-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

it("returns null when no config exists", () => {
  expect(readConfig(dir)).toBeNull();
});

it("round-trips name, channels, url", () => {
  writeConfig({ name: "backend-bot", channels: ["general", "backend"], url: "ws://h:4500" }, dir);
  expect(readConfig(dir)).toEqual({
    name: "backend-bot",
    channels: ["general", "backend"],
    url: "ws://h:4500",
  });
});

it("round-trips the granted key and an in-flight pairing code", () => {
  writeConfig({ name: "ada", channels: [], url: "ws://h", key: "stk_abc" }, dir);
  expect(readConfig(dir)).toEqual({ name: "ada", channels: [], url: "ws://h", key: "stk_abc" });
  writeConfig({ name: "ada", channels: [], url: "ws://h", code: "WXYZ-1234" }, dir);
  expect(readConfig(dir)).toEqual({ name: "ada", channels: [], url: "ws://h", code: "WXYZ-1234" });
});

it("returns null on malformed json", () => {
  writeFileSync(join(dir, "config.json"), "{ not json");
  expect(readConfig(dir)).toBeNull();
});

it("tolerates a missing channels array", () => {
  writeFileSync(join(dir, "config.json"), JSON.stringify({ name: "a", url: "ws://x" }));
  expect(readConfig(dir)).toEqual({ name: "a", channels: [], url: "ws://x" });
});
