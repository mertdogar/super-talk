import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { createSuperLineClient } from "@super-line/client";
import { memoryStoreClient } from "@super-line/store-memory";
import { webSocketClientTransport } from "@super-line/transport-websocket";
import { chat } from "@/contract";
import { WS_URL } from "@/lib/ws";
import { Provider } from "@/lib/superline";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";

export function Workspace({
  authKey,
  onSignOut,
}: {
  authKey: string;
  onSignOut: () => void;
}): React.JSX.Element {
  // Create the client once; it connects immediately and reconnects on its own. We declare role
  // `admin` for TYPING only — the hub assigns the real role (user/admin) from the key. The `chat`
  // store's client half is the in-memory LWW replica (pairs with store-sqlite's server half).
  const [client] = useState(() =>
    createSuperLineClient(chat, {
      transport: webSocketClientTransport({ url: WS_URL }),
      role: "admin",
      params: { key: authKey },
      stores: { chat: memoryStoreClient() },
    }),
  );
  useEffect(() => () => client.close(), [client]);

  // Learn our own name + real role from the hub (the key is the source of truth).
  const [me, setMe] = useState<{ name: string; role: string } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => alive && setFailed(true), 8000);
    client
      .whoami()
      .then((w) => {
        if (!alive) return;
        clearTimeout(timer);
        setMe(w);
      })
      .catch(() => {
        if (!alive) return;
        clearTimeout(timer);
        setFailed(true);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [client]);

  if (failed) return <ConnectFailed onSignOut={onSignOut} />;
  if (!me) return <Splash subtitle="Connecting…" spinner />;

  return (
    <Provider client={client}>
      <Shell me={me.name} isAdmin={me.role === "admin"} onSignOut={onSignOut} />
    </Provider>
  );
}

function Splash({ subtitle, spinner }: { subtitle: string; spinner?: boolean }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-sidebar text-muted-foreground">
      <span className="flex items-center gap-2 text-foreground">
        <MessageSquare className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold tracking-tight">super-talk</span>
      </span>
      <span className="flex items-center gap-2 text-sm">
        {spinner && <Loader2 className="h-4 w-4 animate-spin" />}
        {subtitle}
      </span>
    </div>
  );
}

function ConnectFailed({ onSignOut }: { onSignOut: () => void }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center bg-sidebar p-6">
      <div className="w-full max-w-sm rounded-xl bg-background p-8 text-center shadow-2xl">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t connect. Your key may have been revoked, or the hub is unreachable.
        </p>
        <Button onClick={onSignOut} variant="outline" className="mt-4 h-11 w-full">
          Use a different key
        </Button>
      </div>
    </div>
  );
}
