import { useEffect, useState } from 'react'
import { createSuperLineClient } from '@super-line/client'
import { memoryStoreClient } from '@super-line/store-memory'
import { webSocketClientTransport } from '@super-line/transport-websocket'
import { chat } from '@/contract'
import { Provider } from '@/lib/superline'
import { Shell } from '@/components/shell'

// default to the same origin that served this page (so the hub's bundled UI just works on any
// host/port); override with VITE_SUPERTALK_URL for the standalone Vite dev server.
const WS_URL =
  import.meta.env.VITE_SUPERTALK_URL ||
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
const TOKEN =
  import.meta.env.VITE_SUPERTALK_TOKEN ||
  new URLSearchParams(location.search).get('token') ||
  undefined

export function Workspace({
  name,
  onSignOut,
}: {
  name: string
  onSignOut: () => void
}): React.JSX.Element {
  // Create the client once; it connects immediately and reconnects on its own. The `chat` store's
  // client half is the in-memory LWW replica (pairs with store-sqlite's server half).
  const [client] = useState(() =>
    createSuperLineClient(chat, {
      transport: webSocketClientTransport({ url: WS_URL }),
      role: 'user',
      params: { name, ...(TOKEN ? { token: TOKEN } : {}) },
      stores: { chat: memoryStoreClient() },
    }),
  )
  useEffect(() => () => client.close(), [client])

  return (
    <Provider client={client}>
      <Shell me={name} onSignOut={onSignOut} />
    </Provider>
  )
}
