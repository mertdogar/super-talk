import { useCallback, useEffect, useState } from "react";
import { Check, ShieldCheck, ShieldOff, Trash2, UserCog, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { AuditEntry, IdentityInfo } from "@/contract";
import { useRequest } from "@/lib/superline";
import { cn } from "@/lib/utils";

export function AdminPanel({
  open,
  onOpenChange,
  me,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  me: string;
}): React.JSX.Element {
  const { call: listIdentities } = useRequest("listIdentities");
  const { call: auditLog } = useRequest("auditLog");
  const { call: approve } = useRequest("approve");
  const { call: lookupPending } = useRequest("lookupPending");
  const { call: revoke } = useRequest("revoke");
  const { call: setAdmin } = useRequest("setAdmin");
  const { call: forceDisconnect } = useRequest("forceDisconnect");
  const { call: rename } = useRequest("rename");

  const [identities, setIdentities] = useState<IdentityInfo[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listIdentities()
      .then((r) => setIdentities(r.identities))
      .catch(() => {});
    auditLog({})
      .then((r) => setAudit(r.entries))
      .catch(() => {});
  }, [listIdentities, auditLog]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    fn()
      .then(refresh)
      .catch((e) => setError(e instanceof Error ? e.message : "action failed"));
  };

  // ---- approve a pending request by its pairing code ----
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ desiredName?: string; ip?: string } | null>(null);
  const lookup = () => {
    const c = code.trim();
    if (!c) return;
    setError(null);
    setFound(null);
    lookupPending({ code: c })
      .then((r) =>
        r.found
          ? setFound({ desiredName: r.desiredName, ip: r.ip })
          : setError("no pending request for that code"),
      )
      .catch((e) => setError(e instanceof Error ? e.message : "lookup failed"));
  };
  const doApprove = () =>
    run(async () => {
      await approve({ code: code.trim() });
      setCode("");
      setFound(null);
    });

  // ---- inline rename ----
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="Admin" className="w-full gap-0 bg-background sm:max-w-md">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <UserCog className="h-5 w-5 text-primary" /> Admin
          </span>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* approve a pending join request */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Approve a pending request
            </h3>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setFound(null);
                }}
                placeholder="WXYZ-1234"
                className="h-9 font-mono uppercase tracking-widest"
              />
              <Button variant="outline" onClick={lookup} disabled={!code.trim()}>
                Look up
              </Button>
            </div>
            {found && (
              <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{found.desiredName || "(unnamed)"}</span>
                  <span className="ml-2 text-muted-foreground">{found.ip}</span>
                </span>
                <Button size="default" className="h-8" onClick={doApprove}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
              </div>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Enter the code shown in the requester&apos;s terminal/screen — not a name from a list.
            </p>
          </section>

          {/* identities */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Identities — {identities.length}
            </h3>
            <ul className="space-y-1">
              {identities.map((id) => (
                <li key={id.name} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          id.online ? "bg-online" : "bg-muted-foreground/40",
                        )}
                      />
                      <span className="truncate font-medium">{id.name}</span>
                      <Badge>{id.kind}</Badge>
                      {id.isAdmin && <Badge tone="primary">admin</Badge>}
                      {id.name === me && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                  </div>

                  {renaming === id.name ? (
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = newName.trim();
                        if (next) run(() => rename({ name: id.name, newName: next }));
                        setRenaming(null);
                      }}
                    >
                      <Input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="new name"
                        className="h-8"
                      />
                      <Button size="default" className="h-8" type="submit">
                        Save
                      </Button>
                      <Button
                        size="default"
                        variant="outline"
                        className="h-8"
                        type="button"
                        onClick={() => setRenaming(null)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {id.kind === "user" &&
                        (id.isAdmin ? (
                          <Action
                            icon={ShieldOff}
                            label="Demote"
                            onClick={() => run(() => setAdmin({ name: id.name, admin: false }))}
                          />
                        ) : (
                          <Action
                            icon={ShieldCheck}
                            label="Promote"
                            onClick={() => run(() => setAdmin({ name: id.name, admin: true }))}
                          />
                        ))}
                      <Action
                        icon={UserCog}
                        label="Rename"
                        onClick={() => {
                          setRenaming(id.name);
                          setNewName(id.name);
                        }}
                      />
                      {id.online && (
                        <Action
                          icon={Wifi}
                          label="Disconnect"
                          onClick={() => run(() => forceDisconnect({ name: id.name }))}
                        />
                      )}
                      <Action
                        icon={Trash2}
                        label="Revoke"
                        tone="danger"
                        onClick={() => run(() => revoke({ name: id.name }))}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* audit log */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Audit log
            </h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {audit.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    <span className="font-medium text-foreground">{e.actor}</span> {e.action}{" "}
                    <span className="font-medium text-foreground">{e.target}</span>
                  </span>
                  <time className="shrink-0">{new Date(e.ts).toLocaleTimeString()}</time>
                </li>
              ))}
              {!audit.length && <li>No actions yet.</li>}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "primary";
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "primary" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: typeof Trash2;
  label: string;
  onClick: () => void;
  tone?: "danger";
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent",
        tone === "danger" && "text-destructive hover:bg-destructive/10",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
