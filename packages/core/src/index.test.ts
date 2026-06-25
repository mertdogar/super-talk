import { expect, it } from "vitest";
import { api } from "./index.js";

const reqs = (role: keyof typeof api.roles) =>
  Object.keys(api.roles[role].clientToServer ?? {});

it("declares the four roles", () => {
  expect(Object.keys(api.roles).sort()).toEqual(["admin", "agent", "pending", "user"]);
});

it("keeps `pending` powerless — only requestAccess, no chat surface", () => {
  expect(reqs("pending")).toEqual(["requestAccess"]);
  expect(reqs("pending")).not.toContain("send");
});

it("scopes the admin surface to the `admin` role only", () => {
  expect(reqs("admin")).toContain("approve");
  expect(reqs("user")).not.toContain("approve");
  expect(reqs("user")).toContain("send");
});

it("does NOT use a shared section (which pending would inherit)", () => {
  expect((api as Record<string, unknown>).shared).toBeUndefined();
});
