// The contract lives in @super-talk/core (shared by the hub + agent plugin + this UI).
// The UI connects as `user`/`admin` (per its key) and as `pending` during enrollment.
export { api as chat } from "@super-talk/core";
export type {
  AuditEntry,
  Channel,
  ChannelsDoc,
  IdentityInfo,
  IdentityKind,
  Member,
  MembersDoc,
  Message,
  MessagesDoc,
} from "@super-talk/core";
