// Default to the same origin that served this page (so the hub's bundled UI just works on any
// host/port); override with VITE_SUPERTALK_URL for the standalone Vite dev server.
export const WS_URL =
  import.meta.env.VITE_SUPERTALK_URL ||
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
