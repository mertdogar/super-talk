import type { Delivery } from "@super-talk/core";
import { expect, it } from "vitest";
import { channelNotificationFor } from "./delivery.js";

const base: Delivery = { id: "m1", from: "a", text: "hello", at: 1, channel: "general" };

it("drops messages from self (loop guard #2)", () => {
  expect(channelNotificationFor({ ...base, from: "me" }, "me")).toBeNull();
});

it("maps a channel message to a channel notification", () => {
  const note = channelNotificationFor(base, "me");
  expect(note).not.toBeNull();
  expect(note!.content).toBe("hello");
  expect(note!.meta).toMatchObject({
    chat_id: "#general",
    message_id: "m1",
    user: "a",
    channel: "general",
  });
});

it("flattens recent thread context into a string (meta must be all strings)", () => {
  const note = channelNotificationFor(
    {
      ...base,
      recent: [
        { id: "m0", from: "b", text: "earlier", at: 0 },
        { id: "m0b", from: "c", text: "and then", at: 0 },
      ],
    },
    "me",
  );
  expect(note!.meta.thread).toBe("b: earlier\nc: and then");
  for (const v of Object.values(note!.meta)) expect(typeof v).toBe("string");
});
