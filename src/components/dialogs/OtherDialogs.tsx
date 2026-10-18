import { useState } from "react";
import { AlertTriangle, ExternalLink, FileUp, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type { Builder } from "../../hooks/useBuilder";
import type { DisplayOptions } from "../../hooks/useOptions";
import { ApiError } from "../../lib/modrinth";
import { PLACEMENT_TEXT, kindOf, placement } from "../../lib/sides";
import type { SideOverride } from "../../lib/state";
import { Badge, Button, Dialog, Segmented, TextArea, Toggle } from "../ui/core";
import { ModIcon, Slot } from "../ui/slot";
import { modStatusText } from "../layout/InventoryPanel";
import { PlacementBadge } from "../steps/ModsStep";

export function ModDialog({ modId, onClose, builder, onRemove }: {
  modId: string | null;
  onClose: () => void;
  builder: Builder;
  onRemove: (id: string, title: string) => void;
}) {
  const mod = builder.state.mods.find((m) => m.projectId === modId) ?? null;
  const auto = mod ? kindOf(placement(mod.clientSide, mod.serverSide)) : "server";
  return (
    <Dialog
      open={!!mod}
      onClose={onClose}
      title={mod?.title ?? ""}
      footer={
        mod && (
          <>
            <Button variant="danger" onClick={() => (onRemove(mod.projectId, mod.title), onClose())}>
              <Trash2 aria-hidden className="h-4 w-4" /> Remove
            </Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </>
        )
      }
    >
      {mod && (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <Slot size="lg" aria-hidden><ModIcon url={mod.iconUrl} /></Slot>
            <div className="min-w-0">
              <p className="text-sm text-muted">{mod.description}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-sm">
                {modStatusText(mod, builder.state.mcVersion)}
                {mod.status === "ok" && mod.versionType !== "release" && <Badge tone="gold">{mod.versionType}</Badge>}
              </p>
              <a href={`https://modrinth.com/mod/${mod.slug}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-copper-ink underline underline-offset-2">
                View on Modrinth <ExternalLink aria-hidden className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {mod.status === "error" && (
            <div className="pixel flex flex-wrap items-center gap-3 bg-redstone-soft p-3 text-sm text-redstone">
              Could not check this mod with Modrinth.
              <Button size="sm" onClick={() => builder.actions.retryMod(mod.projectId)}><RefreshCw aria-hidden className="h-4 w-4" /> Retry</Button>
            </div>
          )}
          {mod.status === "incompatible" && (
            <p className="pixel flex items-start gap-2 bg-gold-soft p-3 text-sm text-gold">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> No Fabric build for {builder.state.mcVersion}. It stays here, but is not installed until you pick a version it supports.
            </p>
          )}

          <div>
            <p id="placement-label" className="font-semibold">Where it is installed</p>
            <p className="mb-2 text-sm text-muted">
              Modrinth says: {PLACEMENT_TEXT[auto].long} Mod pages are sometimes wrong; change it if you know better.
            </p>
            <Segmented<SideOverride | "auto">
              labelledBy="placement-label"
              size="sm"
              value={mod.sideOverride ?? "auto"}
              onChange={(v) => builder.actions.setSideOverride(mod.projectId, v === "auto" ? null : v)}
              options={[
                { value: "auto", label: "As Modrinth says" },
                { value: "both", label: "Server + players" },
                { value: "server", label: "Server only" },
                { value: "client", label: "Players only" },
              ]}
            />
            <div className="mt-2"><PlacementBadge kind={kindOf(placement(mod.clientSide, mod.serverSide, mod.sideOverride))} /></div>
          </div>

          {mod.requiredDeps.length > 0 && (
            <div>
              <p className="font-semibold">Needs {mod.requiredDeps.length === 1 ? "this library" : "these libraries"}</p>
              <p className="text-sm text-muted">Added and pinned for you.</p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {mod.requiredDeps.map((d) => (
                  <li key={d.id} className="flex flex-wrap justify-between gap-2">
                    <span>{d.title}</span>
                    {d.versionId ? (
                      <span className="font-mono text-xs text-faint">{d.versionNumber}{d.versionType !== "release" && ` (${d.versionType})`}</span>
                    ) : (
                      <Badge tone="redstone">no build for {builder.state.mcVersion}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

export function ImportDialog({ open, onClose, builder }: { open: boolean; onClose: () => void; builder: Builder }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);

  const close = () => {
    setText("");
    setError(null);
    setWarnings(null);
    onClose();
  };
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const w = await builder.actions.importFile(text);
      if (w.length) setWarnings(w);
      else close();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof TypeError
        ? "Could not reach Modrinth to look up the mods. Try again in a moment."
        : `This does not look like a Docker Compose file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Import a compose file"
      description="Settings and mods from an itzg/minecraft-server compose file. It replaces your current setup."
      footer={
        warnings ? (
          <Button variant="primary" onClick={close}>Continue</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={run} disabled={!text.trim() || busy}>
              {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />} Import
            </Button>
          </>
        )
      }
    >
      {warnings ? (
        <div>
          <p className="font-semibold">Imported, with notes:</p>
          <ul className="mt-2 list-inside list-disc text-sm text-muted">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="pixel flex cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-field p-4 text-sm font-semibold hover:border-copper-line">
            <FileUp aria-hidden className="h-4 w-4" /> Choose a file
            <input
              type="file"
              accept=".yml,.yaml,text/yaml"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setText(await file.text());
              }}
            />
          </label>
          <label htmlFor="import-text" className="text-sm text-muted">…or paste it here</label>
          <TextArea id="import-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-[13px]" spellCheck={false} aria-describedby={error ? "import-error" : undefined} />
          {error && <p id="import-error" role="alert" className="text-sm font-semibold text-redstone">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}

export function OptionsDialog({ open, onClose, options, setOptions }: {
  open: boolean;
  onClose: () => void;
  options: DisplayOptions;
  setOptions: (o: Partial<DisplayOptions>) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="Display options" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-5">
        <Toggle id="reduce-motion" label="Reduce motion" hint="Turns off animations. Your system setting is always respected." checked={options.reduceMotion} onChange={(reduceMotion) => setOptions({ reduceMotion })} />
      </div>
    </Dialog>
  );
}

export function ResetDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Start over?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => (onConfirm(), onClose())}>Clear everything</Button>
        </>
      }
    >
      <p className="text-muted">This clears the version, your mods and every setting. Files you already downloaded are not affected.</p>
    </Dialog>
  );
}
