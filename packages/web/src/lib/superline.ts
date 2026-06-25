import { createSuperLineHooks } from "@super-line/react";
import type { chat } from "@/contract";

// Hooks are typed for the `admin` role — its surface is a superset of `user` (chat + the management
// requests). The hub derives the REAL role from the bearer key, so a non-admin's connection is a
// plain `user` server-side and any admin request returns NOT_FOUND; the UI only ever calls the admin
// requests when whoami reports `role === 'admin'`. (Enrollment uses a separate raw `pending` client.)
export const { Provider, useRequest, useSubscription, useResource } = createSuperLineHooks<
  typeof chat,
  "admin"
>();
