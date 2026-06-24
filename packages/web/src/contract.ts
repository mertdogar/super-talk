// The contract lives in @super-talk/core (shared by the hub + agent plugin + this UI).
// The UI only sees the `user` role surface.
export { api as chat } from '@super-talk/core'
export type { Channel, ChannelsDoc, Message, MessagesDoc } from '@super-talk/core'
