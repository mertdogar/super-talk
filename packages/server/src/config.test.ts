import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

const dir = () => mkdtempSync(join(tmpdir(), "supertalk-cfg-"));
const writeCfg = (d: string, obj: unknown) =>
  writeFileSync(join(d, "super-talk.config.json"), JSON.stringify(obj));

it("returns empty options with no flags, env, or file", () => {
  const { options } = loadConfig([], {}, dir());
  expect(options).toEqual({});
});

it("reads the auto-discovered config file in cwd", () => {
  const d = dir();
  writeCfg(d, { port: 8080, host: "0.0.0.0", token: "s3cret", db: "./x.db", webDir: "./ui" });
  const { options } = loadConfig([], {}, d);
  expect(options).toEqual({
    port: 8080,
    host: "0.0.0.0",
    token: "s3cret",
    dbFile: "./x.db",
    publicDir: "./ui",
  });
});

it("env overrides the config file", () => {
  const d = dir();
  writeCfg(d, { port: 8080, token: "from-file" });
  const { options } = loadConfig([], { SUPERTALK_TOKEN: "from-env" }, d);
  expect(options.port).toBe(8080);
  expect(options.token).toBe("from-env");
});

it("flags override env and file", () => {
  const d = dir();
  writeCfg(d, { port: 1, host: "file-host" });
  const { options } = loadConfig(
    ["--port", "3000", "--host", "127.0.0.1"],
    { SUPERTALK_PORT: "2000" },
    d,
  );
  expect(options.port).toBe(3000);
  expect(options.host).toBe("127.0.0.1");
});

it("merges per-key across layers", () => {
  const d = dir();
  writeCfg(d, { db: "./file.db", host: "0.0.0.0" });
  const { options } = loadConfig(["--port", "9000"], { SUPERTALK_TOKEN: "t" }, d);
  expect(options).toEqual({ port: 9000, token: "t", dbFile: "./file.db", host: "0.0.0.0" });
});

it("--config points at an explicit file", () => {
  const d = dir();
  const p = join(d, "custom.json");
  writeFileSync(p, JSON.stringify({ port: 7777 }));
  const { options } = loadConfig(["--config", p], {}, dir());
  expect(options.port).toBe(7777);
});

it("ignores unknown keys in the config file", () => {
  const d = dir();
  writeCfg(d, { prt: 8080, port: 4500 });
  const { options } = loadConfig([], {}, d);
  expect(options).toEqual({ port: 4500 });
});

it("throws on an unknown flag", () => {
  expect(() => loadConfig(["--prot", "8080"], {}, dir())).toThrow();
});

it("throws on a non-numeric port flag", () => {
  expect(() => loadConfig(["--port", "abc"], {}, dir())).toThrow(/invalid port/);
});

it("throws on a non-numeric port in env", () => {
  expect(() => loadConfig([], { SUPERTALK_PORT: "abc" }, dir())).toThrow(/invalid port/);
});

it("throws on malformed JSON in an auto-discovered file", () => {
  const d = dir();
  writeFileSync(join(d, "super-talk.config.json"), "{ not json");
  expect(() => loadConfig([], {}, d)).toThrow(/invalid JSON/);
});

it("throws when an explicit --config file is missing", () => {
  expect(() => loadConfig(["--config", "/no/such/file.json"], {}, dir())).toThrow(/not found/);
});

it("--help and --version request an early exit", () => {
  expect(loadConfig(["--help"], {}, dir()).exit).toContain("Usage");
  expect(loadConfig(["--version"], {}, dir(), "9.9.9").exit).toBe("9.9.9");
});
