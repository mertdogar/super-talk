import { type FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { createSuperLineClient, type SuperLineClient } from "@super-line/client";
import { webSocketClientTransport } from "@super-line/transport-websocket";
import { chat } from "@/contract";
import { WS_URL } from "@/lib/ws";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EnrollScreen({
  onEnrolled,
}: {
  onEnrolled: (key: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteKey, setPasteKey] = useState("");
  const clientRef = useRef<SuperLineClient<typeof chat, "pending"> | null>(null);

  useEffect(() => () => clientRef.current?.close(), []);

  const requestAccess = (e: FormEvent) => {
    e.preventDefault();
    const desired = name.trim();
    if (!desired) return;
    setError(null);
    const c = createSuperLineClient(chat, {
      transport: webSocketClientTransport({ url: WS_URL }),
      role: "pending",
      params: { name: desired, kind: "user" },
    });
    clientRef.current = c;
    c.on("grant", (g) => {
      c.close();
      onEnrolled(g.key);
    });
    c.requestAccess({ desiredName: desired, kind: "user" })
      .then((r) => setCode(r.code))
      .catch((err) => setError((err as Error)?.message ?? "request failed"));
  };

  const submitPaste = (e: FormEvent) => {
    e.preventDefault();
    const k = pasteKey.trim();
    if (k) onEnrolled(k);
  };

  return (
    <div className="flex h-full items-center justify-center bg-sidebar p-6">
      <div className="w-full max-w-sm rounded-xl bg-background p-8 shadow-2xl">
        <div className="flex items-center gap-2 text-primary">
          <MessageSquare className="h-7 w-7" />
          <span className="text-2xl font-bold tracking-tight text-foreground">super-talk</span>
        </div>

        {code ? (
          <Waiting code={code} />
        ) : pasteMode ? (
          <form onSubmit={submitPaste}>
            <p className="mt-2 text-sm text-muted-foreground">
              Paste an access key (e.g. the one-time owner key the hub printed on first run).
            </p>
            <Input
              autoFocus
              value={pasteKey}
              onChange={(e) => setPasteKey(e.target.value)}
              placeholder="stk_…"
              className="mt-4 h-11 font-mono"
            />
            <Button type="submit" className="mt-4 h-11 w-full" disabled={!pasteKey.trim()}>
              Use this key
            </Button>
            <button
              type="button"
              onClick={() => setPasteMode(false)}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Request access instead
            </button>
          </form>
        ) : (
          <form onSubmit={requestAccess}>
            <p className="mt-2 text-sm text-muted-foreground">
              Request access to the workspace. An admin approves you with a one-time pairing code.
            </p>
            <label className="mt-6 block text-sm font-medium" htmlFor="name">
              Display name
            </label>
            <Input
              id="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ada"
              className="mt-1.5 h-11"
            />
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" className="mt-4 h-11 w-full" disabled={!name.trim()}>
              Request access
            </Button>
            <button
              type="button"
              onClick={() => setPasteMode(true)}
              className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              I already have a key
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Waiting({ code }: { code: string }): React.JSX.Element {
  return (
    <div className="mt-2">
      <p className="text-sm text-muted-foreground">
        Give this pairing code to an admin and ask them to approve it (Admin → enter code):
      </p>
      <div className="mt-4 rounded-lg border border-border bg-muted/40 py-4 text-center font-mono text-2xl font-bold tracking-[0.2em] text-foreground">
        {code}
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Waiting for approval…
      </p>
    </div>
  );
}
