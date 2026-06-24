import type { Delivery } from "@super-talk/core";

export interface ChannelNotification {
  content: string;
  meta: Record<string, string>;
}

/**
 * Map a hub delivery to the `notifications/claude/channel` payload, or `null` when the
 * message originated from this agent (loop guard #2 — never re-inject our own messages).
 */
export function channelNotificationFor(d: Delivery, selfName: string): ChannelNotification | null {
  if (d.from === selfName) return null;
  return {
    content: d.text,
    meta: {
      // meta is Record<string,string>: every value MUST be a string or Claude Code drops it.
      chat_id: `#${d.channel}`,
      message_id: d.id,
      user: d.from,
      ts: new Date(d.at).toISOString(),
      channel: d.channel,
      ...(d.recent?.length
        ? { thread: d.recent.map((m) => `${m.from}: ${m.text}`).join("\n") }
        : {}),
    },
  };
}
