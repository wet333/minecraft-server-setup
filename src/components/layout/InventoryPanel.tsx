import { useRef, useState } from "react";
import { AlertTriangle, Boxes, Download, FileCode2, Loader2, Plus, UserCheck, Users, X } from "lucide-react";
import type { Builder } from "../../hooks/useBuilder";
import { placement } from "../../lib/sides";
import type { SelectedMod } from "../../lib/state";
import { Button, CopyButton, buttonClass, cx, usePreview } from "../ui/core";
import { ModIcon, Slot, SlotBadge } from "../ui/slot";
import { YamlPreview } from "./YamlPreview";

export type PanelTab = "inventory" | "compose";

/** Fills whole rows of six, at least two rows, counting the "add" slot. */
const MIN_SLOTS = 12;

export function modStatusText(m: SelectedMod, mcVersion: string): string {
  switch (m.status) {
    case "pending":
    case "loading":
      return "checking version…";
    case "incompatible":
      return `no build for ${mcVersion}, left out`;
    case "error":
      return "could not check, open to retry";
    case "ok": {
      const p = placement(m.clientSide, m.serverSide, m.sideOverride);
      const where = p.server && p.players ? "server + players" : p.server ? "server only" : "players only";
      return `${m.versionNumber}${m.versionType !== "release" ? ` (${m.versionType})` : ""} · ${where}`;
    }
  }
}

/** Corner marker for a mod slot; every marker is also spelled out in the slot's label. */
export function slotBadge(mod: SelectedMod) {
  const p = placement(mod.clientSide, mod.serverSide, mod.sideOverride);
  if (mod.status === "loading" || mod.status === "pending") return <SlotBadge tone="copper"><Loader2 className="h-3 w-3 animate-spin" /></SlotBadge>;
  if (mod.status !== "ok") return <SlotBadge tone={mod.status === "error" ? "redstone" : "gold"}>!</SlotBadge>;
  if (mod.versionType !== "release") return <SlotBadge tone="gold">β</SlotBadge>;
  if (p.players) return <SlotBadge tone="teal"><Users className="h-3 w-3" strokeWidth={3} /></SlotBadge>;
  return null;
}

function InventoryTab({ builder, onOpenMod, onChecked }: {
  builder: Builder;
  onOpenMod: (id: string) => void;
  onChecked?: (before: Map<string, string | null>) => void;
}) {
  const { state, actions, players, vanillaOk, serverProjects } = builder;
  const [inspected, setInspected] = useState<SelectedMod | null>(null);
  const autoDeps = serverProjects.filter((p) => !state.mods.some((m) => m.projectId === p.projectId));
  const cells = Math.max(MIN_SLOTS, Math.ceil((state.mods.length + 1) / 6) * 6);
  const empty = cells - state.mods.length - 1;

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="truncate text-sm text-muted">
        <span className="font-semibold text-ink">{state.serverName || "Unnamed server"}</span>
        {" · "}Fabric {state.mcVersion || "—"} · {state.mods.length} picked · {serverProjects.length} on server
      </p>

      <div>
        <ul aria-label="Picked mods" className="grid grid-cols-6 gap-1.5">
          {state.mods.map((m) => (
            <li key={m.projectId}>
              <Slot
                size="md"
                pop
                badge={slotBadge(m)}
                aria-label={`${m.title}: ${modStatusText(m, state.mcVersion)}. Open details`}
                onClick={() => onOpenMod(m.projectId)}
                onPointerEnter={() => setInspected(m)}
                onPointerLeave={() => setInspected(null)}
                onFocus={() => setInspected(m)}
                onBlur={() => setInspected(null)}
                className={m.status === "incompatible" ? "opacity-50 grayscale" : undefined}
              >
                <ModIcon url={m.iconUrl} />
              </Slot>
            </li>
          ))}
          <li>
            <Slot size="md" aria-label="Add mods" onClick={() => actions.goTo("mods")} className="text-faint hover:text-copper-ink">
              <Plus aria-hidden className="h-5 w-5" />
            </Slot>
          </li>
          {Array.from({ length: empty }, (_, i) => (
            <li key={`empty-${i}`} aria-hidden>
              <Slot size="md" />
            </li>
          ))}
        </ul>
        {/* Like the item name above a game hotbar: details of the hovered or focused slot. */}
        <p className="mt-2 min-h-[2.5rem] text-sm leading-snug" aria-hidden>
          {inspected ? (
            <>
              <span className="block truncate font-semibold text-ink">{inspected.title}</span>
              <span className="block truncate font-mono text-xs text-faint">{modStatusText(inspected, state.mcVersion)}</span>
            </>
          ) : (
            <span className="text-faint">
              {state.mods.length ? "Point at a slot for details, click to change it." : "Your mods appear here as you add them."}
            </span>
          )}
        </p>
      </div>

      <div className={cx("pixel flex items-start gap-2 px-3 py-2 text-sm", vanillaOk ? "bg-emerald-soft text-emerald" : "bg-teal-soft text-teal")}>
        {vanillaOk ? <UserCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> : <Users aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {vanillaOk
            ? "Players can join with plain Minecraft."
            : `Players need ${players.length} mod${players.length === 1 ? "" : "s"}. Your kit includes a folder with them, ready to paste into Minecraft.`}
        </span>
      </div>
      {state.mods.some((m) => m.status === "incompatible" || m.status === "error") && (
        <p className="-mt-2 flex items-start gap-2 text-sm text-gold">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> Some mods are left out. Open them to see why.
        </p>
      )}

      {autoDeps.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-muted">
            Added for you <span className="font-normal text-faint">· {autoDeps.length} required {autoDeps.length === 1 ? "library" : "libraries"}</span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {autoDeps.map((d) => (
              <li key={d.projectId} className="pixel bg-slot px-2 py-0.5 text-[13px] text-muted" title={`Needed by ${(builder.reasons.get(d.projectId) ?? []).join(", ")}`}>
                {d.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.mods.length > 0 && (
        <p className="text-sm text-faint">
          Versions stay pinned until you{" "}
          <button
            type="button"
            className={buttonClass("link", "sm", "text-sm")}
            onClick={() => {
              const before = new Map(state.mods.map((m) => [m.projectId, m.versionId]));
              actions.checkForUpdates();
              onChecked?.(before);
            }}
          >
            check for updates
          </button>
          .
        </p>
      )}
    </div>
  );
}

function ComposeTab({ builder, onDownloadCompose, fill }: { builder: Builder; onDownloadCompose: () => void; fill: boolean }) {
  const { active } = usePreview();
  return (
    <div className={cx("flex flex-col", fill && "h-full")}>
      <div className="flex items-center gap-1 border-b-2 border-line py-1.5 pr-1.5 pl-3">
        <span className="mr-auto min-w-0 truncate font-mono text-xs text-faint" title="Updates as you edit">{builder.yaml.split("\n").length} lines, live</span>
        <CopyButton text={builder.yaml} />
        <Button variant="ghost" size="sm" onClick={onDownloadCompose}>
          <Download aria-hidden className="h-4 w-4" /> Download
        </Button>
      </div>
      <YamlPreview yaml={builder.yaml} activeKeys={active} className={cx("bg-slot/40", fill && "min-h-0 flex-1")} />
    </div>
  );
}

const TABS: { id: PanelTab; label: string; icon: typeof Boxes }[] = [
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "compose", label: "docker-compose.yml", icon: FileCode2 },
];

/**
 * The inventory and the compose file, one tab at a time. As a desktop side panel it fills its
 * column and only the active tab scrolls; inside the phone sheet the sheet itself scrolls.
 */
export function ServerPanel({ builder, tab, onTab, onClose, onOpenMod, onChecked, onDownloadCompose, fill }: {
  builder: Builder;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onClose?: () => void;
  onOpenMod: (id: string) => void;
  onChecked?: (before: Map<string, string | null>) => void;
  onDownloadCompose: () => void;
  /** Fill a fixed-height container (desktop) instead of growing with content (phone sheet). */
  fill: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const next = (i + TABS.length) % TABS.length;
    onTab(TABS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className={cx("flex flex-col", fill && "h-full")}>
      <div className="flex items-center gap-1 border-b-2 border-line px-2 py-1.5">
        <div role="tablist" aria-label="Your server" className="flex min-w-0 flex-1 gap-1">
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const selected = t.id === tab;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                id={`panel-tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTab(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") (e.preventDefault(), move(i + 1));
                  if (e.key === "ArrowLeft") (e.preventDefault(), move(i - 1));
                }}
                className={cx(
                  "pixel flex h-9 min-w-0 items-center gap-1.5 px-2.5 text-sm font-semibold transition",
                  t.id === "compose" && "font-mono",
                  selected ? "bg-hover text-ink" : "text-muted hover:bg-hover hover:text-ink",
                )}
              >
                <Icon aria-hidden className={cx("h-4 w-4 shrink-0", selected && "text-copper-ink")} />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close panel" className={buttonClass("ghost", "sm", "w-9 shrink-0 px-0")}>
            <X aria-hidden className="h-5 w-5" />
          </button>
        )}
      </div>
      <div
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`panel-tab-${tab}`}
        className={cx(fill && "min-h-0 flex-1", fill && tab === "inventory" && "overflow-y-auto")}
      >
        {tab === "inventory" ? (
          <InventoryTab builder={builder} onOpenMod={onOpenMod} onChecked={onChecked} />
        ) : (
          <ComposeTab builder={builder} onDownloadCompose={onDownloadCompose} fill={fill} />
        )}
      </div>
    </div>
  );
}
